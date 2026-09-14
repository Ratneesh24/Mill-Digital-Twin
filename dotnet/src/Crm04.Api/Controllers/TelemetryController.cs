using Crm04.Api.Services;
using Crm04.Api.Sources;
using Crm04.Contracts;
using Crm04.Domain.Configuration;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Microsoft.AspNetCore.Mvc;

namespace Crm04.Api.Controllers;

/// <summary>
/// The read surface. Everything here is served from <see cref="LiveStateService"/> - the
/// in-memory snapshot the publisher just committed - so a request costs nothing and can never
/// disagree with what the hub is pushing.
/// </summary>
[ApiController]
[Route("api")]
public sealed class TelemetryController : ControllerBase
{
    private readonly LiveStateService _live;
    private readonly IFrameSource _source;
    private readonly FramePublisherService _publisher;

    public TelemetryController(LiveStateService live, IFrameSource source, FramePublisherService publisher)
    {
        _live = live;
        _source = source;
        _publisher = publisher;
    }

    /// <summary>The static tag catalogue for the active mode, with provenance already resolved.</summary>
    [HttpGet("tags")]
    public ActionResult<TagCatalogDto> Tags()
    {
        var catalog = WireMapper.Catalog(_source.Mode);

        // The catalogue changes only on redeploy, so it is worth an ETag: a reconnecting client
        // skips ~40 KB it already has.
        var etag = $"\"{catalog.Etag}\"";
        if (Request.Headers.IfNoneMatch.ToString() == etag) return StatusCode(StatusCodes.Status304NotModified);

        Response.Headers.ETag = etag;
        Response.Headers.CacheControl = "private, max-age=60";
        return Ok(catalog);
    }

    /// <summary>§7.4 availability counts - the honest answer to "how much of this screen is real?".</summary>
    [HttpGet("tags/inventory")]
    public ActionResult<TagInventory> Inventory() => Ok(TagCatalog.Inventory);

    /// <summary>
    /// Switch the operating mode.
    ///
    /// This does NOT let a client choose a friendlier badge for a value. It changes which §7.4
    /// availability rules the SERVER applies when it builds the next frame, so the answer still
    /// comes from TagFactory and the catalogue. What it enables is the 46-tag rehearsal: the same
    /// numbers, shown with the provenance they will carry on the real CRM04 extract, so you can
    /// see how much of the dashboard survives contact with the real feed before it arrives.
    /// </summary>
    [HttpPost("mode/{mode}")]
    public ActionResult SetMode(string mode)
    {
        if (!WireNames.TryParseOperatingMode(mode, out var parsed))
        {
            return BadRequest($"Unknown mode '{mode}'. Expected SIMULATION, SIM_46TAG or LIVE.");
        }

        return _source.TrySetMode(parsed)
            ? NoContent()
            : Conflict($"The active source cannot serve {parsed.ToWire()}.");
    }

    /// <summary>The latest full envelope: tags, summary, alarms and interlocks for one instant.</summary>
    [HttpGet("telemetry/latest")]
    public ActionResult<TelemetryEnvelope> Latest() =>
        _live.Latest is { } e ? Ok(e) : StatusCode(StatusCodes.Status503ServiceUnavailable, "No frame received yet.");

    /// <summary>The structured mill summary alone.</summary>
    [HttpGet("state")]
    public ActionResult<MillSummaryDto> State() => Ok(WireMapper.Summary(_live.State));

    [HttpGet("alarms/active")]
    public ActionResult<IReadOnlyList<AlarmDto>> Alarms() =>
        Ok(_live.Alarms.Select(WireMapper.Alarm).ToList());

    [HttpGet("interlocks")]
    public ActionResult<InterlockChainDto> Interlocks() => Ok(WireMapper.Interlocks(_live.Interlocks));

    /// <summary>
    /// The whole mill configuration. Served rather than baked into the client because the 3D
    /// scene, the plant-config page and the physics reference must all read the same dimensions -
    /// the same guarantee <c>millConfig.ts</c> gives the React app today.
    /// </summary>
    [HttpGet("config/mill")]
    public ActionResult<MillConfig> MillConfiguration() => Ok(MillConfig.Default);

    /// <summary>
    /// The pass schedule the mill is working to, and the coil it applies to.
    ///
    /// Currently the demo schedule. On a plant deployment this comes from the PASS_SCHEDULE
    /// tables; the panel states which, because a representative schedule must never be mistaken
    /// for the plan a real coil is being rolled to.
    /// </summary>
    [HttpGet("pass-schedule/current")]
    public ActionResult<Domain.Coils.PassSchedule> PassScheduleCurrent() => Ok(Domain.Coils.PassSchedule.Demo);

    /// <summary>Is what I am looking at current? The feed's own vital signs.</summary>
    [HttpGet("diagnostics/feed")]
    public ActionResult<FeedDiagnosticsDto> Diagnostics()
    {
        var comm = _live.Communication;
        return Ok(new FeedDiagnosticsDto(
            SourceId: _live.SourceId,
            Running: _publisher.Running,
            FramesPublished: _publisher.FramesPublished,
            FrameId: _live.FrameId,
            PublishRateHz: comm.UpdateRateHz,
            LastFrameAgeMs: comm.LastFrameTimestamp == 0
                ? 0d
                : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - comm.LastFrameTimestamp,
            Stale: comm.Stale,
            TagsInFrame: _live.Tags.Count,
            CatalogueSize: TagCatalog.Count,
            PipelineMsP50: _publisher.PipelineMsP50,
            PipelineMsP99: _publisher.PipelineMsP99));
    }
}
