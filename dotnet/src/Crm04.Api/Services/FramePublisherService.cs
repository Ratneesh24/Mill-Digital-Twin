using System.Diagnostics;
using Crm04.Api.Hubs;
using Crm04.Api.Sources;
using Crm04.Contracts;
using Crm04.Domain.Configuration;
using Crm04.Domain.Machine;
using Crm04.Domain.Projection;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Microsoft.AspNetCore.SignalR;

namespace Crm04.Api.Services;

/// <summary>
/// THE PIPELINE. Pulls a frame from the source every 100 ms, runs it through the ported domain,
/// and fans the result out over SignalR.
///
///   source -> TagFactory.MakeFrame        badge every value (§7.3)
///          -> MachineStateProjector       the one authoritative MachineState (§4)
///          -> InterlockEngine             the ready chain, naming its blocker (§13.2)
///          -> AlarmEngine                 which conditions are true right now (§13.1)
///          -> TelemetryHub                one envelope, one message
///
/// That order is not arbitrary - it is the order <c>machineStore.applyFrame</c> uses in the
/// TypeScript app, and keeping it is what makes the golden parity fixtures meaningful: the same
/// inputs go through the same steps in the same sequence, so the same outputs are expected.
///
/// It also runs the staleness watchdog. A source that stops sending cannot announce that it has
/// stopped, so something has to notice the silence; without it the twin would sit showing the
/// last frame forever, looking perfectly healthy.
/// </summary>
public sealed class FramePublisherService : BackgroundService
{
    private readonly IFrameSource _source;
    private readonly LiveStateService _live;
    private readonly IHubContext<TelemetryHub> _hub;
    private readonly TwinFeed _twinFeed;
    private readonly SignalSampler _sampler;
    private readonly ILogger<FramePublisherService> _log;

    // Pipeline timings, for the diagnostics endpoint. A ring rather than a growing list: this is
    // "how is it behaving now", and it must not become a memory leak on a 24/7 process.
    private readonly double[] _pipelineMs = new double[256];
    private int _pipelineCount;

    public FramePublisherService(
        IFrameSource source,
        LiveStateService live,
        IHubContext<TelemetryHub> hub,
        TwinFeed twinFeed,
        SignalSampler sampler,
        ILogger<FramePublisherService> log)
    {
        _source = source;
        _live = live;
        _hub = hub;
        _twinFeed = twinFeed;
        _sampler = sampler;
        _log = log;
    }

    public bool Running { get; private set; }

    public long FramesPublished { get; private set; }

    public double PipelineMsP50 => Percentile(0.50);

