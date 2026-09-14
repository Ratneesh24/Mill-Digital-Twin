using Crm04.Domain.Configuration;

namespace Crm04.Domain.Simulation;

/// <summary>
/// COIL MODEL - §8.5 of the master spec. Port of <c>src/simulation/coilModel.ts</c>.
///
/// <code>coilRadius = f(mandrelRadius, stripThickness, woundLength)</code>
///
/// Internally consistent, not metallurgically exact: as strip winds or unwinds, reel rpm changes,
/// coil diameter changes and remaining length changes, and all three follow from the same single
/// relation below.
/// </summary>
public static class CoilModel
{
    /// <summary>
    /// Outside radius of a coil holding <paramref name="woundLengthM"/> of strip, mm.
    ///
    /// Derivation (area conservation on the coil cross-section):
    /// <code>
    ///   wound cross-sectional area = pi(r^2 - r_m^2) = h * L
    ///   ->  r = sqrt( r_m^2 + h*L/pi )
    /// </code>
    ///
    /// with h and r in mm and L in mm. This is exact for a tightly wound spiral of constant
    /// thickness and is the reason the reel diameters in the twin move at the correct,
    /// decelerating rate rather than linearly.
    ///
    /// LIMITATION: assumes zero interlayer air and no coil-set / telescoping.
    /// </summary>
    public static double CoilRadiusFromLength(
        double mandrelRadiusMm,
        double stripThicknessMm,
        double woundLengthM)
    {
        var woundLengthMm = Math.Max(0, woundLengthM) * 1000;
        var area = stripThicknessMm * woundLengthMm;
        return Math.Sqrt(mandrelRadiusMm * mandrelRadiusMm + area / Math.PI);
    }

    /// <summary>Strip length held between a mandrel and a given outside radius, m.</summary>
    public static double CoilLengthFromRadius(
        double mandrelRadiusMm,
        double stripThicknessMm,
        double outerRadiusMm)
    {
        if (stripThicknessMm <= 0) return 0;
        var area = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
        return Math.Max(0, area / stripThicknessMm) / 1000;
    }

    /// <summary>
    /// Number of wraps on the mandrel. <c>n = (r_outer - r_mandrel) / h</c>
    /// </summary>
    public static double CoilLayers(
        double mandrelRadiusMm,
        double stripThicknessMm,
        double outerRadiusMm)
    {
        if (stripThicknessMm <= 0) return 0;
        return Math.Max(0, (outerRadiusMm - mandrelRadiusMm) / stripThicknessMm);
    }

    /// <summary>
    /// Reel rotational speed for a given strip line speed, rpm.
    ///
    /// <code>w = v / r   ->   n = v / (2pi*r)</code>
    ///
    /// Strip speed is the shared quantity: the mill sets it, and both reels must follow it at
    /// whatever rpm their current diameter demands. This is what makes the outer reel visibly slow
    /// down as it fills.
    /// </summary>
    public static double ReelRpm(double lineSpeedMpm, double coilRadiusMm)
    {
        var radiusM = coilRadiusMm / 1000;
        if (radiusM <= 1e-6) return 0;
        return lineSpeedMpm / (2 * Math.PI * radiusM);
    }

    /// <summary>
    /// Reel motor torque required to hold a given strip tension, kNm. <c>G = T * r</c>
    ///
    /// Torque therefore rises as the coil builds even at constant tension - the behaviour that
    /// makes ETR torque climb through a pass while DTR torque falls.
    ///
    /// LIMITATION: no inertia (dw/dt) term and no friction/windage term, so torque during
    /// acceleration is understated.
    /// </summary>
    public static double ReelTorque(double tensionKn, double coilRadiusMm) =>
        tensionKn * coilRadiusMm / 1000;

    /// <summary>Reel motor current from torque, A - linear drive approximation.</summary>
    public static double ReelCurrent(double torqueKNm, double ratedTorqueKNm, double ratedCurrentA)
    {
        if (ratedTorqueKNm <= 0) return 0;
        return Math.Abs(torqueKNm) / ratedTorqueKNm * ratedCurrentA;
    }

    /// <summary>Coil mass from geometry, t.</summary>
    public static double CoilMass(double mandrelRadiusMm, double outerRadiusMm, double widthMm)
    {
        var areaMm2 = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
        var volumeM3 = areaMm2 * widthMm / 1e9;
        return volumeM3 * EngineeringConfig.SteelDensity / 1000;
    }

    /// <summary>
    /// Strip length after a thickness change, m. <c>L1 = L0 * h0 / h1</c>
    ///
    /// Volume conservation again: a coil rolled thinner gets longer by exactly the reduction
    /// ratio. This is what carries coil length forward between passes and keeps the "remaining
    /// length" countdown consistent across a reversal.
    /// </summary>
    public static double LengthAfterReduction(
        double lengthM,
        double inputThickness,
        double outputThickness)
    {
        if (outputThickness <= 0) return lengthM;
        return lengthM * inputThickness / outputThickness;
    }
}
