using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>Inputs to <see cref="ThicknessModel.SolveGaugemeter"/>.</summary>
/// <param name="GapPosition">Unloaded roll gap position S0, mm.</param>
/// <param name="InputThickness">Entry thickness, mm.</param>
/// <param name="Width">Strip width, mm.</param>
/// <param name="WorkRollDiameter">Nominal work roll diameter, mm.</param>
/// <param name="EntryTension">Entry (back) tension force, kN.</param>
/// <param name="ExitTension">Exit (front) tension force, kN.</param>
/// <param name="AccumulatedStrain">Strain already carried from previous passes.</param>
/// <param name="FlowStressScale">Multiplier on the mean flow stress - see <see cref="RollingForceInput"/>.</param>
public readonly record struct GaugemeterSolveInput(
    double GapPosition,
    double InputThickness,
    double Width,
    double WorkRollDiameter,
    double EntryTension,
    double ExitTension,
    double AccumulatedStrain,
    double? FlowStressScale = null);

/// <summary>Result of <see cref="ThicknessModel.SolveGaugemeter"/>.</summary>
/// <param name="OutputThickness">Delivered (loaded) thickness, mm.</param>
/// <param name="Force">The converged force solution.</param>
/// <param name="MillStretch">Mill stretch F/M, mm.</param>
/// <param name="Iterations">Iterations taken. Asserted by the parity gate - see the class remarks.</param>
/// <param name="ResidualUm">Final |h - (S0 + F/M)| residual, µm - should be &lt; 0.01.</param>
/// <param name="NoBite">True when the strip never entered plastic reduction (gap &gt;= entry thickness).</param>
public readonly record struct GaugemeterSolveResult(
    double OutputThickness,
    RollingForceResult Force,
    double MillStretch,
    int Iterations,
    double ResidualUm,
    bool NoBite);

/// <summary>HAGC integrator state. Port of the TypeScript <c>HagcState</c>.</summary>
/// <param name="Integral">Accumulated thickness error, mm·s, clamped to ±0.5.</param>
public readonly record struct HagcState(double Integral);

/// <summary>Return of <see cref="ThicknessModel.HagcStep"/>.</summary>
public readonly record struct HagcStepResult(double GapPosition, HagcState State);

/// <summary>
/// THICKNESS / GAUGEMETER MODEL - §8.1 of the master spec. Port of
/// <c>src/simulation/thicknessModel.ts</c>.
///
/// The gaugemeter equation is the ANCHOR of the whole simulation (§19.8):
///
/// <code>h = S0 + F / M</code>
///
/// where S0 is the unloaded roll gap position (what HAGC actually commands), F is the roll
/// separating force and M is the mill modulus. It says the stand is a spring: press harder and the
/// housing, chocks and rolls stretch, so the delivered strip is thicker than the gap you set.
///
/// Because F itself depends on h, the pair (h, F) is COUPLED and must be solved simultaneously.
/// This module owns that solve. Nothing else in the codebase is allowed to compute a delivered
/// thickness - that is what keeps the twin's "one authoritative value" rule (§4) true for
/// thickness.
///
/// WHY <see cref="GaugemeterSolveResult.Iterations"/> IS PART OF THE PARITY GATE. The loop exits
/// on a tolerance, so a last-ulp difference in <see cref="Math.Pow"/> deep inside the force model
/// can change the iteration count by one - and once the two solvers take different numbers of
/// steps, their trajectories genuinely differ rather than merely drifting. The count is therefore
/// asserted alongside the values: it is the canary that distinguishes "floating-point noise" from
/// "the port is wrong".
/// </summary>
public static class ThicknessModel
{
    /// <summary>
    /// Solve the coupled gaugemeter / force problem.
    ///
    /// <code>h_{k+1} = S0 + F(h_k) / M</code>
    ///
    /// under-relaxed by <c>solver.relaxation</c> for stability. This is the same fixed-point
    /// relationship the real stand obeys mechanically; solving it (rather than picking h and
    /// back-calculating F, or vice versa) is what makes force, gap and thickness mutually
    /// consistent instead of three independent numbers.
    ///
    /// LIMITATION: M is treated as a constant. On a real mill the modulus is mildly force- and
    /// width-dependent, and the "mill spring curve" is measured, not assumed. Replacing the
    /// constant with a curve is a change to this function only.
    /// </summary>
    public static GaugemeterSolveResult SolveGaugemeter(GaugemeterSolveInput input)
    {
        var s0 = input.GapPosition;
        var h0 = input.InputThickness;
        var width = input.Width;
        var workRollDiameter = input.WorkRollDiameter;

        var m = EngineeringConfig.MillModulus;
        var solver = EngineeringConfig.Solver;

        // Force is in tonnes and M is in t/mm, so F/M lands in mm directly.
        var emptyForce = ForceModel.CalculateRollingForce(new RollingForceInput(
            InputThickness: h0,
            OutputThickness: h0,
            Width: width,
            WorkRollDiameter: workRollDiameter,
            EntryTension: input.EntryTension,
            ExitTension: input.ExitTension,
            AccumulatedStrain: input.AccumulatedStrain,
            FlowStressScale: input.FlowStressScale));

        // Gap wider than the incoming strip: the rolls never touch it. No reduction, no force,
        // delivered thickness = entry thickness.
        if (s0 >= h0)
        {
            return new GaugemeterSolveResult(
                OutputThickness: h0,
                Force: emptyForce,
                MillStretch: 0,
                Iterations: 0,
                ResidualUm: 0,
                NoBite: true);
        }

        // Seed between the commanded gap and the entry thickness.
        var h = Math.Min(h0, Math.Max(s0, s0 + (h0 - s0) * 0.25));
        var force = emptyForce;
        var iterations = 0;

        for (var i = 0; i < solver.MaxIterations; i++)
        {
            iterations = i + 1;
            force = ForceModel.CalculateRollingForce(new RollingForceInput(
                InputThickness: h0,
                OutputThickness: h,
                Width: width,
                WorkRollDiameter: workRollDiameter,
                EntryTension: input.EntryTension,
                ExitTension: input.ExitTension,
                AccumulatedStrain: input.AccumulatedStrain,
                FlowStressScale: input.FlowStressScale));

            var stretch = force.ForceTonnes / m;
            // The stand cannot deliver thicker than it is fed, nor thinner than the commanded
            // gap: clamp the iterate into the physically reachable band.
            var next = Math.Min(h0, Math.Max(s0, s0 + stretch));
            var updated = h + (next - h) * solver.Relaxation;

            if (Math.Abs(updated - h) < solver.ToleranceMm)
            {
                h = updated;
                break;
            }

            h = updated;
        }

        var millStretch = force.ForceTonnes / m;
        var residualUm = Math.Abs(h - (s0 + millStretch)) * 1000;

        return new GaugemeterSolveResult(
            OutputThickness: h,
            Force: force,
            MillStretch: millStretch,
            Iterations: iterations,
            ResidualUm: residualUm,
            NoBite: false);
    }

