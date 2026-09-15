using Crm04.Contracts;
using Crm04.Domain.Serialization;
using Crm04.Domain.Types;
using Microsoft.AspNetCore.SignalR.Client;

namespace Crm04.Web.State;

/// <summary>
/// The single SignalR connection from this Blazor process to the API.
///
/// ONE CONNECTION PER PROCESS, NOT PER CIRCUIT. A control room with a dozen screens open shares
/// this one upstream connection; each browser gets render diffs from its own circuit instead of
/// its own copy of the telemetry. That is the main reason Blazor Server suits this application:
/// twelve viewers cost the API nothing extra.
///
/// It writes incoming frames straight into the stores at 10 Hz - a pure array write, no rendering.
/// Repainting is driven separately by <see cref="UiTickService"/> at 4 Hz. Decoupling the two is
/// what keeps a fast feed from dictating the render rate.
/// </summary>
public sealed class TelemetryClient : IHostedService, IAsyncDisposable
{
    private readonly TagStore _tags;
    private readonly MillStore _mill;
    private readonly ILogger<TelemetryClient> _log;
    private readonly Uri _hubUrl;

    private HubConnection? _connection;

    public TelemetryClient(IConfiguration config, TagStore tags, MillStore mill, ILogger<TelemetryClient> log)
    {
        _tags = tags;
        _mill = mill;
        _log = log;
        _hubUrl = new Uri(config["Api:HubUrl"] ?? "http://localhost:5200/hubs/telemetry");
    }

    public Task StartAsync(CancellationToken ct)
    {
        _connection = new HubConnectionBuilder()
            .WithUrl(_hubUrl)
            .AddJsonProtocol(o =>
            {
                // The same wire format the API serialises with, so enums arrive as MEASURED and
                // FAST_STOP rather than failing to parse.
                o.PayloadSerializerOptions.PropertyNamingPolicy = WireJson.Options.PropertyNamingPolicy;
                o.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
                foreach (var c in WireJson.Options.Converters) o.PayloadSerializerOptions.Converters.Add(c);
            })
            .WithAutomaticReconnect([TimeSpan.Zero, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5)])
            .Build();

        _connection.On<TelemetryEnvelope>("Frame", envelope =>
        {
            // The mode decides every tag's provenance, so a mode change invalidates the cached
            // catalogue. There is no mode selector any more - the mode is whatever the SOURCE
            // declares - but this refresh is still load-bearing: the Oracle source reports its
            // conservative placeholder mode until the first frame header is read, so a client that
            // connected ahead of the feed has cached a catalogue badged for that placeholder. The
            // first real frame carries the true mode, and this is what brings the badges into line.
            if (_tags.HasCatalog && envelope.Summary.Mode != _tags.Mode)
            {
                _ = RefreshCatalogAsync(envelope.Summary.Mode);
            }

            _tags.Apply(envelope.Frame);
            _mill.Apply(envelope);
        });

        _connection.Reconnecting += error =>
        {
            _mill.SetConnectionError("Reconnecting to the telemetry API…");
            _log.LogWarning(error, "Telemetry hub connection lost; reconnecting.");
            return Task.CompletedTask;
        };

        _connection.Reconnected += async _ =>
        {
            // A reconnect may be to a DIFFERENT API instance - a redeploy, a restart - which may
            // have no feed at all. What the old connection delivered proves nothing about this one.
            _mill.Reset();

            // The catalogue could have changed across a redeploy, and every ordinal on the wire
            // depends on it. Re-fetching is cheap and getting it wrong would silently shift every
            // value into a neighbouring tag's slot.
            await FetchCatalogAsync();
            _mill.SetConnectionError(null);
        };

        _connection.Closed += error =>
        {
            _mill.Reset();
            _mill.SetConnectionError("Telemetry API unreachable.");
            if (_stopping) return Task.CompletedTask;

            // WithAutomaticReconnect gives up after its schedule. Without this the web process sat
            // disconnected until someone restarted it - on a control-room screen nobody touches.
            _log.LogError(error, "Telemetry hub connection closed; retrying.");
            _ = Task.Run(ConnectWithRetryAsync, CancellationToken.None);
            return Task.CompletedTask;
        };

