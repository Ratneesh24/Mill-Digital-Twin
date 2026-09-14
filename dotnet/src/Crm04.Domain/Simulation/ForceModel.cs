using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>Inputs to <see cref="ForceModel.CalculateRollingForce"/>.</summary>
/// <param name="InputThickness">Entry thickness h0, mm.</param>
/// <param name="OutputThickness">Delivered thickness h1, mm.</param>
/// <param name="Width">Strip width, mm.</param>
/// <param name="WorkRollDiameter">Nominal work roll diameter, mm.</param>
/// <param name="EntryTension">Entry (back) tension force, kN.</param>
/// <param name="ExitTension">Exit (front) tension force, kN.</param>
/// <param name="AccumulatedStrain">Strain already carried by the material from previous passes.</param>
/// <param name="FlowStressScale">
/// Multiplier on the mean flow stress, <c>null</c> meaning 1. This is the "harder or softer
/// material" lever - a different grade, a colder strip, a coil that has work-hardened more than
/// the schedule assumed. It scales the material's resistance, which is the physically meaningful
/// input; it does not scale the force directly.
///
/// NULLABLE ON PURPOSE. The TypeScript writes <c>flowStressScale = 1</c> as a destructuring
/// default, which fires on <c>undefined</c>. A non-nullable <c>double</c> here would silently
/// become 0 for any caller that did not set it, and a zero flow stress means zero force with no
/// error anywhere.
/// </param>
public readonly record struct RollingForceInput(
    double InputThickness,
    double OutputThickness,
    double Width,
    double WorkRollDiameter,
    double EntryTension,
    double ExitTension,
    double AccumulatedStrain,
    double? FlowStressScale = null);

/// <summary>Result of <see cref="ForceModel.CalculateRollingForce"/>.</summary>
/// <param name="ForceTonnes">Total roll separating force, t.</param>
/// <param name="ForceKn">Total roll separating force, kN.</param>
/// <param name="ContactLength">Projected contact length, mm.</param>
/// <param name="FlattenedRadius">Hitchcock flattened radius, mm.</param>
/// <param name="MeanFlowStress">Mean flow stress used, MPa.</param>
/// <param name="MeanPressure">Mean roll pressure, MPa.</param>
/// <param name="FrictionMultiplier">Friction-hill / inhomogeneity multiplier Q, dimensionless.</param>
/// <param name="MeanTensionStress">Mean applied tension stress, MPa.</param>
public readonly record struct RollingForceResult(
    double ForceTonnes,
    double ForceKn,
    double ContactLength,
    double FlattenedRadius,
    double MeanFlowStress,
    double MeanPressure,
    double FrictionMultiplier,
    double MeanTensionStress);

/// <summary>
/// ROLL SEPARATING FORCE MODEL - §8.2 of the master spec. Port of
/// <c>src/simulation/forceModel.ts</c>.
///
/// MODEL CLASS: mean-pressure (Bland-Ford / Hill form) with Hitchcock roll flattening. This is a
/// SIMPLIFIED ENGINEERING RELATION, not the mill's technology model (§19.6). It exists to make the
/// twin internally consistent, and it is written so it can be replaced wholesale without touching
/// a single component.
///
/// Required behaviour (§8.2): force rises with reduction, width, material resistance and contact
/// length; falls with increasing tension.
/// </summary>
public static class ForceModel
{
    /// <summary>Note <c>FrictionMultiplier: 1</c>, not 0 - it is a multiplier, and the
    /// TypeScript's ZERO_RESULT says the same.</summary>
    private static readonly RollingForceResult ZeroResult = new(
        ForceTonnes: 0,
        ForceKn: 0,
        ContactLength: 0,
        FlattenedRadius: 0,
        MeanFlowStress: 0,
        MeanPressure: 0,
        FrictionMultiplier: 1,
        MeanTensionStress: 0);

