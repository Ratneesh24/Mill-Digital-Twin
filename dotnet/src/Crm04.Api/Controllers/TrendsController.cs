using Crm04.Api.Services;
using Crm04.Api.Sources;
using Crm04.Contracts;
using Crm04.Domain.Tags;
using Crm04.Domain.Telemetry;
using Crm04.Domain.Types;
using Microsoft.AspNetCore.Mvc;

namespace Crm04.Api.Controllers;

/// <summary>
/// The trend history. Served from the in-memory ring buffers the frame publisher fills.
///
/// ONE HISTORY FOR EVERY VIEWER, held in the API rather than in each browser. A client that
/// connects at 10:05 sees the same last hour as one that connected at 09:00 — which the React
/// app's browser-side store could never do, because its buffers started when the tab opened.
///
/// Reads never touch the 10 Hz path: the buffers are already downsampled to 240 points per
/// window, so a chart request is a copy of at most 240 doubles per series.
/// </summary>
[ApiController]
[Route("api/trends")]
public sealed class TrendsController : ControllerBase
{
    private readonly TrendStore _trends;
    private readonly IFrameSource _source;
    private readonly LiveStateService _live;

    public TrendsController(TrendStore trends, IFrameSource source, LiveStateService live)
    {
        _trends = trends;
        _source = source;
        _live = live;
    }

    /// <summary>
    /// The signals on offer, with provenance resolved for the active mode.
    ///
    /// <c>AvailableOnThisFeed</c> is what lets the signal browser grey out the series this feed
    /// cannot supply, instead of offering forty choices of which a dozen would draw nothing and
    /// leave the operator wondering whether the chart is broken.
    /// </summary>
    [HttpGet("catalog")]
    public ActionResult<TrendCatalogDto> Catalog()
    {
        var mode = _source.Mode;

        var signals = SignalCatalog.All.Select(s =>
        {
            var def = TagCatalog.TryGet(s.TagName);
            var provenance = def is null
                ? Provenance.Unavailable
                : TagFactory.ResolveProvenance(def, mode);

            return new TrendSignalDto(
                Key: s.Key,
                Label: s.Label,
                Unit: s.Unit,
                Color: s.Color,
                Decimals: s.Decimals,
                Group: s.Group,
                TagName: s.TagName,
                IsReference: s.IsReference,
                Provenance: provenance,
                LiveNote: def?.LiveNote,
                AvailableOnThisFeed: provenance != Provenance.Unavailable);
        }).ToList();

        return Ok(new TrendCatalogDto(
            Signals: signals,
            Groups: SignalCatalog.Groups,
            Windows: SignalCatalog.Windows.Select(w => w.Key).ToList()));
    }

    /// <summary>
    /// Points for the requested signals over the requested window.
    /// </summary>
    /// <param name="signals">Comma-separated signal keys.</param>
    /// <param name="window">"1m" | "5m" | "15m" | "30m" | "1h".</param>
    [HttpGet]
    public ActionResult<TrendResponseDto> Get([FromQuery] string? signals, [FromQuery] string window = "5m")
    {
        var requested = (signals ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            // The chart is legible up to about eight series; beyond that the colours stop being
            // distinguishable and the legend outgrows the plot.
            .Take(8)
            .ToList();

        var trendWindow = SignalCatalog.TryGetWindow(window) ?? SignalCatalog.DefaultWindow;

        var series = new List<TrendSeriesDto>(requested.Count);
        var limits = new Dictionary<string, TrendLimitDto>(StringComparer.Ordinal);

        foreach (var key in requested)
        {
            if (SignalCatalog.TryGet(key) is not { } descriptor) continue;

            var points = _trends.Read(key, trendWindow.Key);

            var t = new long[points.Length];
            var v = new double[points.Length];
            for (var i = 0; i < points.Length; i++)
            {
                t[i] = points[i].T;
                v[i] = points[i].V;
            }

            series.Add(new TrendSeriesDto(key, t, v));

            // Reference lines come from the tag's configured bounds — the SAME numbers the alarm
            // engine compares against. A chart whose limit lines were hand-placed would eventually
            // disagree with the alarms and nobody would know which was right.
            var def = TagCatalog.TryGet(descriptor.TagName);
            if (def is not null && !def.Limits.IsEmpty)
            {
                limits[key] = new TrendLimitDto(
                    def.Limits.WarningLow, def.Limits.WarningHigh,
                    def.Limits.AlarmLow, def.Limits.AlarmHigh,
                    def.Limits.TripHigh);
            }
        }

        return Ok(new TrendResponseDto(trendWindow.Key, trendWindow.Ms, series, limits));
    }

    /// <summary>How much history exists yet. The trend page uses it to explain an empty chart.</summary>
    [HttpGet("status")]
    public ActionResult<object> Status() => Ok(new
    {
        samplesRecorded = _trends.SamplesRecorded,
        pointsPerWindow = SignalCatalog.Windows.ToDictionary(w => w.Key, w => _trends.PointCount(w.Key)),
        framesReceived = _live.Communication.FramesReceived,
        signals = SignalCatalog.Count,
    });
}
