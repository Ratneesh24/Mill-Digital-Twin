using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>
/// ROLLING KINEMATICS &amp; MATERIAL MODEL - §8 of the master spec. Port of
/// <c>src/simulation/rollingModel.ts</c>.
///
/// Shared primitives used by the force, thickness, drive and tension models. Every function here
/// is single-purpose and pure (§19.3): same inputs, same outputs, no hidden state, no randomness.
///
/// MODEL CLASS: simplified textbook cold-rolling relations (Hitchcock roll flattening + a
/// Bland-Ford-type mean-pressure form). NOT the mill technology model (§19.6).
///
/// A NOTE ON THE PORT, which applies to every file in this namespace. These expressions are
/// reproduced TOKEN FOR TOKEN, including parentheses that a compiler would happily drop and
/// groupings a reader would happily simplify. Floating-point addition and multiplication are not
/// associative, so re-associating an expression changes the result in the last few bits - and a
/// last-bit difference inside the force solver can change its iteration count, after which the
/// two trajectories genuinely differ. The parity gate is what proves this discipline held; please
/// do not "tidy" the arithmetic.
/// </summary>
public static class RollingModel
{
    /// <summary>
    /// Reduction, %. <c>r = (h0 - h1) / h0 x 100</c>
    /// </summary>
    public static double CalculateReduction(double inputThickness, double outputThickness)
    {
        if (inputThickness <= 0) return 0;
        return (inputThickness - outputThickness) / inputThickness * 100;
    }

    /// <summary>
    /// Output thickness from a scheduled reduction (§8.1 pass-schedule form).
    /// <c>h1 = h0 x (1 - r)</c>
    /// </summary>
    public static double OutputThicknessFromReduction(double inputThickness, double reductionPct) =>
        inputThickness * (1 - reductionPct / 100);

    /// <summary>
    /// True (logarithmic) strain through the pass. <c>e = ln(h0 / h1)</c>
    ///
    /// Cold rolling is plane strain, so this is also the equivalent strain up to the plane-strain
    /// factor applied in the force model.
    /// </summary>
    public static double CalculateTrueStrain(double inputThickness, double outputThickness)
    {
        if (inputThickness <= 0 || outputThickness <= 0) return 0;
        return Math.Log(inputThickness / outputThickness);
    }

    /// <summary>
    /// Mean deformation resistance (flow stress) over the pass, MPa.
    ///
    /// <code>
    ///   kf(e)   = kf0 * (1 + C*e)^n           [Ludwik-type hardening]
    ///   kf_mean = (1/(e1-e0)) * integral kf de [analytic]
    /// </code>
    ///
    /// <paramref name="accumulatedStrain"/> is the strain the material already carries from
    /// previous passes - this is what makes pass 4 harder than pass 1, and it is why the twin must
    /// track cumulative strain per coil rather than per pass.
    ///
    /// LIMITATION: a single fitted curve stands in for a per-grade flow curve, and there is no
    /// recovery/annealing term.
    /// </summary>
    public static double CalculateMeanFlowStress(
        double inputThickness,
        double outputThickness,
        double accumulatedStrain)
    {
        // Named exactly as the TypeScript destructures them, so the formulae below read the same.
        const double kf0 = EngineeringConfig.MaterialFactor;
        const double c = EngineeringConfig.HardeningCoefficient;
        const double n = EngineeringConfig.HardeningExponent;

        var e0 = accumulatedStrain;
        var e1 = accumulatedStrain + CalculateTrueStrain(inputThickness, outputThickness);

        if (e1 - e0 < 1e-9)
        {
            return kf0 * Math.Pow(1 + c * e0, n);
        }

        // integral of kf0 (1 + Ce)^n de = kf0 (1 + Ce)^(n+1) / (C (n+1))
        //
        // `n + 1` is written out rather than folded to the literal 1.22. For today's n the two
        // doubles happen to be identical, so this is not about rounding - it is that the exponent
        // must FOLLOW the hardening exponent. Change n to 0.25 and the literal silently keeps
        // integrating the old curve, giving a mean flow stress that is wrong by a few percent with
        // nothing to show for it.
        double Antiderivative(double e) => kf0 * Math.Pow(1 + c * e, n + 1) / (c * (n + 1));

        return (Antiderivative(e1) - Antiderivative(e0)) / (e1 - e0);
    }

