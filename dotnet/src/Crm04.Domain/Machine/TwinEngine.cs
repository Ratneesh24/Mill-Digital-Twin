using Crm04.Domain.Configuration;
using Crm04.Domain.Types;

namespace Crm04.Domain.Machine;

/// <summary>
/// Everything the 3D scene needs for one instant, and nothing else. Port of <c>TwinTargets</c>
/// in <c>src/machine/twinEngine.ts</c>.
///
/// This is deliberately tiny - about 22 numbers and three flags, ~180 bytes on the wire against
/// the ~1.4 KB of a full tag frame. The scene does not need tags; it needs geometry. Sending it
/// this instead of the frame is what lets the twin run at 10 Hz over its own connection without
/// touching the Blazor circuit.
///
/// Every value is DERIVED FROM THE ONE MachineState, server-side. That is what keeps the number
/// on the KPI tile and the position of the roll in the scene provably the same statement (§18).
/// </summary>
/// <param name="DirectionSign">+1 forward, -1 reverse.</param>
/// <param name="StripSpeed">Exit strip speed, m/min.</param>
/// <param name="EntryStripSpeed">Entry strip speed from mass flow, m/min.</param>
/// <param name="WrRpm">Work roll speed, rpm. Magnitude only - the sign comes from the direction.</param>
/// <param name="RollGap">Loaded roll gap, mm - the delivered thickness.</param>
/// <param name="ForceNormalised">Roll force as a fraction of the mill's maximum, 0..1.</param>
/// <param name="ForceEstimated">
/// True when the force number is model output rather than measurement (SIM_46TAG rehearsal and
/// LIVE, where there is no force transducer — §7.4). The scene draws it hollow so an estimate is
/// never mistaken for a measured load.
/// </param>
/// <param name="BendingNormalised">
/// Work roll bending as a fraction of a nominal maximum, or NULL when no bending tag exists.
/// Null means DO NOT BEND THE ROLL (§7.4) - the twin must not animate a deflection it cannot see.
/// </param>
/// <param name="Animate">True only when the mill is genuinely producing motion on fresh data.</param>
/// <param name="Stale">The feed is stale or lost. The scene freezes; nothing moves.</param>
public sealed record TwinTargets(
    RollingDirection Direction,
    int DirectionSign,
    double StripSpeed,
    double EntryStripSpeed,
    double WrRpm,
    double BurRpm,
    double PayoffRpm,
    double WinderRpm,
    double RollGap,
    double StripThickness,
    double EntryThickness,
    double StripWidth,
    double ForceNormalised,
    bool ForceEstimated,
    double EntryTensionNormalised,
    double ExitTensionNormalised,
    double DtrRadius,
    double EtrRadius,
    double PorRadius,
    double? BendingNormalised,
    bool Animate,
    bool Stale);

/// <summary>
/// Derives <see cref="TwinTargets"/> from the authoritative machine state. Port of
/// <c>deriveTargets</c>.
///
/// The DAMPING half of the TypeScript TwinEngine is deliberately NOT here - it belongs in the
/// browser. A 10 Hz feed driving a 60 Hz render needs smoothing at render rate; damping on the
/// server and pushing the result at 10 Hz would produce visible stepping, which is exactly what
/// <c>millConfig.visual.dampingHalfLife</c> exists to prevent. The server sends targets, the
/// scene chases them.
/// </summary>
public static class TwinEngine
{
    /// <summary>
    /// Nominal maximum work roll bending, kN, for normalising the bend into 0..1. Not a rating
    /// from the manual - there is no bending tag on the CRM04 feed at all, so this scales the
    /// SIMULATED value only and never claims to be a measurement.
    /// </summary>
    private const double MaxBendingKn = 600d;

    public static TwinTargets Derive(MachineState state)
    {
        var sign = ReversingRules.DirectionSign(state.RollingDirection);

        // Which reel is paying off comes from ReversingRules, the one place allowed to decide it -
        // never from a second copy of the direction test in here.
        var payoff = ReversingRules.PayoffReel(state.RollingDirection) == ReelId.Dtr
            ? state.Tension.Dtr
            : state.Tension.Etr;

        var winder = ReversingRules.TensionReel(state.RollingDirection) == ReelId.Dtr
            ? state.Tension.Dtr
            : state.Tension.Etr;

        // The feed being stale, and the mill not being in a moving state, both stop the animation.
        // A stopped mill and a dead link look different in the banner but identical in the scene:
        // nothing moves. That is correct - in both cases we have no evidence of motion.
        var stale = state.Communication.Stale || !state.Communication.Connected;

        var animate = !stale
            && (MachineStatusRules.IsMoving(state.MachineStatus) || state.MachineStatus == MachineStatus.FastStop)
            && state.Speed.Actual > 0.01d;

        // Mass flow: the entry side runs slower than the exit side by exactly the reduction ratio.
        // Showing both at the same speed would contradict §8.1 on screen.
        var entrySpeed = state.Thickness.Entry > 0d
            ? state.Speed.Actual * state.Thickness.Actual / state.Thickness.Entry
            : state.Speed.Actual;

        return new TwinTargets(
            Direction: state.RollingDirection,
            DirectionSign: sign,
            StripSpeed: state.Speed.Actual,
            EntryStripSpeed: entrySpeed,
            WrRpm: Math.Abs(state.Rolls.UpperWork.Rpm),
            BurRpm: Math.Abs(state.Rolls.UpperBackup.Rpm),
            PayoffRpm: Math.Abs(payoff.Rpm),
            WinderRpm: Math.Abs(winder.Rpm),
            RollGap: state.RollGap.Actual,
            StripThickness: state.Thickness.Actual,
            EntryThickness: state.Thickness.Entry,
            StripWidth: state.Coil.Width,
            ForceNormalised: Clamp01(state.RollingForce.Actual / MillConfig.Default.Ratings.MaxRollingForce),
            ForceEstimated: state.OperatingMode != OperatingMode.Simulation,
            EntryTensionNormalised: Clamp01(state.Tension.Entry / EngineeringConfig.TensionLimits.EntryMax),
            ExitTensionNormalised: Clamp01(state.Tension.Exit / EngineeringConfig.TensionLimits.ExitMax),
            DtrRadius: state.Tension.Dtr.Diameter / 2d,
            EtrRadius: state.Tension.Etr.Diameter / 2d,
            PorRadius: state.Tension.Por.Diameter / 2d,
            BendingNormalised: state.Rolls.UpperWork.BendingForce is { } bend
                ? Clamp01(bend / MaxBendingKn)
                : null,
            Animate: animate,
            Stale: stale);
    }

    private static double Clamp01(double v) => double.IsFinite(v) ? Math.Clamp(v, 0d, 1d) : 0d;
}