    /// <summary>
    /// INVERSE GAUGEMETER - unloaded gap position from measured thickness and force.
    ///
    /// <code>S0 = h - F / M</code>
    ///
    /// Used in the 46-tag CRM04 profile (§7.4) where no LVDT position tag exists but an X-ray
    /// thickness gauge does. The result is badged CALCULATED, never MEASURED.
    /// </summary>
    public static double InverseGaugemeter(double deliveredThicknessMm, double forceTonnes) =>
        deliveredThicknessMm - forceTonnes / EngineeringConfig.MillModulus;

    /// <summary>
    /// Roll gap position S0 required to deliver a target thickness.
    ///
    /// <code>S0 = h_target - F / M</code>
    ///
    /// Solved by iterating the forward problem, because the force that produces the stretch
    /// depends on the thickness you are trying to hit. This is what the AGC position pre-set does
    /// before a pass starts, and what <see cref="SimulationEngine"/> uses to preposition the
    /// capsule at pass change.
    /// </summary>
    public static double GapPositionForTargetThickness(
        double targetThickness,
        double inputThickness,
        double width,
        double workRollDiameter,
        double entryTension,
        double exitTension,
        double accumulatedStrain)
    {
        // Note the absent flowStressScale: the TypeScript omits it here too, so this pre-set is
        // always computed for nominal material even when a scenario has made the coil harder.
        var force = ForceModel.CalculateRollingForce(new RollingForceInput(
            InputThickness: inputThickness,
            OutputThickness: targetThickness,
            Width: width,
            WorkRollDiameter: workRollDiameter,
            EntryTension: entryTension,
            ExitTension: exitTension,
            AccumulatedStrain: accumulatedStrain));
        return targetThickness - force.ForceTonnes / EngineeringConfig.MillModulus;
    }

    /// <summary>
    /// X-ray gauge signal from the true delivered thickness.
    ///
    /// Noise is added HERE and only here - at the instrument, exactly where a real measurement
    /// chain adds it. No process value that other values depend on ever receives noise (§19.2), so
    /// the physics stays deterministic while the displayed gauge trace looks like a real gauge
    /// trace.
    ///
    /// LIMITATION: white Gaussian noise only. Real X-ray gauges also show drift, standardisation
    /// steps, and aliasing against strip flutter.
    /// </summary>
    public static double ApplyGaugeNoise(double trueThicknessMm, SeededRandom rng)
    {
        var sigmaMm = EngineeringConfig.GaugeNoiseSigma / 1000;
        return trueThicknessMm + rng.Normal() * sigmaMm;
    }

    /// <summary>
    /// HAGC thickness controller - PI on thickness error, output is the unloaded gap position S0.
    ///
    /// <code>
    ///   e   = h_measured - h_reference        [mm]
    ///   S0 &lt;- S0 - (Kp*e + Ki*integral e dt)
    /// </code>
    ///
    /// Deliberately a "gaugemeter-style" correction: to make the strip thinner the loop closes the
    /// gap. Slew-rate limited to the servo capsule's capability.
    ///
    /// LIMITATION: the real HAGC is a cascaded position/pressure loop running at 100 Hz+ with
    /// mass-flow (MFC), feed-forward (THFF) and feedback (THFB) trims and a separate tilt loop.
    /// This is a single PI on delivered thickness and should be read as "AGC is closing the loop",
    /// not as the mill's control law.
    /// </summary>
    public static HagcStepResult HagcStep(
        HagcState state,
        double gapPosition,
        double measuredThickness,
        double referenceThickness,
        double dt,
        bool enabled)
    {
        if (!enabled || dt <= 0) return new HagcStepResult(gapPosition, state);

        var error = measuredThickness - referenceThickness;

        // Anti-windup: clamp the integrator to ±0.5 mm of authority.
        var integral = Math.Max(-0.5, Math.Min(0.5, state.Integral + error * dt));
        var correction = EngineeringConfig.HagcGainP * error + EngineeringConfig.HagcGainI * integral;

        var maxStep = EngineeringConfig.HagcSlewRate * dt;
        var step = Math.Max(-maxStep, Math.Min(maxStep, -correction));

        return new HagcStepResult(gapPosition + step, new HagcState(integral));
    }
}
