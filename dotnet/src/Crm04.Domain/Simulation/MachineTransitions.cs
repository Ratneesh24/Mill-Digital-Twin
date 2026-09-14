using Crm04.Domain.Machine;
using Crm04.Domain.Types;

namespace Crm04.Domain.Simulation;

/// <summary>
/// Everything that can move the mill between states. Port of the TypeScript
/// <c>MachineCommand | MachineSignal</c> union.
///
/// Commands come from the operator; signals come from the simulation noticing something. They
/// share one enum because <see cref="MachineTransitions.Transition"/> takes one event argument,
/// exactly as the TypeScript does - and because FAST_STOP is both.
/// </summary>
public enum MachineEventType
{
    // Commands
    Enable,
    Start,
    Stop,
    FastStop,
    Reset,
    RequestRollChange,

    // Signals
    Threaded,
    AtSpeed,
    SpeedZero,
    PassComplete,
    ReversalComplete,
    ScheduleComplete,
    InterlockLost,
    InterlockOk,
    Fault,
}

/// <summary>What the mill is doing and what the interlock chain says, at the moment of an event.</summary>
/// <param name="MillReady">MILL READY from the interlock chain (§13.2).</param>
/// <param name="InterlockReason">Reason the interlock chain is blocking, if it is.</param>
/// <param name="Speed">Current mill speed, m/min.</param>
/// <param name="Threaded">True while the strip is threaded through the bite and both reels.</param>
/// <param name="ScheduleComplete">True when the last scheduled pass has finished.</param>
public readonly record struct TransitionContext(
    bool MillReady,
    string? InterlockReason,
    double Speed,
    bool Threaded,
    bool ScheduleComplete);

/// <param name="Status">The status after the event.</param>
/// <param name="Reason">Why the mill is in that status. Never empty - see the class remarks.</param>
/// <param name="Changed">True when the status actually changed - used to emit an event (§11.4).</param>
public readonly record struct TransitionResult(MachineStatus Status, string Reason, bool Changed);

