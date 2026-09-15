using System.Collections.Concurrent;
using System.Globalization;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Ua = Opc.Ua;
using UaClient = Opc.Ua.Client;
using UaConfig = Opc.Ua.Configuration;

namespace Crm04.Feeder.Sources;

public sealed class OpcUaSourceOptions
{
    /// <summary>Defaults to dotnet/config/tag_mapping.csv.</summary>
    public string? MappingFile { get; set; }

    /// <summary>Recorded in FRAME.SOURCE_ID so a row traces back to what produced it.</summary>
    public string SourceId { get; set; } = "opcua:crm04";

    /// <summary>
    /// Stop emitting frames when no value has arrived for this long. NOT a cosmetic timeout:
    /// see the comment on <see cref="OpcUaFrameSource.NextFrameAsync"/>.
    /// </summary>
    public int StaleAfterMs { get; set; } = 2000;

    /// <summary>KEPServerEX OPC UA endpoint, e.g. opc.tcp://JLD2SRV19913:49320.</summary>
    public string EndpointUrl { get; set; } = "opc.tcp://JLD2SRV19913:49320";

    /// <summary>
    /// Prepended to each PlantAddress in the mapping file to form the OPC UA NodeId. Confirm the
    /// channel/device names and the namespace index in UaExpert before trusting it.
    /// </summary>
    public string NodeIdPrefix { get; set; } = "ns=2;s=";

    /// <summary>Read-only Kepware OPC UA user; null for anonymous (not recommended in production).</summary>
    public string? Username { get; set; }

    /// <summary>Set via the OpcUa__Password environment variable - never in a committed file.</summary>
    public string? Password { get; set; }

    public int PublishingIntervalMs { get; set; } = 100;

    /// <summary>
    /// Use a signed and encrypted endpoint (Basic256Sha256) rather than security policy None.
    /// Requires the Feeder's certificate to be trusted in Kepware, and Kepware's in pki/trusted.
    /// </summary>
    public bool UseSecurity { get; set; }

    /// <summary>
    /// Accept Kepware's server certificate without it being in pki/trusted. Convenient while
    /// commissioning; switch off once the certificate has been trusted explicitly.
    /// </summary>
    public bool AutoAcceptServerCertificate { get; set; }
}

/// <summary>
/// THE LIVE PLANT FEED — KEPServerEX over OPC UA.
///
/// Opens an OPC UA session to Kepware (OpcUa:EndpointUrl), subscribes to every address in the
/// mapping file as OpcUa:NodeIdPrefix + address, and turns each notification into a twin tag
/// through <see cref="Ingest"/> - mapping, unit conversion, the absent-vs-null rule and the
/// staleness gate all live here.
///
/// Registered by Program.cs when Source:Kind is OpcUa, which is the production setting. The
/// plant's configuration is documented in docs/IT_INTEGRATION_GUIDE.md.
///
/// THE THREE RULES THIS CLASS EXISTS TO ENFORCE
///
///   1. A tag ABSENT from the frame means "this feed has no such tag" and renders NO TAG.
///      A tag present holding TagValue.Null means "it exists and reads nothing right now".
///      Confusing them is how a twin starts inventing plausible numbers. Rows in the mapping
///      file with an empty TwinTag are therefore SKIPPED, never defaulted to zero.
///   2. The source never sleeps and never stamps time. FeederService owns the clock.
///   3. Mode is LIVE, and that is written into FRAME.OP_MODE — it decides how these values are
///      badged for the rest of their life.
/// </summary>
public class OpcUaFrameSource : IFrameSource
{
    private sealed record Mapping(
        string PlantAddress,
        string TwinTag,
        double Scale,
        double Offset,
        string Kind,
        string Confidence);

    private readonly ILogger<OpcUaFrameSource> _log;
    private readonly OpcUaSourceOptions _options;
    private readonly string _mappingFile;

