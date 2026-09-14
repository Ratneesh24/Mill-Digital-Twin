using Crm04.Domain.Configuration;
using Crm04.Domain.Types;

namespace Crm04.Domain.Simulation;

/// <summary>
/// The modifiers a scenario applies to the physics INPUTS. Port of the TypeScript
/// <c>ScenarioModifiers</c>.
/// </summary>
/// <param name="FlowStressScale">
/// Multiplies the material's mean flow stress - harder or softer steel than the schedule assumed.
/// This is the lever that actually raises force when AGC is closed: the loop holds the delivered
/// thickness, so a harder coil is absorbed as more force, not as a thicker strip. (Offsetting the
/// gap does nothing under a working AGC, which is exactly what a real mill does.)
/// </param>
/// <param name="GapOffsetMm">Added to the commanded roll gap S0, mm. Negative = tighter gap.</param>
/// <param name="ForceScale">Multiplies the resulting force - used only for the trip-path rehearsal.</param>
/// <param name="AgcEnabled">AGC allowed to close the loop.</param>
/// <param name="GaugeReady">X-ray gauges ready.</param>
/// <param name="HydraulicPressureFactor">Multiplies the HAGC loading pressure.</param>
/// <param name="BendingForceKn">
/// Work roll bending force, kN. <c>null</c> means NO TAG - the twin greys the bending readout out
/// and does not animate a bend (§7.4).
/// </param>
/// <param name="BendingPressureBar">Work roll bending pressure, bar, or null when no tag exists.</param>
public sealed record ScenarioModifiers(
    double FlowStressScale,
    double GapOffsetMm,
    double ForceScale,
    bool AgcEnabled,
    bool GaugeReady,
    double HydraulicPressureFactor,
    double? BendingForceKn,
    double? BendingPressureBar);

/// <summary>A scenario's presentation metadata. Port of the TypeScript <c>ScenarioDescriptor</c>.</summary>
/// <param name="Id">The wire id.</param>
/// <param name="Label">Button text.</param>
/// <param name="Description">Tooltip body.</param>
/// <param name="Validates">Which §17 validation test this scenario supports, if any.</param>
public sealed record ScenarioDescriptor(
    ScenarioId Id,
    string Label,
    string Description,
    string? Validates = null);

/// <summary>
/// SIMULATION SCENARIOS - the operating conditions the twin can be driven into so the §17
/// validation tests are exercisable from the UI. Port of
/// <c>src/simulation/simulationScenarios.ts</c>.
///
/// A scenario is a set of MODIFIERS applied to the physics inputs, never a set of fake outputs.
/// Selecting HIGH_FORCE does not write a large number into the force display - it closes the gap
/// and stiffens the material, and the force that results comes out of the same equations as
/// always. That distinction is the whole point: the twin must stay one coherent machine (§18) even
/// while being deliberately disturbed.
///
/// PORTING NOTE. Every branch of <see cref="Apply"/> is written as <c>Base with { ... }</c>,
/// mirroring the TypeScript's <c>{ ...BASE, x: y }</c>. Constructing a <see cref="ScenarioModifiers"/>
/// by hand instead would silently drop every field the branch does not mention - a
/// <c>HYDRAULIC_LOW</c> with <c>BendingForceKn = null</c> would turn the bending readout into
/// NO TAG, and one with <c>FlowStressScale = 0</c> would produce a mill that rolls with no force.
/// Neither throws. Always clone.
/// </summary>
public static class SimulationScenarios
{
    private static readonly ScenarioModifiers Base = new(
        FlowStressScale: 1,
        GapOffsetMm: 0,
        ForceScale: 1,
        AgcEnabled: true,
        GaugeReady: true,
        HydraulicPressureFactor: 1,
        // Bending IS instrumented on the simulated mill (74-tag model). It becomes NO TAG only in
        // the 46-tag live profile, which is a tag-map decision, not a scenario one.
        BendingForceKn: 320,
        BendingPressureBar: 145);

    /// <summary>The scenario list, in the order the control panel renders it.</summary>
    public static readonly IReadOnlyList<ScenarioDescriptor> All =
    [
        new(ScenarioId.Normal,
            "Normal production",
            "Schedule followed, AGC closed, all media healthy."),
        new(ScenarioId.HighForce,
            "High rolling force",
            "Material 22% harder than the schedule assumed. AGC holds the delivered thickness, so the extra resistance shows up as force — which is what a real mill does. Force rises through the warning band by physics, not by injection.",
            "Test 7 — high force"),
        new(ScenarioId.ThicknessExcursion,
            "Thickness excursion",
            "Gap disturbed by +0.05 mm with AGC unable to fully reject it.",
            "Test 7 — thickness deviation alarm"),
        new(ScenarioId.AgcOff,
            "AGC off (position mode)",
            "HAGC loop opened. Incoming hot-band variation passes straight through to the exit gauge."),
        new(ScenarioId.HydraulicLow,
            "Hydraulic pressure low",
            "HAGC loading pressure collapses below the alarm limit; the interlock chain drops."),
        new(ScenarioId.GaugeNotReady,
            "ETR gauge not ready",
            "X-ray gauge drops out of ready — MILL NOT READY names the gauge as the cause.",
            "Test 7 / §13.2 named-cause interlock"),
        new(ScenarioId.CommunicationLoss,
            "Communication loss",
            "The simulated PLC stops publishing. Values go STALE, the twin stops animating and the last valid timestamp is held.",
            "Test 8 — communication loss"),
        new(ScenarioId.EmergencyStop,
            "Emergency stop",
            "E-stop asserted. Fast-stop ramp, status FAST STOP, alarm raised.",
            "Test 6 — fast stop"),
    ];

    /// <summary>The modifiers for a scenario. See the class remarks on <c>with</c>.</summary>
    public static ScenarioModifiers Apply(ScenarioId id) => id switch
    {
        // Harder material only. The force that results is computed by the same equations as
        // always - never asserted.
        ScenarioId.HighForce => Base with { FlowStressScale = 1.22 },

        ScenarioId.ThicknessExcursion => Base with { GapOffsetMm = 0.05, AgcEnabled = false },

        ScenarioId.AgcOff => Base with { AgcEnabled = false },

        ScenarioId.HydraulicLow => Base with
        {
            HydraulicPressureFactor =
                EngineeringConfig.HydraulicPressureMin /
                EngineeringConfig.HydraulicPressureAtMaxForce * 0.8,
        },

        ScenarioId.GaugeNotReady => Base with { GaugeReady = false },

        // COMMUNICATION_LOSS and EMERGENCY_STOP disturb the FEED and the STATE MACHINE, not the
        // physics inputs - so they share NORMAL's modifiers. The engine handles them elsewhere.
        _ => Base,
    };

    /// <summary>
    /// The descriptor for a scenario, falling back to NORMAL exactly as the TypeScript's
    /// <c>?? SCENARIOS[0]</c> does.
    /// </summary>
    public static ScenarioDescriptor Get(ScenarioId id) =>
        All.FirstOrDefault(s => s.Id == id) ?? All[0];
}
