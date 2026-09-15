using System.Collections.Concurrent;
using System.Globalization;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

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
}

/// <summary>
/// THE LIVE PLANT SEAM — a scaffold, deliberately not finished.
///
/// Everything here is transport-agnostic and compiles with no extra packages: mapping, unit
/// conversion, the absent-vs-null rule and the staleness gate. The ONE thing left is moving
/// bytes, which is <see cref="ConnectAsync"/>. Fill that in with either
///
///   a) an OPC UA client in this process (add OPCFoundation.NetStandard.Opc.Ua.Client), or
///   b) a WebSocket/MQTT reader consuming an edge gateway's egress — the path
///      docs/INTEGRATION.md describes, and usually the one plant IT will accept.
///
/// Whichever you pick, call <see cref="Ingest"/> from the subscription callback. Nothing else
/// changes.
///
/// NOT REGISTERED IN DI ON PURPOSE. Adding this file changes no behaviour; the Feeder keeps
/// replaying until someone deliberately swaps the registration in Program.cs:
///
///     builder.Services.AddSingleton&lt;IFrameSource, OpcUaFrameSource&gt;();
///
/// and binds an "OpcUa" section the way "Replay" is bound.
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
    /// Open the plant connection and subscribe. Override this — the default deliberately does
    /// nothing except say so.
    ///
    /// It does NOT throw. A feeder that crashes on a gateway that is not ready yet is worse than
    /// one that sits quiet and writes nothing: with no frames the API's frame age grows, the UI
    /// goes STALE and the twin freezes, which is the honest picture. Throwing here would instead
    /// stop the Feeder dead and leave the last written frame looking current forever.
    /// </summary>
    protected virtual Task ConnectAsync(CancellationToken ct)
    {
        _log.LogError(
            "OpcUaFrameSource.ConnectAsync is not implemented — no plant transport is wired, so no " +
            "frames will be produced. Override it with an OPC UA client or a gateway reader and " +
            "call Ingest() from the subscription callback.");
        return Task.CompletedTask;
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

    public virtual ValueTask DisposeAsync()
    {
        _connected = false;
        _latest.Clear();
        return ValueTask.CompletedTask;
    }
}
