using Crm04.Domain.Types;

namespace Crm04.Domain.Coils;

/// <summary>Port of <c>CoilData</c> in <c>src/types/coil.ts</c>. All dimensions mm, mass tonnes.</summary>
public sealed record CoilData(
    string Id,
    string? Grade,
    double Width,
    double EntryThickness,
    double FinalThickness,
    double Mass,
    double InnerDiameter,
    double OuterDiameter);

/// <param name="Reduction">Scheduled reduction, %. Derived, but kept explicit for display parity with MMS.</param>
/// <param name="EntrySpecificTension">Entry (back) specific tension reference, N/mm².</param>
/// <param name="PredictedForce">Predicted roll separating force from the schedule, t.</param>
public sealed record PassScheduleEntry(
    int Pass,
    RollingDirection Direction,
    double InputThickness,
    double OutputThickness,
    double Reduction,
    double SpeedReference,
    double EntrySpecificTension,
    double ExitSpecificTension,
    double PredictedForce);

/// <summary>
/// The pass schedule the mill is working to.
///
/// Today this is the demo schedule generated from <c>src/data/demoPassSchedule.ts</c>. On a plant
/// deployment it comes from the ABP / pass-schedule system through the PASS_SCHEDULE tables, and
/// the panel labels which it is showing - a representative schedule must never be mistaken for
/// the plan a real coil is being rolled to.
/// </summary>
public sealed record PassSchedule(
    CoilData Coil,
    IReadOnlyList<PassScheduleEntry> Passes,
    string Source)
{
    public static PassSchedule Demo { get; } = new(
        PassScheduleData.Coil,
        PassScheduleData.Passes,
        PassScheduleData.Source);

    /// <summary>The entry for a 1-based pass number, or null when out of range.</summary>
    public PassScheduleEntry? ForPass(int pass) =>
        pass >= 1 && pass <= Passes.Count ? Passes[pass - 1] : null;
}