/// <summary>
/// MACHINE STATE MACHINE - §9 of the master spec. Port of
/// <c>src/machine/machineStateMachine.ts</c>'s transition half; the predicates and labels are in
/// <see cref="MachineStatusRules"/>, which was ported earlier.
///
/// ALL status transitions go through this module. No component, and no other engine, may set
/// <c>machineStatus</c> directly. That single rule is what stops the classic twin failure where
/// the 3D scene believes the mill is rolling while the status banner says STOPPED.
///
/// EVERY TRANSITION RETURNS A REASON. §13.2 forbids a bare "NOT READY", and the same principle
/// applies to every state: the operator must always be able to see why the mill is in the state it
/// is in. The reason says what the MILL is doing. It deliberately never claims anything about
/// interlock health - that claim belongs to the interlock chain, which on a feed without interlock
/// tags can only report "unverified" (§7.4). A status banner asserting "all interlocks healthy"
/// beside a panel saying it cannot see them is the kind of quiet contradiction §18 exists to catch.
///
/// The reason strings are reproduced CHARACTER FOR CHARACTER, em dashes included. They reach the
/// operator's screen and the parity gate compares them by ordinal equality.
/// </summary>
public static class MachineTransitions
{
    /// <summary>
    /// The transition table.
    ///
    /// Structured as (event -&gt; handler) rather than (state -&gt; event -&gt; state) because
    /// several events (FAST_STOP, FAULT) are valid from ANY state and encoding them per-state
    /// would invite a missed case.
    /// </summary>
    public static TransitionResult Transition(
        MachineStatus current,
        MachineEventType e,
        TransitionContext ctx)
    {
        TransitionResult Result(MachineStatus status, string reason) =>
            new(status, reason, Changed: status != current);

        // ---- Events valid from ANY state -------------------------------------
        switch (e)
        {
            case MachineEventType.FastStop:
                // §9: ANY -> (E-stop / fast stop) -> FAST_STOP -> STOPPED
                return Result(MachineStatus.FastStop, "Fast stop initiated");

            case MachineEventType.Fault:
                return Result(MachineStatus.Fault, ctx.InterlockReason ?? "Fault detected");

            case MachineEventType.Reset:
                if (current is MachineStatus.FastStop or MachineStatus.Fault or MachineStatus.Stopped)
                {
                    return ctx.MillReady
                        ? Result(MachineStatus.Ready, "Mill ready")
                        : Result(MachineStatus.Idle, ctx.InterlockReason ?? "Mill not ready");
                }

                return Result(current, "Reset ignored — mill is not in a resettable state");

            default:
                break;
        }

        // ---- FAST_STOP is a terminal ramp: it ends at STOPPED, nothing else ----
        if (current == MachineStatus.FastStop)
        {
            if (e == MachineEventType.SpeedZero)
            {
                return Result(MachineStatus.Stopped, "Fast stop complete — mill at standstill");
            }

            return Result(current, "Fast stop in progress");
        }

        if (current == MachineStatus.Fault)
        {
            return Result(current, ctx.InterlockReason ?? "Fault active — reset required");
        }

        // ---- Interlock chain ---------------------------------------------------
        if (e == MachineEventType.InterlockLost)
        {
            if (MachineStatusRules.IsMoving(current))
            {
                return Result(
                    MachineStatus.Decelerating,
                    ctx.InterlockReason ?? "Interlock lost while running");
            }

            return Result(MachineStatus.Idle, ctx.InterlockReason ?? "Interlock lost");
        }

        if (e == MachineEventType.InterlockOk)
        {
            if (current == MachineStatus.Idle) return Result(MachineStatus.Ready, "Mill ready");
            return Result(current, "Mill ready");
        }

        // ---- Normal operating events ------------------------------------------
        switch (e)
        {
            case MachineEventType.Enable:
                if (current == MachineStatus.Idle)
                {
                    return ctx.MillReady
                        ? Result(MachineStatus.Ready, "Mill ready")
                        : Result(MachineStatus.Idle, ctx.InterlockReason ?? "Mill not ready");
                }

                return Result(current, "Enable ignored");

            case MachineEventType.Start:
                if (!MachineStatusRules.IsStartable(current))
                {
                    // The TypeScript interpolates the raw status literal, not the display label -
                    // "Start ignored — mill is FAST_STOP", not "... FAST STOP". Use the wire name.
                    return Result(current, $"Start ignored — mill is {current.ToWire()}");
                }

                if (!ctx.MillReady)
                {
                    return Result(current, ctx.InterlockReason ?? "Mill not ready");
                }

                // A threaded mill goes straight to rolling; an unthreaded one threads first.
                return ctx.Threaded
                    ? Result(MachineStatus.Rolling, "Rolling")
                    : Result(MachineStatus.Threading, "Threading strip to the bite");

            case MachineEventType.Threaded:
                if (current == MachineStatus.Threading) return Result(MachineStatus.Rolling, "Rolling");
                return Result(current, "Threaded");

            case MachineEventType.AtSpeed:
                if (current == MachineStatus.Rolling) return Result(current, "Rolling at speed reference");
                return Result(current, "At speed");

            case MachineEventType.Stop:
                if (MachineStatusRules.IsMoving(current))
                {
                    return Result(MachineStatus.Decelerating, "Stop requested — decelerating");
                }

                if (current == MachineStatus.Reversing)
                {
                    return Result(MachineStatus.Decelerating, "Stop requested during reversal");
                }

                return Result(current, "Stop ignored — mill is already stopped");

            case MachineEventType.PassComplete:
                // §9: ROLLING -> DECELERATING -> STOPPED -> REVERSING -> ROLLING.
                // A pass ending does NOT flip direction on the spot; it starts a ramp.
                if (current is MachineStatus.Rolling or MachineStatus.SkinPass)
                {
                    return ctx.ScheduleComplete
                        ? Result(MachineStatus.Decelerating, "Final pass complete — decelerating")
                        : Result(MachineStatus.Decelerating, "Pass complete — decelerating for reversal");
                }

                return Result(current, "Pass complete");

            case MachineEventType.SpeedZero:
                if (current == MachineStatus.Decelerating)
                {
                    if (ctx.ScheduleComplete)
                    {
                        return Result(MachineStatus.Stopped, "Schedule complete — coil finished");
                    }

                    return Result(MachineStatus.Stopped, "Mill at standstill");
                }

                return Result(current, "Mill at standstill");

            case MachineEventType.ReversalComplete:
                if (current == MachineStatus.Reversing) return Result(MachineStatus.Rolling, "Rolling");
                return Result(current, "Reversal complete");

            case MachineEventType.ScheduleComplete:
                return Result(MachineStatus.Stopped, "Schedule complete — coil finished");

            case MachineEventType.RequestRollChange:
                if (current is MachineStatus.Stopped or MachineStatus.Idle or MachineStatus.Ready)
                {
                    return Result(MachineStatus.RollChange, "Roll change in progress");
                }

                return Result(current, "Roll change ignored — mill must be stopped first");

            default:
                return Result(current, "No change");
        }
    }

    /// <summary>
    /// Begin a reversal. Kept separate from <see cref="Transition"/> because entering REVERSING is
    /// a decision made by the reversing engine once the mill has genuinely reached standstill -
    /// never on the pass-complete event itself.
    /// </summary>
    public static TransitionResult BeginReversal(MachineStatus current)
    {
        if (current != MachineStatus.Stopped)
        {
            return new TransitionResult(current, "Reversal requires standstill first", Changed: false);
        }

        return new TransitionResult(
            MachineStatus.Reversing, "Reversing — swapping entry / exit roles", Changed: true);
    }
}
