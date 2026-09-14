using Crm04.Domain.Coils;

namespace Crm04.Domain.Simulation;

/// <summary>
/// Pass-schedule arithmetic the engine needs. Port of the computed helpers in
/// <c>src/data/demoPassSchedule.ts</c>.
///
/// The schedule's DATA is generated into <see cref="PassScheduleData"/> by
/// <c>scripts/exportTagCatalog.ts</c> and must not be hand-edited. These are the functions that
/// read it.
/// </summary>
public static class PassScheduleMath
{
    /// <summary>
    /// Strain accumulated in the material BEFORE a given 1-based pass.
    ///
    /// Cold work carries forward: pass 5 is harder than pass 1 on the same steel because the
    /// material has already been strained 0.97. Computed by walking the passes in order rather
    /// than treating each in isolation - and walked in that order here too, because summing
    /// doubles is not associative and the TypeScript sums them front to back.
    /// </summary>
    public static double AccumulatedStrainBeforePass(PassSchedule schedule, int passNumber) =>
        AccumulatedStrainBefore(schedule, Math.Max(0, passNumber - 1));

    /// <summary>Strain accumulated before the pass at the given 0-based index.</summary>
    public static double AccumulatedStrainBefore(PassSchedule schedule, int passIndex)
    {
        var strain = 0d;
        var limit = Math.Min(passIndex, schedule.Passes.Count);
        for (var i = 0; i < limit; i++)
        {
            var p = schedule.Passes[i];
            strain += RollingModel.CalculateTrueStrain(p.InputThickness, p.OutputThickness);
        }

        return strain;
    }

    /// <summary>
    /// Look up a pass entry by 1-based pass number.
    ///
    /// CLAMPS rather than throws. The state machine must never crash on a pass number that has
    /// run past the end of the schedule, and on the last pass the engine deliberately asks for
    /// <c>passNumber + 1</c> when deciding the next direction.
    /// </summary>
    public static PassScheduleEntry GetPass(PassSchedule schedule, int passNumber) =>
        schedule.ForPass(passNumber) ?? schedule.Passes[^1];

    /// <summary>
    /// Strip length held between a mandrel and an outside radius, m.
    ///
    /// NOTE THE ARGUMENT ORDER - outer radius first, mandrel second. This mirrors the engine's
    /// private <c>coilLengthAtThickness</c>, which takes them the opposite way round from
    /// <see cref="CoilModel.CoilLengthFromRadius"/>. The two compute the same quantity; the
    /// engine's version is reproduced separately rather than redirected to CoilModel because it
    /// omits the <c>Math.max(0, ...)</c> floor, and quietly adding one would change the frame the
    /// engine emits for a nonsensical coil.
    /// </summary>
    public static double CoilLengthAtThickness(
        double outerRadiusMm,
        double mandrelRadiusMm,
        double thicknessMm)
    {
        if (thicknessMm <= 0) return 0;
        var area = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
        return area / thicknessMm / 1000;
    }
}