    /// <summary>
    /// Hitchcock's flattened work-roll radius, mm.
    ///
    /// <code>R' = R * (1 + 16(1-v^2)*F' / (pi*E*dh))</code>
    ///
    /// where F' is roll force per unit width (N/mm). Roll flattening is not a detail in cold
    /// rolling: at high reduction on thin strip it can double the contact length, and a model
    /// without it under-predicts force badly.
    ///
    /// LIMITATION: Hitchcock assumes elastic Hertzian flattening of a circular roll and breaks
    /// down as the strip approaches the minimum rollable thickness.
    /// </summary>
    public static double CalculateFlattenedRadius(
        double nominalRadiusMm,
        double forcePerWidthNPerMm,
        double draftMm)
    {
        if (draftMm <= 1e-6 || forcePerWidthNPerMm <= 0) return nominalRadiusMm;

        const double e = EngineeringConfig.RollYoungsModulus;
        const double nu = EngineeringConfig.RollPoissonRatio;

        var c = 16 * (1 - nu * nu) / (Math.PI * e);
        var flattened = nominalRadiusMm * (1 + c * forcePerWidthNPerMm / draftMm);

        // Guard: cap flattening at 4x nominal so a numerical excursion cannot produce a
        // non-physical contact length.
        return Math.Min(flattened, nominalRadiusMm * 4);
    }

    /// <summary>
    /// Arc-of-contact (projected contact length), mm. <c>L = sqrt(R' * dh)</c> (§8.2)
    /// </summary>
    public static double CalculateContactLength(double flattenedRadiusMm, double draftMm)
    {
        if (draftMm <= 0) return 0;
        return Math.Sqrt(flattenedRadiusMm * draftMm);
    }

    /// <summary>
    /// Roll surface speed from strip exit speed, m/min.
    ///
    /// <code>v_exit = v_roll * (1 + f)  ->  v_roll = v_exit / (1 + f)</code>
    ///
    /// Forward slip f is what makes the strip leave the bite faster than the roll surface.
    /// Deriving roll speed this way (rather than setting it independently) is what keeps §8.6's
    /// "mill speed changes -&gt; roll rpm changes" coupling honest.
    /// </summary>
    public static double RollSurfaceSpeedFromStripSpeed(double stripExitSpeedMpm) =>
        stripExitSpeedMpm / (1 + EngineeringConfig.ForwardSlip);

    /// <summary>
    /// Work roll rotational speed, rpm (§8.4). <c>rollRPM = v_surface / (pi * D)</c>
    ///
    /// with v in m/min and D in mm (hence the 1000 factor). Rotation is DERIVED from speed - there
    /// are no arbitrary animation timers anywhere in the twin, and zero speed necessarily means
    /// zero rpm.
    /// </summary>
    public static double CalculateRollRpm(double surfaceSpeedMpm, double rollDiameterMm)
    {
        if (rollDiameterMm <= 0) return 0;
        return surfaceSpeedMpm * 1000 / (Math.PI * rollDiameterMm);
    }

    /// <summary>
    /// Entry strip speed from mass flow, m/min (§8.1). <c>h_entry * v_entry = h_exit * v_exit</c>
    ///
    /// Volume is conserved through the bite (strip width is effectively constant in cold rolling),
    /// so the entry side must run slower by exactly the reduction ratio. The decoiler speed
    /// reference follows from this, not from a guess.
    /// </summary>
    public static double EntrySpeedFromMassFlow(
        double exitSpeedMpm,
        double inputThickness,
        double outputThickness)
    {
        if (inputThickness <= 0) return exitSpeedMpm;
        return exitSpeedMpm * outputThickness / inputThickness;
    }

    /// <summary>
    /// Mass-flow closure error, %.
    ///
    /// Surfaced as a DIAGNOSTIC (§8.1) - the sim never silently corrects itself with this number.
    /// A non-zero value means the kinematic chain has drifted and is worth showing to a
    /// commissioning engineer.
    /// </summary>
    public static double MassFlowError(
        double inputThickness,
        double entrySpeedMpm,
        double outputThickness,
        double exitSpeedMpm)
    {
        var entryFlow = inputThickness * entrySpeedMpm;
        var exitFlow = outputThickness * exitSpeedMpm;
        if (Math.Abs(exitFlow) < 1e-9) return 0;
        return (entryFlow - exitFlow) / exitFlow * 100;
    }

    /// <summary>
    /// Specific tension (stress) from tension force, N/mm². <c>sigma = T / (h * w)</c>
    /// </summary>
    public static double SpecificTension(double tensionKn, double thicknessMm, double widthMm)
    {
        var area = thicknessMm * widthMm;
        if (area <= 0) return 0;
        return tensionKn * 1000 / area;
    }

    /// <summary>
    /// Tension force from specific tension, kN. <c>T = sigma * h * w</c>
    /// </summary>
    public static double TensionForceFromSpecific(
        double specificTensionNPerMm2,
        double thicknessMm,
        double widthMm) =>
        specificTensionNPerMm2 * thicknessMm * widthMm / 1000;
}