    /// <summary>
    /// Plant address to the tag(s) it feeds. Only rows carrying a twin tag land here.
    ///
    /// A LIST, NOT A SINGLE MAPPING, because fan-out is real: the mill has one exit-thickness
    /// sensor, while the twin models STRIP.THICKNESS and DTR.THICKNESS as separate tags. One
    /// address legitimately updates both. Forbidding that would mean throwing away a genuine
    /// reading purely because the twin's model is finer-grained than the plant's instrumentation.
    /// </summary>
    private readonly Dictionary<string, List<Mapping>> _byAddress = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Latest value per TWIN tag. Written by the transport callback on whatever thread it uses,
    /// read by the feeder loop — hence concurrent.
    /// </summary>
    private readonly ConcurrentDictionary<string, TagValue> _latest = new(StringComparer.Ordinal);

    private long _lastUpdateMs;
    private volatile bool _connected;

    public OpcUaFrameSource(OpcUaSourceOptions options, ILogger<OpcUaFrameSource> log)
    {
        _options = options;
        _log = log;
        _mappingFile = options.MappingFile ?? DefaultMappingFile();
        SourceId = options.SourceId;
    }

    public string SourceId { get; }

    /// <summary>Real plant values. Never anything else from this source.</summary>
    public OperatingMode Mode => OperatingMode.Live;

    public bool IsConnected => _connected;

    public async Task StartAsync(CancellationToken ct)
    {
        LoadMapping();
        await ConnectAsync(ct);
    }

    /// <summary>
    /// Open the Kepware session and subscribe to every mapped address, on a background loop that
    /// keeps retrying for as long as the Feeder runs.
    ///
    /// It does NOT throw. A feeder that crashes on a gateway that is not ready yet is worse than
    /// one that sits quiet and writes nothing: with no frames the API's frame age grows, the UI
    /// goes STALE and the twin freezes, which is the honest picture. Throwing here would instead
    /// stop the Feeder dead and leave the last written frame looking current forever.
    /// </summary>
    protected virtual Task ConnectAsync(CancellationToken ct)
    {
        _connectionCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var token = _connectionCts.Token;
        _ = Task.Run(() => ConnectLoopAsync(token), CancellationToken.None);
        return Task.CompletedTask;
    }

    // OPC Foundation 1.5.378 routes its diagnostics through a telemetry context that every session,
    // subscription and monitored item is constructed with. One for the process is enough.
    private static readonly Ua.ITelemetryContext Telemetry = Ua.DefaultTelemetry.Create(_ => { });

    private UaClient.ISession? _session;
    private CancellationTokenSource? _connectionCts;
    private TaskCompletionSource _linkLost = NewSignal();

