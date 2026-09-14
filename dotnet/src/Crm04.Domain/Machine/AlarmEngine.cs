using Crm04.Domain.Configuration;
using Crm04.Domain.Types;
using Crm04.Domain.Util;

namespace Crm04.Domain.Machine;

/// <summary>
/// ALARM ENGINE - §13.1 of the master spec. Port of <c>src/machine/alarmEngine.ts</c>.
///
/// Rule based, evaluated against <see cref="MachineState"/>. The engine is PURE: it reports which
/// conditions are currently true. Latching, acknowledgement, timestamps and history are the alarm
/// service's job - keeping them apart is what lets the rules be re-evaluated every frame without
/// churning the alarm list.
///
/// A RULE NEVER FIRES ON A NULL VALUE. On the 46-tag feed the hydraulic pressure tag does not
/// exist, and an alarm engine that treats "no tag" as "zero" would raise a permanent, meaningless
/// HYDRAULIC PRESSURE LOW (§7.4). That is why the pressure rule is guarded on null and the gauge
/// rules compare against <c>false</c> explicitly rather than testing falsiness.
/// </summary>
public static class AlarmEngine
{
    /// <summary>
    /// Auxiliary media rules. The ids and tag names are transcribed from the TypeScript rather
    /// than derived, because the TypeScript builds them with <c>key.toUpperCase()</c> on the
    /// camelCase state-object key: 'lpSystem' becomes 'LPSYSTEM', so the alarm's tag name is
    /// "LPSYSTEM.STATUS" even though the real tag is "LP.STATUS". That is a quirk of the original
    /// and it is reproduced deliberately - these strings are stored in ALARM_EVENT and compared
    /// by the parity test, so "fixing" them here would be a behavioural change wearing the
    /// costume of a tidy-up.
    /// </summary>
    private static readonly (string Key, string Label, TwinSection Section)[] AuxiliaryRules =
    [
        ("LUBRICATION", "Lubrication", TwinSection.Stand),
        ("COOLANT", "Roll coolant", TwinSection.RollBite),
        ("EXHAUST", "Exhaust", TwinSection.Stand),
        ("LPSYSTEM", "LP system", TwinSection.Hydraulics),
        ("HPLOADING", "HP loading", TwinSection.Hydraulics),
        ("HPBENDING", "HP bending", TwinSection.Hydraulics),
    ];

