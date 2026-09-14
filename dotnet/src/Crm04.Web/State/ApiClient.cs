using System.Net.Http.Json;
using Crm04.Contracts;
using Crm04.Domain.Coils;
using Crm04.Domain.Serialization;
using Crm04.Domain.Types;

namespace Crm04.Web.State;

/// <summary>
/// The REST half of the API. Used for things that are fetched on demand rather than pushed:
/// the trend catalogue, trend series, the mill configuration.
///
/// The live 10 Hz telemetry does NOT come through here — that is <see cref="TelemetryClient"/>
/// over SignalR. Two transports because they answer two different questions: "what is happening
/// now" is a push, "show me the last hour" is a pull.
/// </summary>
public sealed class ApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<ApiClient> _log;

    private TrendCatalogDto? _trendCatalog;

    public ApiClient(HttpClient http, ILogger<ApiClient> log)
    {
        _http = http;
        _log = log;
    }

    /// <summary>
    /// The trend catalogue, fetched once and cached. It changes only on redeploy, and every
    /// chart repaint would otherwise re-fetch 40 descriptors it already has.
    /// </summary>
    public async Task<TrendCatalogDto?> GetTrendCatalogAsync(CancellationToken ct = default)
    {
        if (_trendCatalog is not null) return _trendCatalog;

        _trendCatalog = await GetAsync<TrendCatalogDto>("api/trends/catalog", ct);
        return _trendCatalog;
    }

    public Task<TrendResponseDto?> GetTrendsAsync(
        IEnumerable<string> signals, string window, CancellationToken ct = default)
    {
        var keys = string.Join(',', signals);
        return GetAsync<TrendResponseDto>($"api/trends?signals={Uri.EscapeDataString(keys)}&window={window}", ct);
    }

    public Task<FeedDiagnosticsDto?> GetFeedDiagnosticsAsync(CancellationToken ct = default) =>
        GetAsync<FeedDiagnosticsDto>("api/diagnostics/feed", ct);

    public Task<TagCatalogDto?> GetTagCatalogAsync(CancellationToken ct = default) =>
        GetAsync<TagCatalogDto>("api/tags", ct);

    public Task<Crm04.Domain.Tags.TagInventory?> GetTagInventoryAsync(CancellationToken ct = default) =>
        GetAsync<Crm04.Domain.Tags.TagInventory>("api/tags/inventory", ct);

    public Task<Crm04.Domain.Configuration.MillConfig?> GetMillConfigAsync(CancellationToken ct = default) =>
        GetAsync<Crm04.Domain.Configuration.MillConfig>("api/config/mill", ct);

    /// <summary>
    /// The pass schedule, fetched once and cached. It changes when a coil is charged, not per
    /// frame, so re-fetching it on a timer would be pure waste.
    /// </summary>
    public async Task<PassSchedule?> GetPassScheduleAsync(CancellationToken ct = default)
    {
        _passSchedule ??= await GetAsync<PassSchedule>("api/pass-schedule/current", ct);
        return _passSchedule;
    }

    private PassSchedule? _passSchedule;

    /// <summary>
    /// Ask the API to re-badge the feed.
    ///
    /// The cached trend catalogue is dropped because provenance is resolved PER MODE: the same
    /// signal is SIM in simulation and ESTIMATED or NO TAG on the live-feed rules, and a stale
    /// catalogue would keep showing the old badge beside the new numbers.
    /// </summary>
    public async Task<bool> SetModeAsync(OperatingMode mode, CancellationToken ct = default)
    {
        try
        {
            var response = await _http.PostAsync($"api/mode/{mode.ToWire()}", content: null, ct);
            if (!response.IsSuccessStatusCode) return false;

            _trendCatalog = null;
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogWarning(ex, "Mode switch to {Mode} failed.", mode);
            return false;
        }
    }

    /// <summary>
    /// A failed API call returns null rather than throwing.
    ///
    /// A control-room screen that throws because a chart request timed out is worse than one that
    /// keeps the last plot and says the feed is unreachable. The caller decides what an absent
    /// answer looks like; every caller here has a sensible empty state.
    /// </summary>
    private async Task<T?> GetAsync<T>(string path, CancellationToken ct) where T : class
    {
        try
        {
            return await _http.GetFromJsonAsync<T>(path, WireJson.Options, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogDebug(ex, "API request to {Path} failed.", path);
            return null;
        }
    }
}
