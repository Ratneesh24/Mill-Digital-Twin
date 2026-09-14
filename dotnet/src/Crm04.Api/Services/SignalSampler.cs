using Crm04.Domain.Telemetry;
using Crm04.Domain.Types;

namespace Crm04.Api.Services;

/// <summary>
/// Feeds one <see cref="MachineState"/> into the trend history, signal by signal.
///
/// Port of the <c>telemetryStore.record(...)</c> call in <c>machineStore.applyFrame</c>. Every
/// series reads from the ALREADY-PROJECTED state rather than from tags, so the number on the
/// trend chart is by construction the same number the KPI tile shows — which is the §18
/// invariant that "the value beside the machine == MachineState == the trend chart".
///
/// NULLS ARE SKIPPED, NOT ZEROED. A parameter with no tag on this feed never starts a series at
/// all, rather than recording a flat line at zero that looks like a real measurement of nothing
/// happening. On the live CRM04 feed that is most of the hydraulics and all of the bending.
/// </summary>
public sealed class SignalSampler
{
    private readonly TrendStore _trends;

    /// <summary>Signal key to ordinal, resolved once. The hot path is an array write.</summary>
    private readonly Dictionary<string, int> _ordinals;

    public SignalSampler(TrendStore trends)
    {
        _trends = trends;
        _ordinals = SignalCatalog.All.ToDictionary(s => s.Key, s => s.Ordinal, StringComparer.Ordinal);
    }

    public void Sample(MachineState s)
    {
        // A stale feed records nothing. Continuing to append the last known value would draw a
        // flat line that is indistinguishable from a genuinely steady mill — the chart would show
        // calm where the truth is silence.
        if (s.Communication.Stale) return;

        var t = s.Communication.LastFrameTimestamp != 0
            ? s.Communication.LastFrameTimestamp
            : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // THICKNESS
        Record("thickness", s.Thickness.Actual, t);
        Record("thicknessEntry", s.Thickness.Entry, t);
        Record("thicknessTarget", s.Thickness.Reference, t);
        Record("thicknessDeviation", s.Thickness.Deviation, t);
        Record("reduction", s.Thickness.Reduction, t);
        Record("gaugeDtr", s.Gauges.Dtr.Thickness, t);
        Record("gaugeEtr", s.Gauges.Etr.Thickness, t);

        // ROLLING
        Record("speed", s.Speed.Actual, t);
        Record("speedRef", s.Speed.Reference, t);
        Record("rollingForce", s.RollingForce.Actual, t);
        Record("rollingForceRef", s.RollingForce.Reference, t);
        Record("forcePercent", s.RollingForce.Percentage, t);
        Record("rollGap", s.RollGap.Actual, t);
        Record("rollGapRef", s.RollGap.Reference, t);
        Record("rollRpm", s.Rolls.UpperWork.Rpm, t);

        // WORK ROLL / SHAPE
        Record("wrTopBending", s.Rolls.UpperWork.BendingForce, t);
        Record("wrBottomBending", s.Rolls.LowerWork.BendingForce, t);
        Record("rollGapTilt", s.RollGap.Tilt, t);
        Record("forceOs", s.RollingForce.Os, t);
        Record("forceDs", s.RollingForce.Ds, t);

        // TENSION
        Record("entryTension", s.Tension.Entry, t);
        Record("exitTension", s.Tension.Exit, t);
        Record("entryTensionRef", s.Tension.EntryReference, t);
        Record("exitTensionRef", s.Tension.ExitReference, t);
        Record("entrySpecificTension", s.Tension.EntrySpecific, t);
        Record("exitSpecificTension", s.Tension.ExitSpecific, t);

        // DRIVE
        Record("torque", s.Drive.Torque, t);
        Record("current", s.Drive.Current, t);
        Record("power", s.Drive.Power, t);
        Record("driveRpm", s.Drive.Rpm, t);
        Record("motorLoad", s.Drive.TorquePercentage, t);

        // HYDRAULIC
        Record("loadingPressure", s.Hydraulics.LoadingPressure, t);
        Record("bendingPressure", s.Hydraulics.BendingPressure, t);
        Record("gapPosition", s.Hydraulics.GapPosition, t);
        Record("lpPressure", s.Hydraulics.LpPressure, t);

        // COIL / STRIP
        Record("coilDiameter", s.Coil.Diameter, t);
        Record("coilRemaining", s.Coil.RemainingLength, t);
        Record("passProgress", s.Pass.Progress * 100d, t);

        // SYSTEM
        Record("massFlowError", s.Diagnostics.MassFlowErrorPct, t);
        Record("updateRate", s.Communication.UpdateRateHz, t);
    }

    private void Record(string key, double? value, long timestampMs)
    {
        if (value is null) return;
        if (_ordinals.TryGetValue(key, out var ordinal)) _trends.Record(ordinal, value.Value, timestampMs);
    }
}