    public double PipelineMsP99 => Percentile(0.99);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            await _source.StartAsync(ct);
        }
        catch (Exception ex)
        {
            // Starting with no source is not a degraded mode worth limping along in - every
            // readout would show NO DATA and the cause would be buried in a log line. Say it once,
            // clearly, and leave the API up so /api/diagnostics/feed can be asked what happened.
            _log.LogError(ex, "Frame source failed to start. The API will serve no telemetry.");
            return;
        }

        Running = true;
        _log.LogInformation(
            "Publishing from {SourceId} at {Rate} Hz in {Mode} mode.",
            _source.SourceId,
            1000 / EngineeringConfig.FrameTickMs,
            _source.Mode.ToWire());

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(EngineeringConfig.FrameTickMs));
        var sw = new Stopwatch();

        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                var frame = await _source.NextFrameAsync(ct);

                if (frame is null)
                {
                    // No new frame this tick. Re-age the comm state so a source that has gone
                    // quiet is reported as stale rather than as merely unchanged.
                    await PublishStalenessAsync(ct);
                    continue;
                }

                sw.Restart();
                await PublishAsync(frame, ct);
                sw.Stop();

                _pipelineMs[_pipelineCount % _pipelineMs.Length] = sw.Elapsed.TotalMilliseconds;
                _pipelineCount++;
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                // One bad frame must not take the feed down. Log and carry on - the next frame is
                // 100 ms away, and a twin that stops entirely is worse than one that skips.
                _log.LogError(ex, "Frame publish failed; continuing.");
            }
        }

        Running = false;
    }

    private async Task PublishAsync(SourceFrame frame, CancellationToken ct)
    {
        // 1. COMM. How healthy is our own link? Owned by the service, not derivable from tags.
        var comm = _live.OnFrameArrived(frame.TimestampMs, _source.SourceId);

        // 2. TAGS. The only Tag constructor. Provenance and quality are decided here, once.
        var tags = TagFactory.MakeFrame(frame.Values, frame.TimestampMs, _source.Mode);

        // 3. STATE. The only MachineState constructor.
        var state = MachineStateProjector.Project(
            tags,
            new AdapterContext(
                Mode: _source.Mode,
                Communication: comm,
                Diagnostics: new DiagnosticsState(
                    MassFlowErrorPct: 0d,
                    GaugemeterResidualUm: frame.GaugemeterResidualUm,
                    SolverIterations: frame.SolverIterations)));

        // 4. INTERLOCKS and 5. ALARMS. Both pure functions of the state.
        var chain = InterlockEngine.Evaluate(InterlockInputs.From(state));
        var alarms = AlarmEngine.Evaluate(state);

        var envelope = new TelemetryEnvelope(
            Frame: WireMapper.Frame(frame.FrameId, tags),
            Summary: WireMapper.Summary(state),
            Alarms: alarms.Select(WireMapper.Alarm).ToList(),
            Interlocks: WireMapper.Interlocks(chain));

        _live.Commit(frame.FrameId, state, tags, chain, alarms, envelope);

        // 6. TRENDS. Downsampled on write inside the store, so this is an array add per signal
        // rather than anything a 10 Hz loop needs to worry about.
        _sampler.Sample(state);

        FramesPublished++;

        // 7. FAN OUT on two hubs. The dashboard gets the full envelope; the 3D scene gets only
        // the ~180 bytes of geometry it needs, on its own connection, bypassing Blazor entirely.
        await _hub.Clients.All.SendAsync("Frame", envelope, ct);
        await _twinFeed.BroadcastAsync(TwinEngine.Derive(state), ct);
    }

    /// <summary>
    /// Re-publish with an aged comm state when no frame arrived.
    ///
    /// Only once the feed has actually gone stale, and only once per second after that - there is
    /// no value in re-sending an unchanged frame at 10 Hz to tell a client nothing happened, but
    /// there is real value in the moment it crosses the threshold: the readouts strike through,
    /// the twin freezes, and COMMUNICATION_LOST raises.
    /// </summary>
    private async Task PublishStalenessAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var comm = _live.Age(now, EngineeringConfig.StaleAfterMs);

        if (!comm.Stale || _live.Latest is null) return;
        if (now % 1000 >= EngineeringConfig.FrameTickMs) return;

        var tags = TagFactory.MarkStale(_live.Tags);
        var state = MachineStateProjector.Project(
            tags,
            new AdapterContext(_source.Mode, comm, _live.State.Diagnostics));

        var chain = InterlockEngine.Evaluate(InterlockInputs.From(state));
        var alarms = AlarmEngine.Evaluate(state);

        var envelope = new TelemetryEnvelope(
            Frame: WireMapper.Frame(_live.FrameId, tags),
            Summary: WireMapper.Summary(state),
            Alarms: alarms.Select(WireMapper.Alarm).ToList(),
            Interlocks: WireMapper.Interlocks(chain));

        _live.Commit(_live.FrameId, state, tags, chain, alarms, envelope);
        await _hub.Clients.All.SendAsync("Frame", envelope, ct);
        // The 3D scene is on its own socket: without this broadcast it keeps integrating the
        // last live targets forever (§14.5 freeze). Derive carries stale → animate:false, which
        // stops rotation and travel dead in the browser engine.
        await _twinFeed.BroadcastAsync(TwinEngine.Derive(state), ct);
    }

    private double Percentile(double p)
    {
        var n = Math.Min(_pipelineCount, _pipelineMs.Length);
        if (n == 0) return 0d;

        var copy = new double[n];
        Array.Copy(_pipelineMs, copy, n);
        Array.Sort(copy);
        return copy[Math.Clamp((int)(p * (n - 1)), 0, n - 1)];
    }
}
