using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>
/// UNIT CONVERSION - §10.2 of the master spec. Port of <c>src/config/unitConversion.ts</c>.
///
/// SCOPE NOTE. The TypeScript module also carries the scene-unit helpers (<c>mmToScene</c>,
/// <c>rollGapToScene</c>, <c>stripThicknessToScene</c>) because the React twin imported its
/// geometry conversions from the same file. Those are NOT ported here: in the .NET topology the
/// scene lives in <c>wwwroot/js/twin/</c> and owns its own conversions, and a Domain project that
/// knew about Three.js units would be the wrong shape. What is ported is the engineering half -
/// the conversions the physics models actually call.
/// </summary>
public static class UnitConversion
{
    /// <summary>Metric tonnes-force -&gt; kilonewtons.</summary>
    public static double TonnesToKn(double t) => t * EngineeringConfig.Gravity;

    /// <summary>Kilonewtons -&gt; metric tonnes-force.</summary>
    public static double KnToTonnes(double kN) => kN / EngineeringConfig.Gravity;

    /// <summary>Newtons -&gt; metric tonnes-force.</summary>
    public static double NewtonsToTonnes(double n) => n / (EngineeringConfig.Gravity * 1000);

    /// <summary>m/min -&gt; m/s.</summary>
    public static double MpmToMps(double mpm) => mpm / 60;

    /// <summary>m/s -&gt; m/min.</summary>
    public static double MpsToMpm(double mps) => mps * 60;

    /// <summary>Millimetres -&gt; micrometres.</summary>
    public static double MmToUm(double mm) => mm * 1000;

    /// <summary>Micrometres -&gt; millimetres.</summary>
    public static double UmToMm(double um) => um / 1000;

    /// <summary>rpm -&gt; radians per second.</summary>
    public static double RpmToRadPerSec(double rpm) => rpm * 2 * Math.PI / 60;

    /// <summary>radians per second -&gt; rpm.</summary>
    public static double RadPerSecToRpm(double rad) => rad * 60 / (2 * Math.PI);

    /// <summary>
    /// Clamp. Written as the TypeScript writes it - <c>min(max(v, lo), hi)</c> - rather than as
    /// <see cref="Math.Clamp(double,double,double)"/>, which throws when <c>lo &gt; hi</c> where
    /// JavaScript quietly returns <c>hi</c>. The models never pass an inverted range, but the
    /// difference is a throw versus a value and that is not a difference to leave to chance.
    /// </summary>
    public static double Clamp(double value, double min, double max) =>
        Math.Min(Math.Max(value, min), max);

    /// <summary>Linear interpolation.</summary>
    public static double Lerp(double a, double b, double t) => a + (b - a) * t;

    /// <summary>
    /// Frame-rate independent exponential damping (§10.4). <paramref name="halfLife"/> is the time
    /// in seconds for the remaining error to halve, so the response is identical at any tick rate.
    /// </summary>
    public static double Damp(double current, double target, double halfLife, double dt)
    {
        if (halfLife <= 0) return target;
        var factor = 1 - Math.Pow(2, -dt / halfLife);
        return current + (target - current) * factor;
    }
}