    /// <summary>
    /// Roll separating force.
    ///
    /// Equations, in order of evaluation:
    /// <code>
    ///   dh   = h0 - h1                                    draft, mm
    ///   e    = ln(h0/h1)                                  true strain
    ///   kf   = kf0(1 + Ce)^n integrated over the pass     mean flow stress, MPa
    ///   k    = 1.155 * kf                                 plane-strain resistance, MPa
    ///   sm   = (s_entry + s_exit)/2                       mean tension stress, MPa
    ///   R'   = Hitchcock(R, F/w, dh)                      flattened radius, mm
    ///   L    = sqrt(R'*dh)                                contact length, mm
    ///   hm   = (h0 + h1)/2                                mean thickness, mm
    ///   Q    = 1 + mu*L/(2*hm)                            friction-hill multiplier
    ///   p    = (k - sm) * Q                               mean roll pressure, MPa
    ///   F    = p * L * w                                  separating force, N
    /// </code>
    ///
    /// R' depends on F and F depends on R', so the pair is solved by fixed-point iteration.
    ///
    /// The tension term enters as <c>(k - sm)</c>: applied tension does part of the work of
    /// deformation, so the rolls have to supply less. This is the mechanism behind the §8.6
    /// coupling "tension up -&gt; force down", and it is why the tension references in the pass
    /// schedule matter to the force reading.
    ///
    /// LIMITATIONS
    /// <list type="bullet">
    /// <item>Mean-pressure form: no explicit friction-hill integration, so the neutral point is
    /// not located and the pressure distribution is not resolved.</item>
    /// <item>No thermal softening, no roll/strip temperature.</item>
    /// <item>No roll crown, bending or flatness effects - force is treated as uniform across the
    /// barrel, which is why OS/DS split is a Phase 2 item (§16).</item>
    /// <item>Elastic entry/exit zones are neglected.</item>
    /// </list>
    /// </summary>
    public static RollingForceResult CalculateRollingForce(RollingForceInput input)
    {
        var h0 = input.InputThickness;
        var h1 = input.OutputThickness;
        var w = input.Width;
        var flowStressScale = input.FlowStressScale ?? 1;

        var draft = h0 - h1;
        if (draft <= 1e-6 || w <= 0 || h1 <= 0) return ZeroResult;

        var nominalRadius = input.WorkRollDiameter / 2;
        var meanFlowStress = RollingModel.CalculateMeanFlowStress(h0, h1, input.AccumulatedStrain) * flowStressScale;
        var planeStrainResistance = EngineeringConfig.PlaneStrainFactor * meanFlowStress;

        var entryStress = RollingModel.SpecificTension(input.EntryTension, h0, w);
        var exitStress = RollingModel.SpecificTension(input.ExitTension, h1, w);
        var meanTensionStress = (entryStress + exitStress) / 2;

        var meanThickness = (h0 + h1) / 2;
        const double mu = EngineeringConfig.FrictionFactor;

        // Fixed-point iteration on (F, R'). Seed with the unflattened radius and stop once the
        // flattened radius settles - on thin strip R' can approach 2x nominal and a fixed 3-pass
        // loop stops well short of the true force.
        var flattenedRadius = nominalRadius;
        var contactLength = RollingModel.CalculateContactLength(flattenedRadius, draft);
        var forceN = 0d;
        var frictionMultiplier = 1d;
        var meanPressure = 0d;

        for (var i = 0; i < EngineeringConfig.HitchcockIterations; i++)
        {
            contactLength = RollingModel.CalculateContactLength(flattenedRadius, draft);
            frictionMultiplier = 1 + mu * contactLength / (2 * meanThickness);
            // Tension can never drive the required pressure below zero - floor it.
            meanPressure = Math.Max((planeStrainResistance - meanTensionStress) * frictionMultiplier, 0);
            forceN = meanPressure * contactLength * w;

            var nextRadius = RollingModel.CalculateFlattenedRadius(nominalRadius, forceN / w, draft);
            var converged = Math.Abs(nextRadius - flattenedRadius) < EngineeringConfig.HitchcockToleranceMm;
            flattenedRadius = nextRadius;
            if (converged) break;
        }

        return new RollingForceResult(
            ForceTonnes: UnitConversion.NewtonsToTonnes(forceN),
            ForceKn: forceN / 1000,
            ContactLength: contactLength,
            FlattenedRadius: flattenedRadius,
            MeanFlowStress: meanFlowStress,
            MeanPressure: meanPressure,
            FrictionMultiplier: frictionMultiplier,
            MeanTensionStress: meanTensionStress);
    }

    /// <summary>
    /// INVERSE MODEL - estimate roll separating force from main-drive torque.
    ///
    /// Used ONLY in the 46-tag CRM04 feed profile (§7.4), where roll separating force is not
    /// instrumented but <c>MILL_ACT_TRQ</c> is. Rearranging the torque relation (see
    /// <see cref="DriveModel"/>):
    /// <code>
    ///   G_roll = 2 * F * a  with  a = lambda*L
    ///   ->  F = G_roll / (2 * lambda * L)
    /// </code>
    ///
    /// The result is badged ESTIMATED, never MEASURED, and it is the reason the §7.4 table says
    /// "Render ESTIMATED from torque + reduction model".
    ///
    /// LIMITATION: any error in lambda, in the tension-torque split, or in the assumed contact
    /// length propagates directly into the force estimate. Treat as an indication of trend, not as
    /// a calibrated force reading.
    /// </summary>
    public static double EstimateForceFromTorque(double rollTorqueKNm, double contactLengthMm)
    {
        var leverArmMm = EngineeringConfig.LeverArmRatio * contactLengthMm;
        if (leverArmMm <= 1e-6) return 0;
        // G[kNm] = 2*F[kN]*a[m]  ->  F[kN] = G / (2*a)
        var forceKn = rollTorqueKNm * 1000 / (2 * leverArmMm);
        return UnitConversion.NewtonsToTonnes(forceKn * 1000);
    }
}
