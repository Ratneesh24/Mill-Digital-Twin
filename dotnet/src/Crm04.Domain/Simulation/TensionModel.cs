using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>
/// Tension force and specific tension references for a pass. Port of the TypeScript
/// <c>TensionReferences</c> interface.
/// </summary>
/// <param name="EntryKn">Entry tension force reference, kN.</param>
/// <param name="ExitKn">Exit tension force reference, kN.</param>
/// <param name="EntrySpecific">Entry specific tension, N/mm².</param>
/// <param name="ExitSpecific">Exit specific tension, N/mm².</param>
public readonly record struct TensionReferences(
    double EntryKn,
    double ExitKn,
    double EntrySpecific,
    double ExitSpecific);

/// <summary>
/// STRIP TENSION MODEL - §8 of the master spec. Port of <c>src/simulation/tensionModel.ts</c>.
///
/// Entry (back) and exit (front) tension are the two levers that, together with the roll gap, set
/// the rolling force. They are LOGICAL roles: which physical reel supplies which tension is
/// decided by the rolling direction, never by a hardcoded side (§1).
///
/// The tension reference comes from the pass schedule as a SPECIFIC tension (N/mm²), because that
/// is the quantity that stays meaningful as the strip gets thinner. The tension FORCE that the
/// reel must pull is derived from it.
/// </summary>
public static class TensionModel
{
    /// <summary>
    /// Tension force references for a pass.
    ///
    /// <code>
    ///   T_entry = sigma_entry * h_entry * w        (kN)
    ///   T_exit  = sigma_exit  * h_exit  * w        (kN)
    /// </code>
    ///
    /// Entry tension acts on the INCOMING thickness and exit tension on the DELIVERED thickness -
    /// using the same thickness for both is a common modelling error that makes the tension torque
    /// split wrong.
    ///
    /// References are clamped to the configured envelope so a badly formed pass schedule cannot
    /// drive the force model into nonsense.
    /// </summary>
    public static TensionReferences CalculateTensionReferences(
        double entrySpecificTension,
        double exitSpecificTension,
        double inputThickness,
        double outputThickness,
        double width)
    {
        var limits = EngineeringConfig.TensionLimits;

        var entryRaw = RollingModel.TensionForceFromSpecific(entrySpecificTension, inputThickness, width);
        var exitRaw = RollingModel.TensionForceFromSpecific(exitSpecificTension, outputThickness, width);

        return new TensionReferences(
            EntryKn: ClampRange(entryRaw, limits.EntryMin, limits.EntryMax),
            ExitKn: ClampRange(exitRaw, limits.ExitMin, limits.ExitMax),
            EntrySpecific: entrySpecificTension,
            ExitSpecific: exitSpecificTension);
    }

    private static double ClampRange(double value, double min, double max) =>
        Math.Min(Math.Max(value, min), max);

    /// <summary>
    /// First-order tension loop response.
    ///
    /// <code>dT/dt = (T_ref - T) / tau</code>
    ///
    /// Discretised exactly (not by Euler) so the response is identical at any tick rate:
    /// <c>T &lt;- T_ref + (T - T_ref)*e^(-dt/tau)</c>
    ///
    /// Tension therefore lags a setpoint change instead of snapping to it, which is what makes the
    /// force reading move the way it does on a real tension step.
    ///
    /// LIMITATION: a single time constant stands in for the reel drive's speed/current cascade and
    /// the strip's elastic storage between reel and bite.
    /// </summary>
    public static double StepTension(double current, double reference, double dt)
    {
        const double tau = EngineeringConfig.TensionTimeConstant;
        if (tau <= 0 || dt <= 0) return reference;
        return reference + (current - reference) * Math.Exp(-dt / tau);
    }

    /// <summary>
    /// Tension is only real while the strip is moving and threaded. A stopped mill holds a
    /// residual "hold" tension from the reel brakes/drives, not the full rolling reference -
    /// showing full tension on a stopped mill is one of the classic twin inconsistencies (§18).
    /// </summary>
    public static double TensionReferenceForState(
        double fullReferenceKn,
        double speedMpm,
        bool threaded)
    {
        if (!threaded) return 0;
        var threading = EngineeringConfig.SpeedLimits.ThreadingSpeed;
        if (speedMpm <= 0.01)
        {
            // Reels hold the strip taut at a reduced standstill tension.
            return fullReferenceKn * 0.25;
        }

        if (speedMpm < threading)
        {
            // Ramp in over the threading band.
            var k = 0.25 + 0.75 * (speedMpm / threading);
            return fullReferenceKn * k;
        }

        return fullReferenceKn;
    }
}