    public static IReadOnlyList<AlarmCondition> Evaluate(MachineState state)
    {
        var conditions = new List<AlarmCondition>();

        var forceLimits = EngineeringConfig.ForceLimits;
        var motorLimits = EngineeringConfig.MotorLimits;
        var tensionLimits = EngineeringConfig.TensionLimits;
        var thicknessTolerance = EngineeringConfig.ThicknessTolerance;
        var hydraulicPressureMin = EngineeringConfig.HydraulicPressureMin;

        var rolling = MachineStatusRules.IsRolling(state.MachineStatus);

        // ---- Rolling force ---------------------------------------------------------------
        var force = state.RollingForce.Actual;
        if (force >= forceLimits.Trip)
        {
            conditions.Add(new AlarmCondition(
                Id: "HIGH_ROLLING_FORCE",
                Severity: AlarmSeverity.Trip,
                Parameter: "Rolling force",
                TagName: "ROLL.FORCE.ACTUAL",
                ActualValue: force,
                Limit: forceLimits.Trip,
                Unit: "t",
                Message: $"ROLLING FORCE AT TRIP LIMIT — {JsNumber.ToFixed(force, 0)} t of " +
                         $"{JsNumber.ToJsString(MillConfig.Default.Ratings.MaxRollingForce)} t",
                Section: TwinSection.RollBite));
        }
        else if (force >= forceLimits.Alarm)
        {
            conditions.Add(new AlarmCondition(
                Id: "HIGH_ROLLING_FORCE",
                Severity: AlarmSeverity.Alarm,
                Parameter: "Rolling force",
                TagName: "ROLL.FORCE.ACTUAL",
                ActualValue: force,
                Limit: forceLimits.Alarm,
                Unit: "t",
                Message: $"HIGH ROLLING FORCE — {JsNumber.ToFixed(force, 0)} t exceeds " +
                         $"{JsNumber.ToFixed(forceLimits.Alarm, 0)} t",
                Section: TwinSection.RollBite));
        }
        else if (force >= forceLimits.Warning)
        {
            conditions.Add(new AlarmCondition(
                Id: "HIGH_ROLLING_FORCE",
                Severity: AlarmSeverity.Warning,
                Parameter: "Rolling force",
                TagName: "ROLL.FORCE.ACTUAL",
                ActualValue: force,
                Limit: forceLimits.Warning,
                Unit: "t",
                Message: $"ROLLING FORCE HIGH — {JsNumber.ToFixed(force, 0)} t above " +
                         $"{JsNumber.ToFixed(forceLimits.Warning, 0)} t",
                Section: TwinSection.RollBite));
        }

        // ---- Thickness deviation ---------------------------------------------------------
        // Only meaningful while the mill is actually reducing the strip.
        if (rolling)
        {
            var deviation = state.Thickness.Deviation;
            var absDeviation = Math.Abs(deviation);
            var sign = deviation >= 0d ? "+" : string.Empty;
            var toleranceText = JsNumber.ToJsString(thicknessTolerance);

            if (absDeviation > thicknessTolerance * 3d)
            {
                conditions.Add(new AlarmCondition(
                    Id: "THICKNESS_DEVIATION",
                    Severity: AlarmSeverity.Alarm,
                    Parameter: "Thickness deviation",
                    TagName: "STRIP.THICKNESS.DEVIATION",
                    ActualValue: deviation,
                    Limit: thicknessTolerance * 3d,
                    Unit: "µm",
                    Message: $"THICKNESS DEVIATION — {sign}{JsNumber.ToFixed(deviation, 1)} µm " +
                             $"against ±{toleranceText} µm target",
                    Section: TwinSection.Strip));
            }
            else if (absDeviation > thicknessTolerance)
            {
                conditions.Add(new AlarmCondition(
                    Id: "THICKNESS_DEVIATION",
                    Severity: AlarmSeverity.Warning,
                    Parameter: "Thickness deviation",
                    TagName: "STRIP.THICKNESS.DEVIATION",
                    ActualValue: deviation,
                    Limit: thicknessTolerance,
                    Unit: "µm",
                    Message: $"THICKNESS OUTSIDE TOLERANCE — {sign}{JsNumber.ToFixed(deviation, 1)} µm " +
                             $"against ±{toleranceText} µm target",
                    Section: TwinSection.Strip));
            }
        }

        // ---- Hydraulic pressure ----------------------------------------------------------
        // Guarded on null: no tag means no alarm, not a zero-pressure alarm.
        if (state.Hydraulics.LoadingPressure is { } loadingPressure &&
            rolling &&
            loadingPressure < hydraulicPressureMin)
        {
            conditions.Add(new AlarmCondition(
                Id: "HYDRAULIC_PRESSURE_LOW",
                Severity: AlarmSeverity.Alarm,
                Parameter: "HAGC loading pressure",
                TagName: "HYD.LOADING.PRESSURE",
                ActualValue: loadingPressure,
                Limit: hydraulicPressureMin,
                Unit: "bar",
                Message: $"HYDRAULIC PRESSURE LOW — {JsNumber.ToFixed(loadingPressure, 0)} bar below " +
                         $"{JsNumber.ToJsString(hydraulicPressureMin)} bar",
                Section: TwinSection.Hydraulics));
        }

        // ---- Drive current ---------------------------------------------------------------
        var current = state.Drive.Current;
        if (current >= motorLimits.CurrentMax)
        {
            conditions.Add(new AlarmCondition(
                Id: "DRIVE_CURRENT_HIGH",
                Severity: AlarmSeverity.Alarm,
                Parameter: "Main drive current",
                TagName: "DRIVE.CURRENT",
                ActualValue: current,
                Limit: motorLimits.CurrentMax,
                Unit: "A",
                Message: $"MAIN DRIVE CURRENT HIGH — {JsNumber.ToFixed(current, 0)} A at rating",
                Section: TwinSection.Drive));
        }
        else if (current >= motorLimits.CurrentMax * 0.9d)
        {
            conditions.Add(new AlarmCondition(
                Id: "DRIVE_CURRENT_HIGH",
                Severity: AlarmSeverity.Warning,
                Parameter: "Main drive current",
                TagName: "DRIVE.CURRENT",
                ActualValue: current,
                Limit: motorLimits.CurrentMax * 0.9d,
                Unit: "A",
                Message: $"MAIN DRIVE CURRENT HIGH — {JsNumber.ToFixed(current, 0)} A above 90% of rating",
                Section: TwinSection.Drive));
        }

        // ---- Strip tension ---------------------------------------------------------------
        if (rolling)
        {
            if (state.Tension.Entry < tensionLimits.EntryMin)
            {
                conditions.Add(new AlarmCondition(
                    Id: "ENTRY_TENSION_LOW",
                    Severity: AlarmSeverity.Alarm,
                    Parameter: "Entry tension",
                    TagName: "TENSION.ENTRY",
                    ActualValue: state.Tension.Entry,
                    Limit: tensionLimits.EntryMin,
                    Unit: "kN",
                    Message: $"ENTRY TENSION LOW — {JsNumber.ToFixed(state.Tension.Entry, 1)} kN, strip may slip",
                    Section: TwinSection.EntryReel));
            }

            if (state.Tension.Exit > tensionLimits.ExitMax)
            {
                conditions.Add(new AlarmCondition(
                    Id: "EXIT_TENSION_HIGH",
                    Severity: AlarmSeverity.Alarm,
                    Parameter: "Exit tension",
                    TagName: "TENSION.EXIT",
                    ActualValue: state.Tension.Exit,
                    Limit: tensionLimits.ExitMax,
                    Unit: "kN",
                    Message: $"EXIT TENSION HIGH — {JsNumber.ToFixed(state.Tension.Exit, 1)} kN, strip break risk",
                    Section: TwinSection.ExitReel));
            }
        }

        // ---- Emergency / fast stop -------------------------------------------------------
        // `== true` and not merely truthy: on a feed with no E-stop tag the flag is null, and
        // "we cannot see the E-stop" must not raise an E-stop alarm.
        if (state.Interlocks.EmergencyStop == true)
        {
            conditions.Add(new AlarmCondition(
                Id: "EMERGENCY_STOP",
                Severity: AlarmSeverity.Trip,
                Parameter: "Emergency stop",
                TagName: "EMERGENCY.STOP",
                ActualValue: 1d,
                Limit: 0d,
                Unit: string.Empty,
                Message: "EMERGENCY STOP ACTIVE",
                Section: TwinSection.Stand));
        }

        if (state.MachineStatus == MachineStatus.FastStop)
        {
            conditions.Add(new AlarmCondition(
                Id: "FAST_STOP",
                Severity: AlarmSeverity.Trip,
                Parameter: "Fast stop",
                TagName: "FAST.STOP",
                ActualValue: 1d,
                Limit: 0d,
                Unit: string.Empty,
                Message: "FAST STOP — MILL DECELERATING TO STANDSTILL",
                Section: TwinSection.Stand));
        }

        // ---- Auxiliary media -------------------------------------------------------------
        var aux = state.AuxiliarySystems;
        var auxValues = new[]
        {
            aux.Lubrication, aux.Coolant, aux.Exhaust, aux.LpSystem, aux.HpLoading, aux.HpBending,
        };

        for (var i = 0; i < AuxiliaryRules.Length; i++)
        {
            // Only FAULT raises. NO_TAG and UNKNOWN do not - see the class comment.
            if (auxValues[i] != Health.Fault) continue;

            var (key, label, section) = AuxiliaryRules[i];
            conditions.Add(new AlarmCondition(
                Id: $"AUX_{key}",
                Severity: AlarmSeverity.Alarm,
                Parameter: label,
                TagName: $"{key}.STATUS",
                ActualValue: 0d,
                Limit: 1d,
                Unit: string.Empty,
                Message: $"{label.ToUpperInvariant()} FAULT",
                Section: section));
        }

        // ---- Gauge -----------------------------------------------------------------------
        // `== false` explicitly: a null ready flag means no gauge status tag on this feed, which
        // is not the same as a gauge reporting that it is not ready.
        if (state.Gauges.Etr.Ready == false || state.Gauges.Dtr.Ready == false)
        {
            var which = state.Gauges.Etr.Ready == false ? "ETR" : "DTR";
            conditions.Add(new AlarmCondition(
                Id: "GAUGE_NOT_READY",
                Severity: AlarmSeverity.Warning,
                Parameter: "X-ray gauge",
                TagName: $"GAUGE.{which}.READY",
                ActualValue: 0d,
                Limit: 1d,
                Unit: string.Empty,
                Message: $"{which} GAUGE NOT READY — AGC THICKNESS FEEDBACK UNAVAILABLE",
                Section: which == "ETR" ? TwinSection.GaugeExit : TwinSection.GaugeEntry));
        }

        // ---- Communication ---------------------------------------------------------------
        // The one rule with no twin section: a dead feed is not a place on the machine.
        if (state.Communication.Stale || !state.Communication.Connected)
        {
            conditions.Add(new AlarmCondition(
                Id: "COMMUNICATION_LOST",
                Severity: AlarmSeverity.Alarm,
                Parameter: "Data feed",
                TagName: "COMMS",
                ActualValue: state.Communication.AgeMs,
                Limit: EngineeringConfig.StaleAfterMs,
                Unit: "ms",
                Message: state.Communication.Connected
                    ? $"DATA STALE — no update for {JsNumber.ToFixed(state.Communication.AgeMs / 1000d, 1)} s"
                    : "COMMUNICATION LOST — DATA SOURCE DISCONNECTED",
                Section: null));
        }

        return conditions;
    }
}
