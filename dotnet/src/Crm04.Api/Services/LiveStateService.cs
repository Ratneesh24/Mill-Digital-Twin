using Crm04.Contracts;
using Crm04.Domain.Machine;
using Crm04.Domain.Projection;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

namespace Crm04.Api.Services;

/// <summary>
/// The C# counterpart of the TypeScript <c>machineStore</c>: the single place that holds the one
/// authoritative <see cref="MachineState"/>, the current tag frame, the comm state and the
/// interlock chain.
///
/// A singleton, and deliberately so. Every viewer is looking at the same mill, so there is one
/// state for the whole process rather than one per connection - which is also what makes a new
/// client's first render instant instead of a wait for the next frame.
///
/// It also owns the two things the projection cannot compute for itself: how healthy our link to
/// the source is, and how fast frames are actually arriving. Both are properties of the
/// connection, not of the machine.
/// </summary>
public sealed class LiveStateService
{
    private readonly object _gate = new();

    // A rolling window of arrival times, for the measured update rate. Small on purpose: the
    // point is "what is the feed doing now", not a long-run average that hides a recent stall.
    private readonly Queue<long> _arrivals = new();
    private const int RateWindow = 20;

    private MachineState _state = MachineStateProjector.Empty(OperatingMode.Simulation);
    private TagFrame _tags = TagFrame.Empty(OperatingMode.Simulation);
    private InterlockChain _interlocks = InterlockChain.Empty;
    private IReadOnlyList<AlarmCondition> _alarms = [];
    private CommState _comm = CommState.Disconnected;

    public long FramesReceived { get; private set; }

    public long FrameId { get; private set; }

    public string SourceId { get; private set; } = "none";

    public MachineState State { get { lock (_gate) return _state; } }

    public TagFrame Tags { get { lock (_gate) return _tags; } }

    public InterlockChain Interlocks { get { lock (_gate) return _interlocks; } }

    public IReadOnlyList<AlarmCondition> Alarms { get { lock (_gate) return _alarms; } }

    public CommState Communication { get { lock (_gate) return _comm; } }

    /// <summary>The most recent envelope, so a newly connected client renders immediately.</summary>
    public TelemetryEnvelope? Latest { get; private set; }

    /// <summary>
    /// Update the comm state for a frame that has just arrived, and return it.
    ///
    /// <paramref name="ageMs"/> is the gap since the PREVIOUS frame, not the age of this one -
    /// a frame that has just landed is by definition current. It is the gap that tells you
    /// whether the feed is keeping up.
    /// </summary>
    public CommState OnFrameArrived(long nowMs, string sourceId)
    {
        lock (_gate)
        {
            var previous = _comm.LastFrameTimestamp;
            FramesReceived++;
            SourceId = sourceId;

            _arrivals.Enqueue(nowMs);
            while (_arrivals.Count > RateWindow) _arrivals.Dequeue();

            var rateHz = 0d;
            if (_arrivals.Count >= 2)
            {
                var span = _arrivals.Last() - _arrivals.First();
                if (span > 0) rateHz = (_arrivals.Count - 1) * 1000d / span;
            }

            _comm = new CommState(
                Connected: true,
                SourceName: sourceId,
                LastFrameTimestamp: nowMs,
                LastValidTimestamp: nowMs,
                AgeMs: previous == 0 ? 0d : nowMs - previous,
                Stale: false,
                UpdateRateHz: rateHz,
                FramesReceived: FramesReceived);

            return _comm;
        }
    }

    /// <summary>
    /// Re-age the comm state without a new frame. Called by the staleness watchdog, which is what
    /// notices a source that has gone quiet - the absence of frames cannot announce itself.
    /// </summary>
    public CommState Age(long nowMs, int staleAfterMs)
    {
        lock (_gate)
        {
            if (_comm.LastFrameTimestamp == 0) return _comm;

            var age = (double)(nowMs - _comm.LastFrameTimestamp);
            _comm = _comm with { AgeMs = age, Stale = age > staleAfterMs };
            return _comm;
        }
    }

    public void Commit(
        long frameId,
        MachineState state,
        TagFrame tags,
        InterlockChain interlocks,
        IReadOnlyList<AlarmCondition> alarms,
        TelemetryEnvelope envelope)
    {
        lock (_gate)
        {
            FrameId = frameId;
            _state = state;
            _tags = tags;
            _interlocks = interlocks;
            _alarms = alarms;
            Latest = envelope;
        }
    }
}