        // Connect in the background, and do NOT await it. A failed or not-yet-started API must not
        // block the web app from booting - the UI is perfectly capable of saying "no data" and
        // retrying, which is far more useful than a host that refuses to start.
        _ = Task.Run(ConnectWithRetryAsync, CancellationToken.None);
        return Task.CompletedTask;
    }

    private async Task ConnectWithRetryAsync()
    {
        // One loop at a time: the startup call and a Closed event must not race two StartAsyncs.
        if (Interlocked.Exchange(ref _connecting, 1) == 1) return;

        try
        {
            while (!_stopping)
            {
                try
                {
                    await _connection!.StartAsync();
                    await FetchCatalogAsync();
                    _mill.SetConnectionError(null);
                    _log.LogInformation("Connected to telemetry hub at {Url}.", _hubUrl);
                    return;
                }
                catch (Exception ex)
                {
                    _mill.SetConnectionError($"Telemetry API unreachable at {_hubUrl}. Is Crm04.Api running?");
                    _log.LogWarning("Telemetry hub not reachable at {Url}: {Message}. Retrying in 3 s.", _hubUrl, ex.Message);
                    await Task.Delay(TimeSpan.FromSeconds(3));
                }
            }
        }
        finally
        {
            Interlocked.Exchange(ref _connecting, 0);
        }
    }

    private int _connecting;
    private volatile bool _stopping;

    private async Task FetchCatalogAsync()
    {
        var catalog = await _connection!.InvokeAsync<TagCatalogDto>("GetCatalog");
        _tags.SetCatalog(catalog);
        _log.LogInformation("Tag catalogue loaded: {Count} tags, mode {Mode}.", catalog.Tags.Count, catalog.Mode);
    }

    /// <summary>
    /// Re-fetch after a mode change. Guarded so a burst of frames arriving mid-switch cannot
    /// start a dozen overlapping fetches.
    /// </summary>
    private async Task RefreshCatalogAsync(OperatingMode mode)
    {
        if (Interlocked.Exchange(ref _refreshingCatalog, 1) == 1) return;

        try
        {
            await FetchCatalogAsync();
            _log.LogInformation("Operating mode changed to {Mode}; catalogue re-fetched.", mode.ToWire());
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Catalogue refresh after a mode change failed.");
        }
        finally
        {
            Interlocked.Exchange(ref _refreshingCatalog, 0);
        }
    }

    private int _refreshingCatalog;

    public async Task StopAsync(CancellationToken ct)
    {
        // Set first: stopping the connection raises Closed, which must not start a retry loop in a
        // process that is shutting down.
        _stopping = true;
        if (_connection is not null) await _connection.StopAsync(ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null) await _connection.DisposeAsync();
    }
}

/// <summary>
/// One timer for the whole process that tells components to look at the stores.
///
/// 4 Hz against a 10 Hz feed. The feed writes into the stores as fast as it arrives; this decides
/// how often anything repaints. Two and a half frames of data per repaint is invisible on a
/// control-room readout and cuts the render load by 60% before <c>ShouldRender</c> has even had a
/// say - and <c>ShouldRender</c> then removes most of what is left.
/// </summary>
public sealed class UiTickService : IHostedService, IDisposable
{
    private readonly ILogger<UiTickService> _log;
    private Timer? _timer;

    public UiTickService(ILogger<UiTickService> log) => _log = log;

    /// <summary>Raised on the UI thread pool. Components subscribe and call StateHasChanged.</summary>
    public event Action? Tick;

    public Task StartAsync(CancellationToken ct)
    {
        _timer = new Timer(_ =>
        {
            try
            {
                Tick?.Invoke();
            }
            catch (Exception ex)
            {
                // A disposed circuit that has not unsubscribed yet must not take the tick down for
                // every other viewer.
                _log.LogDebug(ex, "UI tick subscriber threw.");
            }
        }, null, TimeSpan.Zero, TimeSpan.FromMilliseconds(250));

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        _timer?.Change(Timeout.Infinite, Timeout.Infinite);
        return Task.CompletedTask;
    }

    public void Dispose() => _timer?.Dispose();
}
