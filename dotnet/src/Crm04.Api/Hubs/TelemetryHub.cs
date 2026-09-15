using Crm04.Api.Services;
using Crm04.Api.Sources;
using Crm04.Contracts;
using Microsoft.AspNetCore.SignalR;

namespace Crm04.Api.Hubs;

/// <summary>
/// The 10 Hz telemetry feed.
///
/// Consumed by the Blazor server PROCESS, not by each browser - one hub connection per web
/// process, whose render diffs then fan out to the circuits. That is what keeps a control room
/// with a dozen screens open from opening a dozen upstream connections for identical data.
///
/// Server-to-client is one message, <c>Frame</c>, carrying a <see cref="TelemetryEnvelope"/>.
/// One message rather than four, so a client can never paint one frame's tags beside another
/// frame's alarms.
/// </summary>
public sealed class TelemetryHub : Hub
{
    private readonly LiveStateService _live;
    private readonly IFrameSource _source;

    public TelemetryHub(LiveStateService live, IFrameSource source)
    {
        _live = live;
        _source = source;
    }

    /// <summary>
    /// A newly connected client gets the current state immediately rather than waiting up to
    /// 100 ms for the next frame. On a page that opens with every readout dashed out, that wait
    /// is visible.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        if (_live.Latest is { } envelope)
        {
            await Clients.Caller.SendAsync("Frame", envelope);
        }

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// The static tag catalogue. Fetched once per connection and cached by the client; it is what
    /// turns the ordinal-indexed frame arrays back into named, badged tags.
    ///
    /// Resolved from the SOURCE's mode, the same as <c>GET api/tags</c>. It used to read
    /// <c>_live.State.OperatingMode</c>, which before the first frame is the empty state's
    /// placeholder mode - so a client connecting ahead of the feed cached a catalogue badged for a
    /// mode no source had ever declared.
    /// </summary>
    public TagCatalogDto GetCatalog() => WireMapper.Catalog(_source.Mode);

    /// <summary>The current envelope, for a client that wants to re-sync without reconnecting.</summary>
    public TelemetryEnvelope? GetSnapshot() => _live.Latest;
}
