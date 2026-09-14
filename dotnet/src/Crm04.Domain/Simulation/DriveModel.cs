using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>Inputs to <see cref="DriveModel.CalculateDrive"/>.</summary>
/// <param name="ForceTonnes">Total roll separating force, t.</param>
/// <param name="ContactLengthMm">Projected contact length, mm.</param>
/// <param name="RollRpm">Work roll rotational speed, rpm.</param>
/// <param name="WorkRollDiameter">Work roll diameter, mm.</param>
/// <param name="EntryTensionKn">Entry (back) tension force, kN.</param>
/// <param name="ExitTensionKn">Exit (front) tension force, kN.</param>
/// <param name="Rolling">
/// True only while material is actually flowing through the bite.
///
/// A stand parked with the capsule loaded still carries a separating force - the rolls are
/// pressing on stationary strip - but it is not doing any deformation work, so there is no rolling
/// torque. Without this gate the twin shows a stopped mill drawing 200 A, which is the kind of
/// quiet nonsense §18 exists to catch.
/// </param>
public readonly record struct DriveInput(
    double ForceTonnes,
    double ContactLengthMm,
    double RollRpm,
    double WorkRollDiameter,
    double EntryTensionKn,
    double ExitTensionKn,
    bool Rolling);

/// <summary>Result of <see cref="DriveModel.CalculateDrive"/>.</summary>
/// <param name="Torque">Total mill spindle torque, kNm.</param>
/// <param name="RollTorque">Torque contributed by deformation work alone, kNm.</param>
/// <param name="TensionTorque">Torque contributed by the strip tension differential, kNm.</param>
/// <param name="Power">Shaft power, kW.</param>
/// <param name="Current">Armature current, A.</param>
/// <param name="Rpm">Main drive speed, rpm.</param>
/// <param name="TorquePercentage">Torque as a percentage of drive rating.</param>
public readonly record struct DriveResult(
    double Torque,
    double RollTorque,
    double TensionTorque,
    double Power,
    double Current,
    double Rpm,
    double TorquePercentage);

/// <summary>
/// MAIN DRIVE MODEL - §8.3 of the master spec. Port of <c>src/simulation/driveModel.ts</c>.
///
/// <code>
///   torque  = f(rollingForce, contactLength, workRollRadius)
///   power   = f(torque, rollRPM) / mechanicalEfficiency
///   current = f(power, driveConstants)
/// </code>
///
/// Torque is derived from the force and the geometry, never generated independently - this is the
/// §8.6 chain "reduction up -&gt; force up -&gt; torque up -&gt; current up" and it must hold at
/// every tick.
/// </summary>
public static class DriveModel
{
    private static readonly MillRatings Ratings = MillConfig.Default.Ratings;

    /// <summary>
    /// Mill torque, power and current.
    ///
    /// <code>
    ///   a       = lambda * L                         lever arm, mm
    ///   G_roll  = 2 * F * a                          both work rolls driven, kNm
    ///   G_tens  = R_wr * (T_back - T_front)          tension differential, kNm
    ///   G       = G_roll + G_tens
    ///   P       = G * w / eta                        shaft power, kW
    ///   I       = I_rated * G / G_rated              armature current, A
    /// </code>
    ///
    /// The tension term is signed on purpose. Front (exit) tension is applied by the exit reel,
    /// which does part of the pulling, so the mill motor needs LESS torque. Back (entry) tension
    /// drags against the rolls and costs MORE. Getting this sign right is what makes "raise exit
    /// tension -&gt; mill current falls" behave the way an operator expects.
    ///
    /// LIMITATIONS
    /// <list type="bullet">
    /// <item>Constant lever-arm ratio lambda (see <see cref="EngineeringConfig"/>).</item>
    /// <item>No inertia term: acceleration torque during ramps is not modelled, so current during
    /// a speed change is a steady-state value at the new speed.</item>
    /// <item>Bearing, seal and spindle losses are folded into one efficiency constant.</item>
    /// <item>Current is mapped linearly from torque (a DC / field-oriented drive approximation).
    /// No field weakening above base speed.</item>
    /// </list>
    /// </summary>
    public static DriveResult CalculateDrive(DriveInput input)
    {
        var forceKn = UnitConversion.TonnesToKn(input.ForceTonnes);
        var leverArmM = EngineeringConfig.LeverArmRatio * input.ContactLengthMm / 1000;
        var workRollRadiusM = input.WorkRollDiameter / 2 / 1000;

        // Deformation torque, both work rolls - only while the bite is working.
        var rollTorque = input.Rolling ? 2 * forceKn * leverArmM : 0;

        // Tension differential torque, kNm. Positive = extra load on the mill motor. This one DOES
        // persist at standstill: the reels hold the strip taut and the mill motor holds against
        // the difference.
        var tensionTorque = workRollRadiusM * (input.EntryTensionKn - input.ExitTensionKn);

        var torque = rollTorque + tensionTorque;

        // P[kW] = G[kNm] * w[rad/s] / eta
        var omega = UnitConversion.RpmToRadPerSec(input.RollRpm);
        var power = torque * omega / EngineeringConfig.MechanicalEfficiency;

        var ratedTorque = Ratings.MainDriveRatedTorque;
        var torquePercentage = ratedTorque > 0 ? torque / ratedTorque * 100 : 0;
        var current = Ratings.MainDriveRatedCurrent * torque / Math.Max(ratedTorque, 1e-6);

        return new DriveResult(
            Torque: torque,
            RollTorque: rollTorque,
            TensionTorque: tensionTorque,
            Power: power,
            Current: current,
            // The main drive turns the work rolls through the spindles; gear ratio 1:1 is assumed
            // pending §22 item 1 (main drive rating / gearbox data).
            Rpm: input.RollRpm,
            TorquePercentage: torquePercentage);
    }

    /// <summary>
    /// HAGC capsule loading pressure from roll separating force, bar.
    ///
    /// <code>p = p_max * F / F_max</code>
    ///
    /// A proportional map: the capsule area is constant, so pressure tracks force. Used to give
    /// the hydraulics panel and the 3D cylinders a value that is genuinely tied to the force
    /// rather than animated for effect.
    ///
    /// LIMITATION: ignores the accumulator characteristic, line losses, and the balance /
    /// counter-balance circuit.
    /// </summary>
    public static double HydraulicPressureFromForce(double forceTonnes)
    {
        var ratio = forceTonnes / Ratings.MaxRollingForce;
        return EngineeringConfig.HydraulicPressureAtMaxForce * Math.Max(0, Math.Min(ratio, 1.2));
    }
}
