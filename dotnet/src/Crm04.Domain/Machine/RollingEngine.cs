using System.Globalization;
using Crm04.Domain.Configuration;
using Crm04.Domain.Types;

namespace Crm04.Domain.Machine;

/// <summary>
/// Derived engineering indicators. Port of the pure helpers in <c>src/machine/rollingEngine.ts</c>.
///
/// EVERY VALUE HERE IS DERIVED FROM VALUES ALREADY ON SCREEN, and none of them is a tag. That is
/// why the UI renders them through <c>DerivedRow</c> in the dimmer treatment rather than through
/// <c>ValueReadout</c>: throughput is not a measurement, it is arithmetic on a thickness, a width
/// and a speed, and presenting it with the same weight as an instrument reading would overstate
/// what the mill actually told us.
///
/// They live in the domain, not the UI, so the number is computed once on the server and
/// transported - which keeps the §18 rule that a value on screen has exactly one source.
/// </summary>
public static class RollingEngine
{
    /// <summary>
    /// Production rate at the current speed and section, t/h.
    ///
    /// t/h = m³/s × kg/m³ × 3600 / 1000, which collapses to the 3.6 factor below.
    /// </summary>
    public static double Throughput(MachineState state)
    {
        var thicknessM = state.Thickness.Actual / 1000d;
        var widthM = state.Coil.Width / 1000d;
        var speedMps = state.Speed.Actual / 60d;
        return thicknessM * widthM * speedMps * EngineeringConfig.SteelDensity * 3.6d;
    }

    /// <summary>
    /// Specific energy, kWh/t. Zero at standstill rather than an infinity: dividing drive power
    /// by a throughput of nothing is not a large number, it is an undefined one.
    /// </summary>
    public static double SpecificEnergy(MachineState state)
    {
        var tph = Throughput(state);
        if (tph <= 0.001d) return 0d;
        return state.Drive.Power / tph;
    }

    /// <summary>
    /// Estimated time to finish the current pass, seconds, or null at standstill.
    ///
    /// Uses the ENTRY speed, because it is entry-side strip that is being consumed from the payoff
    /// reel. Using the exit speed would under-estimate the time by the reduction ratio.
    /// </summary>
    public static double? PassTimeRemaining(MachineState state)
    {
        if (state.Speed.Actual <= 0.1d) return null;

        var entrySpeedMpm = state.Thickness.Entry > 0d
            ? state.Speed.Actual * state.Thickness.Actual / state.Thickness.Entry
            : state.Speed.Actual;

        return state.Coil.RemainingLength / entrySpeedMpm * 60d;
    }

    /// <summary>Format seconds as m:ss for the pass countdown. An em dash when unknown.</summary>
    public static string FormatDuration(double? seconds)
    {
        if (seconds is not { } s || !double.IsFinite(s)) return "—";
        var m = (int)Math.Floor(s / 60d);
        var sec = (int)Math.Floor(s % 60d);
        return $"{m}:{sec.ToString("00", CultureInfo.InvariantCulture)}";
    }

    /// <summary>Format seconds as h:mm:ss for the rolling-time total.</summary>
    public static string FormatHms(double? seconds)
    {
        if (seconds is not { } s || !double.IsFinite(s) || s < 0d) return "—";
        var h = (int)Math.Floor(s / 3600d);
        var m = (int)Math.Floor(s % 3600d / 60d);
        var sec = (int)Math.Floor(s % 60d);
        return $"{h}:{m.ToString("00", CultureInfo.InvariantCulture)}:{sec.ToString("00", CultureInfo.InvariantCulture)}";
    }
}
