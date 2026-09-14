using Crm04.Domain.Types;

namespace Crm04.Domain.Simulation;

/// <summary>Where a reversal has got to. Port of the TypeScript <c>ReversalPhase</c> union.</summary>
public enum ReversalPhase
{
    /// <summary>Not reversing.</summary>
    None,

    /// <summary>Mill has stopped; brakes settling, tension held.</summary>
    Settle,

    /// <summary>Direction flag flips and entry/exit roles swap. Instantaneous.</summary>
    Flip,

    /// <summary>HAGC prepositions the gap for the next pass, reels take up new roles.</summary>
    Reposition,

    /// <summary>Sequence finished; the state machine may return to ROLLING.</summary>
    Complete,
}

/// <param name="Settle">Dwell at standstill before the flag flips, s.</param>
/// <param name="Reposition">Time for the HAGC to preposition and the reels to take up roles, s.</param>
public readonly record struct ReversalTimings(double Settle, double Reposition);

/// <param name="Phase">The active phase.</param>
/// <param name="Elapsed">Seconds spent in the current phase.</param>
/// <param name="PendingDirection">Direction the mill will roll in once the sequence completes.</param>
public readonly record struct ReversalState(
    ReversalPhase Phase,
    double Elapsed,
    RollingDirection? PendingDirection);

/// <summary>
/// REVERSING ENGINE - §9 of the master spec. Port of the sequencer half of
/// <c>src/machine/reversingEngine.ts</c>; the role derivation is in
/// <see cref="Crm04.Domain.Machine.ReversingRules"/>, which was ported earlier.
///
/// "Reversing sequence (no instant flip): speed ramps to zero -&gt; all motion stops -&gt;
/// direction flag changes -&gt; entry/exit roles swap -&gt; reel rotation directions swap -&gt;
/// strip accelerates the other way -&gt; direction indicator updates."
///
/// This module owns that sequence and nothing else. It is a pure sequencer: it is told how much
/// time has passed and what the mill is doing, and it reports which phase of the reversal is
/// active. The simulation engine applies the phase; the state machine owns the status.
/// </summary>
public static class ReversalSequencer
{
    /// <summary>
    /// Reversal dwell times. These are SEQUENCE timings, not physics - they stand in for the real
    /// mill's brake settling, reel role handover and gap prepositioning. Documented as assumptions
    /// in <c>docs/ASSUMPTIONS.md</c>.
    /// </summary>
    public static readonly ReversalTimings DefaultTimings = new(Settle: 1.6, Reposition: 2.2);

    public static readonly ReversalState Initial =
        new(ReversalPhase.None, Elapsed: 0, PendingDirection: null);

    public static ReversalState Start(
        RollingDirection currentDirection,
        RollingDirection? nextDirection = null) =>
        new(
            ReversalPhase.Settle,
            Elapsed: 0,
            PendingDirection: nextDirection ?? Opposite(currentDirection));

    public static RollingDirection Opposite(RollingDirection direction) =>
        direction == RollingDirection.Forward ? RollingDirection.Reverse : RollingDirection.Forward;

    /// <summary>
    /// Advance the sequence.
    ///
    /// <paramref name="speed"/> is passed in so the sequence physically cannot advance while the
    /// mill is still moving - the "no instant flip" rule is ENFORCED here rather than trusted to
    /// the caller. A caller that gets it wrong sends the sequence back to SETTLE with the clock
    /// reset, which is the safe direction to fail in.
    /// </summary>
    public static ReversalState Step(
        ReversalState state,
        double dt,
        double speed,
        ReversalTimings? timings = null)
    {
        var t = timings ?? DefaultTimings;

        if (state.Phase is ReversalPhase.None or ReversalPhase.Complete) return state;

        // Hard guard: no phase of a reversal runs while the strip is moving.
        if (Math.Abs(speed) > 0.05)
        {
            return state with { Phase = ReversalPhase.Settle, Elapsed = 0 };
        }

        var elapsed = state.Elapsed + dt;

        switch (state.Phase)
        {
            case ReversalPhase.Settle:
                if (elapsed >= t.Settle)
                {
                    return state with { Phase = ReversalPhase.Flip, Elapsed = 0 };
                }

                return state with { Elapsed = elapsed };

            case ReversalPhase.Flip:
                // FLIP is consumed by the simulation engine in a single tick - it applies the
                // direction change and role swap, then the sequence moves on.
                return state with { Phase = ReversalPhase.Reposition, Elapsed = 0 };

            case ReversalPhase.Reposition:
                if (elapsed >= t.Reposition)
                {
                    return state with { Phase = ReversalPhase.Complete, Elapsed = 0 };
                }

                return state with { Elapsed = elapsed };

            default:
                return state;
        }
    }

    /// <summary>Progress through the whole sequence, 0..1 - drives the reversal indicator.</summary>
    public static double Progress(ReversalState state, ReversalTimings? timings = null)
    {
        var t = timings ?? DefaultTimings;
        var total = t.Settle + t.Reposition;

        return state.Phase switch
        {
            ReversalPhase.None => 0,
            ReversalPhase.Settle => Math.Min(state.Elapsed / total, 1),
            ReversalPhase.Flip => t.Settle / total,
            ReversalPhase.Reposition => Math.Min((t.Settle + state.Elapsed) / total, 1),
            ReversalPhase.Complete => 1,
            _ => 0,
        };
    }
}
