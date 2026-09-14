using Crm04.Domain.Types;

namespace Crm04.Domain.Machine;

/// <summary>
/// The status predicates and labels from <c>src/machine/machineStateMachine.ts</c>.
///
/// This is the CLASSIFICATION half of that module - "is the mill moving", "may it start", "what
/// does the banner say". It is read by the alarm engine, the UI and the transition table alike.
/// The transition table itself lives in
/// <see cref="Crm04.Domain.Simulation.MachineTransitions"/>, in the Simulation namespace, because
/// it is what DRIVES the mill rather than what describes it - and because a feed that replays
/// recorded frames has a status without ever calling it.
/// </summary>
public static class MachineStatusRules
{
    private static readonly HashSet<MachineStatus> Moving =
    [
        MachineStatus.Threading,
        MachineStatus.Rolling,
        MachineStatus.Decelerating,
        MachineStatus.SkinPass,
        MachineStatus.Rewind,
    ];

    private static readonly HashSet<MachineStatus> Startable =
    [
        MachineStatus.Ready,
        MachineStatus.Stopped,
        MachineStatus.Idle,
    ];

    /// <summary>States in which the mill is producing motion.</summary>
    public static bool IsMoving(MachineStatus status) => Moving.Contains(status);

    /// <summary>
    /// Whether a normal START is meaningful from this state. FAST_STOP is deliberately absent:
    /// a fast stop must be RESET before the mill will accept a start, which is how the real mill
    /// behaves.
    /// </summary>
    public static bool IsStartable(MachineStatus status) => Startable.Contains(status);

    /// <summary>
    /// Whether the mill is allowed to develop rolling force. REVERSING holds the strip but does
    /// not roll, so force must fall to the standstill value - a twin that keeps showing rolling
    /// force through a reversal is showing a value the mill is not producing.
    /// </summary>
    public static bool IsRolling(MachineStatus status) =>
        status is MachineStatus.Rolling or MachineStatus.SkinPass or MachineStatus.Decelerating;

    /// <summary>Human-readable status text for the status banner (§11.4).</summary>
    public static string Label(MachineStatus status) => status switch
    {
        MachineStatus.Idle => "IDLE",
        MachineStatus.Ready => "READY",
        MachineStatus.Threading => "THREADING",
        MachineStatus.Rolling => "ROLLING",
        MachineStatus.Decelerating => "DECELERATING",
        MachineStatus.Reversing => "REVERSING",
        MachineStatus.Stopped => "STOPPED",
        MachineStatus.FastStop => "FAST STOP",
        MachineStatus.Warmup => "WARM UP",
        MachineStatus.SkinPass => "SKIN PASS",
        MachineStatus.Rewind => "REWIND",
        MachineStatus.RollChange => "ROLL CHANGE",
        MachineStatus.Fault => "FAULT",
        _ => "UNKNOWN",
    };
}