    private static TaskCompletionSource NewSignal() => new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>
    /// Connect, hold the session until keep-alive reports the link gone, then start again. A
    /// Kepware restart, a network blip or a server that is not up yet all end up here, and none
    /// of them stops the Feeder.
    /// </summary>
    private async Task ConnectLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ConnectOnceAsync(ct);
                await _linkLost.Task.WaitAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                MarkDisconnected(ex.Message);
                _log.LogError(ex, "Could not connect to Kepware at {Endpoint}; retrying in 5 s.", _options.EndpointUrl);
            }

            await CloseSessionAsync();

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        await CloseSessionAsync();
    }

    private async Task ConnectOnceAsync(CancellationToken ct)
    {
        var pki = Path.Combine(AppContext.BaseDirectory, "pki");

        var config = new Ua.ApplicationConfiguration
        {
            ApplicationName = "CRM04 Feeder",
            ApplicationUri = $"urn:{System.Net.Dns.GetHostName()}:CRM04Feeder",
            ApplicationType = Ua.ApplicationType.Client,
            SecurityConfiguration = new Ua.SecurityConfiguration
            {
                ApplicationCertificate = new Ua.CertificateIdentifier
                {
                    StoreType = Ua.CertificateStoreType.Directory,
                    StorePath = Path.Combine(pki, "own"),
                    SubjectName = "CN=CRM04 Feeder",
                },
                TrustedPeerCertificates = new Ua.CertificateTrustList
                {
                    StoreType = Ua.CertificateStoreType.Directory,
                    StorePath = Path.Combine(pki, "trusted"),
                },
                TrustedIssuerCertificates = new Ua.CertificateTrustList
                {
                    StoreType = Ua.CertificateStoreType.Directory,
                    StorePath = Path.Combine(pki, "issuer"),
                },
                RejectedCertificateStore = new Ua.CertificateTrustList
                {
                    StoreType = Ua.CertificateStoreType.Directory,
                    StorePath = Path.Combine(pki, "rejected"),
                },
                AutoAcceptUntrustedCertificates = _options.AutoAcceptServerCertificate,
            },
            TransportConfigurations = [],
            TransportQuotas = new Ua.TransportQuotas { OperationTimeout = 15000 },
            ClientConfiguration = new Ua.ClientConfiguration { DefaultSessionTimeout = 60000 },
        };

        await config.ValidateAsync(Ua.ApplicationType.Client, ct);

        if (_options.AutoAcceptServerCertificate)
        {
            config.CertificateValidator.CertificateValidation += (_, e) => e.Accept = true;
        }

        // Creates pki/own on first run - that is the certificate Kepware must be told to trust.
        var app = new UaConfig.ApplicationInstance(config, Telemetry);
        await app.CheckApplicationInstanceCertificatesAsync(false, null, ct);

        var description = await UaClient.CoreClientUtils.SelectEndpointAsync(
            config, _options.EndpointUrl, _options.UseSecurity, 15000, Telemetry, ct);
        var endpoint = new Ua.ConfiguredEndpoint(null, description, Ua.EndpointConfiguration.Create(config));

        var identity = string.IsNullOrWhiteSpace(_options.Username)
            ? new Ua.UserIdentity(new Ua.AnonymousIdentityToken())
            : new Ua.UserIdentity(_options.Username, System.Text.Encoding.UTF8.GetBytes(_options.Password ?? string.Empty));

        var session = await new UaClient.DefaultSessionFactory(Telemetry).CreateAsync(
            config, endpoint, false, "CRM04 Feeder", 60000, identity, null, ct);
        _session = session;

        var lost = NewSignal();
        _linkLost = lost;

        // KEEP-ALIVE IS THE HEARTBEAT, NOT JUST A LINK CHECK. Kepware publishes a value only when it
        // CHANGES, so an idle mill on a perfectly healthy link sends nothing at all - and "no value for
        // StaleAfterMs" would then report a live feed as STALE. A good keep-alive proves the server is
        // answering, so it refreshes the freshness clock; values that have not changed are still current.
        session.KeepAliveInterval = Math.Max(500, Math.Min(1000, _options.StaleAfterMs / 2));
        session.KeepAlive += (_, e) =>
        {
            if (Ua.ServiceResult.IsBad(e.Status))
            {
                MarkDisconnected($"keep-alive failed: {e.Status}");
                lost.TrySetResult();
                return;
            }

            Interlocked.Exchange(ref _lastUpdateMs, NowMs());
        };

        var subscription = new UaClient.Subscription(Telemetry, new UaClient.SubscriptionOptions
        {
            DisplayName = "CRM04 twin",
            PublishingInterval = _options.PublishingIntervalMs,
            PublishingEnabled = true,
        });

        var items = new List<UaClient.MonitoredItem>(_byAddress.Count);
        foreach (var address in _byAddress.Keys)
        {
            var item = new UaClient.MonitoredItem(Telemetry, new UaClient.MonitoredItemOptions
            {
                // The address rides along as the display name, so the notification handler can hand
                // it straight to Ingest() without a second lookup table.
                DisplayName = address,
                StartNodeId = Ua.NodeId.Parse(_options.NodeIdPrefix + address),
                AttributeId = Ua.Attributes.Value,
                SamplingInterval = _options.PublishingIntervalMs,
                QueueSize = 1,
                DiscardOldest = true,
            });
            item.Notification += OnNotification;
            items.Add(item);
        }

        subscription.AddItems(items);
        session.AddSubscription(subscription);
        await subscription.CreateAsync(ct);

        // An address Kepware does not know is not fatal - that tag simply reads NO TAG - but
        // automation needs the list, because it is almost always a NodeId prefix or naming mismatch.
        var rejected = items
            .Where(i => i.Status.Error is not null && Ua.ServiceResult.IsBad(i.Status.Error))
            .Select(i => i.DisplayName)
            .ToList();

        if (rejected.Count > 0)
        {
            _log.LogWarning(
                "Kepware rejected {Count} of {Total} NodeId(s) under prefix '{Prefix}'. These tags will read NO TAG. First few: {Addresses}",
                rejected.Count, items.Count, _options.NodeIdPrefix, string.Join(", ", rejected.Take(10)));
        }

        MarkConnected();
    }

    private void OnNotification(UaClient.MonitoredItem item, UaClient.MonitoredItemNotificationEventArgs e)
    {
        if (e.NotificationValue is not Ua.MonitoredItemNotification notification) return;

        var value = notification.Value;

        // Bad or uncertain quality means the tag exists but reads nothing: pass null, which becomes
        // TagValue.Null. Never substitute zero, and never hold the last good value.
        Ingest(item.DisplayName, Ua.StatusCode.IsGood(value.StatusCode) ? Normalise(value.Value) : null);
    }

    /// <summary>
    /// Kepware delivers Word / DWord / Byte / LLong tags as ushort / uint / byte / ulong, which the
    /// converter does not recognise and would turn into NO DATA. Widen every other number to double.
    /// </summary>
    private static object? Normalise(object? value) => value switch
    {
        null or bool or string or double or float or int or long or short or decimal => value,
        IConvertible c => System.Convert.ToDouble(c, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };

    private async Task CloseSessionAsync()
    {
        var session = Interlocked.Exchange(ref _session, null);
        if (session is null) return;

        try
        {
            await session.CloseAsync(5000, true, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Closing the Kepware session failed; disposing anyway.");
        }

        session.Dispose();
    }

    /// <summary>Call from the transport once the session is up and subscriptions are live.</summary>
    protected void MarkConnected()
    {
        _connected = true;
        _log.LogInformation(
            "Plant feed connected: {Addresses} subscribed address(es) feeding {Tags} tag(s) on {Source}.",
            _byAddress.Count, _byAddress.Values.Sum(v => v.Count), SourceId);
    }

    protected void MarkDisconnected(string reason)
    {
        _connected = false;
        _log.LogWarning("Plant feed disconnected: {Reason}", reason);
    }

    /// <summary>
    /// Feed one raw plant value in. <paramref name="plantAddress"/> is the MillPilot path exactly
    /// as it appears in the mapping file; an address with no mapping is ignored, which is what
    /// lets the gateway subscribe to more than the twin models without corrupting anything.
    ///
    /// Pass null for "the tag exists but currently reads nothing" — that becomes TagValue.Null,
    /// which is NOT the same as never calling this at all.
    /// </summary>
    public void Ingest(string plantAddress, object? raw)
    {
        if (!_byAddress.TryGetValue(plantAddress, out var maps)) return;

        // Each target gets its own conversion — two tags fed by one address may well want
        // different units (a percentage here, an engineering value there).
        foreach (var map in maps)
        {
            _latest[map.TwinTag] = Convert(map, raw);
        }

        Interlocked.Exchange(ref _lastUpdateMs, NowMs());
    }

    private static TagValue Convert(Mapping map, object? raw)
    {
        if (raw is null) return TagValue.Null;

        switch (map.Kind.ToUpperInvariant())
        {
            case "BOOLEAN":
                return raw switch
                {
                    bool b => TagValue.FromBoolean(b),
                    // PLC bits arrive as 0/1 through some gateways.
                    double d => TagValue.FromBoolean(Math.Abs(d) > double.Epsilon),
                    int i => TagValue.FromBoolean(i != 0),
                    string s when bool.TryParse(s, out var sb) => TagValue.FromBoolean(sb),
                    _ => TagValue.Null,
                };

            case "STRING":
                return TagValue.From(raw.ToString());

            default:
                // NUMBER. Scale/offset is applied HERE and nowhere else, so a unit error is a
                // one-line fix in the CSV rather than a hunt through the code.
                double? n = raw switch
                {
                    double d => d,
                    float f => f,
                    int i => i,
                    long l => l,
                    short sh => sh,
                    decimal m => (double)m,
                    string s when double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var sd) => sd,
                    _ => null,
                };

                if (n is not { } v || !double.IsFinite(v)) return TagValue.Null;
                return TagValue.FromNumber(v * map.Scale + map.Offset);
        }
    }

    /// <summary>
    /// A snapshot of the latest values, or null when there is nothing honest to write.
    ///
    /// THE STALENESS GATE IS THE IMPORTANT PART. When the gateway stops, the obvious thing is to
    /// keep returning the last snapshot — and that is precisely wrong: the Feeder would stamp old
    /// readings with the current time, ten times a second, and the twin would show a frozen mill
    /// as live. Returning null writes nothing, frame age grows, the UI goes STALE, the 3D scene
    /// freezes and COMMUNICATION_LOST raises. All of that already works.
    /// </summary>
    public ValueTask<FeedFrame?> NextFrameAsync(CancellationToken ct)
    {
        if (!_connected || _latest.IsEmpty) return ValueTask.FromResult<FeedFrame?>(null);

        var age = NowMs() - Interlocked.Read(ref _lastUpdateMs);
        if (age > _options.StaleAfterMs) return ValueTask.FromResult<FeedFrame?>(null);

        // Copy: the writer must not see the dictionary mutate underneath it mid-frame.
        var values = new Dictionary<string, TagValue>(_latest, StringComparer.Ordinal);

        // Both are simulator diagnostics with no plant equivalent. Zero is honest here — they
        // describe the solver, and on a live feed there is no solver.
        return ValueTask.FromResult<FeedFrame?>(new FeedFrame(values, 0, 0d));
    }

    // ---------------------------------------------------------------------------------------
    // Mapping file
    // ---------------------------------------------------------------------------------------

    private void LoadMapping()
    {
        if (!File.Exists(_mappingFile))
        {
            throw new FileNotFoundException(
                $"Tag mapping not found at {_mappingFile}. It maps plant addresses to twin tags " +
                "and without it nothing can be ingested.",
                _mappingFile);
        }

        var unknown = new List<string>();
        var conflicts = new List<string>();
        var review = 0;
        var skipped = 0;

        foreach (var line in File.ReadLines(_mappingFile))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0 || trimmed.StartsWith('#')) continue;
            if (trimmed.StartsWith("PlantAddress", StringComparison.OrdinalIgnoreCase)) continue;

            var f = SplitCsv(trimmed);
            if (f.Count < 9) continue;

            var address = f[0].Trim();
            var twinTag = f[1].Trim();
            if (address.Length == 0) continue;

            // A row with no twin tag is a tag the twin does not model. Skipping it is the whole
            // point: it stays ABSENT from the frame and renders NO TAG.
            if (twinTag.Length == 0) { skipped++; continue; }

            // Refuse tags the catalogue does not declare, for the same reason the replay source
            // does: TAG_DEF would have no row, the writer would drop the value, and the twin
            // would show a quietly incomplete mill.
            if (TagCatalog.TryGet(twinTag) is null) { unknown.Add($"{twinTag} ({address})"); continue; }

            var scale = ParseDouble(f[4], 1d);
            var offset = ParseDouble(f[5], 0d);
            var kind = f[6].Trim();
            var confidence = f[7].Trim();

            if (confidence.Equals("REVIEW", StringComparison.OrdinalIgnoreCase)) review++;

            if (!_byAddress.TryGetValue(address, out var targets))
            {
                targets = [];
                _byAddress[address] = targets;
            }

            // Fan-out to DIFFERENT tags is fine. The same address mapped to the same tag twice
            // is not: the rows carry their own scale factors, so one would silently win and the
            // other would sit in the file looking authoritative.
            if (targets.Any(t => t.TwinTag.Equals(twinTag, StringComparison.Ordinal)))
            {
                conflicts.Add($"{address} -> {twinTag}");
                continue;
            }

            targets.Add(new Mapping(address, twinTag, scale, offset, kind, confidence));
        }

        if (conflicts.Count > 0)
        {
            throw new InvalidOperationException(
                $"Tag mapping declares {conflicts.Count} duplicate address/tag pair(s) " +
                $"({string.Join("; ", conflicts.Take(5))}). Each row carries its own scale factor, so " +
                $"one would silently win. Remove the redundant row in {_mappingFile}.");
        }

        if (unknown.Count > 0)
        {
            throw new InvalidOperationException(
                $"Tag mapping references {unknown.Count} tag(s) the catalogue does not declare " +
                $"({string.Join(", ", unknown.Take(5))}). Add them to src/data/tagDefinitions.ts and " +
                "regenerate:\n  npx tsx scripts/exportTagCatalog.ts");
        }

        _log.LogInformation(
            "Tag mapping loaded from {File}: {Addresses} address(es) feeding {Mapped} tag(s), " +
            "{Skipped} not modelled by the twin, {Review} still marked REVIEW.",
            _mappingFile, _byAddress.Count, _byAddress.Values.Sum(v => v.Count), skipped, review);

        // Loud on purpose. A REVIEW row is a guess that survived to production, and the ones in
        // this file include reel identity and percent-of-rating torque — both of which look
        // entirely plausible when wrong.
        if (review > 0)
        {
            _log.LogWarning(
                "{Count} mapping row(s) are UNCONFIRMED (Confidence=REVIEW). Values derived from " +
                "them may be wrong in a way no screen will reveal. Confirm them with mill automation.",
                review);
        }
    }

    private static double ParseDouble(string s, double fallback) =>
        double.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : fallback;

    /// <summary>
    /// Minimal CSV split: commas separate, double quotes protect commas inside a field, and ""
    /// is a literal quote. Enough for this file and no more — the Notes column is the only one
    /// that carries commas.
    /// </summary>
    private static List<string> SplitCsv(string line)
    {
        var fields = new List<string>();
        var cur = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); i++; }
                    else inQuotes = false;
                }
                else cur.Append(c);
                continue;
            }

            if (c == '"') inQuotes = true;
            else if (c == ',') { fields.Add(cur.ToString()); cur.Clear(); }
            else cur.Append(c);
        }

        fields.Add(cur.ToString());
        return fields;
    }

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    /// <summary>Resolve against the repository's dotnet/ folder, as the replay source does.</summary>
    private static string DefaultMappingFile()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln")))
        {
            dir = dir.Parent;
        }

        return Path.Combine(dir?.FullName ?? ".", "config", "tag_mapping.csv");
    }

    public virtual async ValueTask DisposeAsync()
    {
        if (_connectionCts is not null)
        {
            await _connectionCts.CancelAsync();
            _connectionCts.Dispose();
            _connectionCts = null;
        }

        await CloseSessionAsync();
        _connected = false;
        _latest.Clear();
        GC.SuppressFinalize(this);
    }
}
