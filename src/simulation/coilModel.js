/**
 * COIL MODEL — §8.5 of the master spec.
 *
 *   coilRadius = f(mandrelRadius, stripThickness, woundLength)
 *
 * Internally consistent, not metallurgically exact: as strip winds or unwinds,
 * reel rpm changes, coil diameter changes and remaining length changes, and all
 * three follow from the same single relation below.
 */
import { STEEL_DENSITY } from '../config/engineeringConfig';
/**
 * Outside radius of a coil holding `woundLength` of strip, mm.
 *
 * Derivation (area conservation on the coil cross-section):
 *
 *   wound cross-sectional area = π(r² − r_m²) = h · L
 *   →  r = √( r_m² + h·L/π )
 *
 * with h and r in mm and L in mm. This is exact for a tightly wound spiral of
 * constant thickness and is the reason the reel diameters in the twin move at
 * the correct, decelerating rate rather than linearly.
 *
 * LIMITATION: assumes zero interlayer air and no coil-set / telescoping.
 */
export function coilRadiusFromLength(mandrelRadiusMm, stripThicknessMm, woundLengthM) {
    const woundLengthMm = Math.max(0, woundLengthM) * 1000;
    const area = stripThicknessMm * woundLengthMm;
    return Math.sqrt(mandrelRadiusMm * mandrelRadiusMm + area / Math.PI);
}
/** Strip length held between a mandrel and a given outside radius, m. */
export function coilLengthFromRadius(mandrelRadiusMm, stripThicknessMm, outerRadiusMm) {
    if (stripThicknessMm <= 0)
        return 0;
    const area = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
    return Math.max(0, area / stripThicknessMm) / 1000;
}
/**
 * Number of wraps on the mandrel.
 *   n = (r_outer − r_mandrel) / h
 */
export function coilLayers(mandrelRadiusMm, stripThicknessMm, outerRadiusMm) {
    if (stripThicknessMm <= 0)
        return 0;
    return Math.max(0, (outerRadiusMm - mandrelRadiusMm) / stripThicknessMm);
}
/**
 * Reel rotational speed for a given strip line speed, rpm.
 *
 *   ω = v / r   →   n = v / (2π·r)
 *
 * Strip speed is the shared quantity: the mill sets it, and both reels must
 * follow it at whatever rpm their current diameter demands. This is what makes
 * the outer reel visibly slow down as it fills.
 */
export function reelRPM(lineSpeedMpm, coilRadiusMm) {
    const radiusM = coilRadiusMm / 1000;
    if (radiusM <= 1e-6)
        return 0;
    return lineSpeedMpm / (2 * Math.PI * radiusM);
}
/**
 * Reel motor torque required to hold a given strip tension, kNm.
 *
 *   G = T · r
 *
 * Torque therefore rises as the coil builds even at constant tension — the
 * behaviour that makes ETR torque climb through a pass while DTR torque falls.
 *
 * LIMITATION: no inertia (dω/dt) term and no friction/windage term, so torque
 * during acceleration is understated.
 */
export function reelTorque(tensionKN, coilRadiusMm) {
    return (tensionKN * coilRadiusMm) / 1000;
}
/** Reel motor current from torque, A — linear drive approximation. */
export function reelCurrent(torqueKNm, ratedTorqueKNm, ratedCurrentA) {
    if (ratedTorqueKNm <= 0)
        return 0;
    return (Math.abs(torqueKNm) / ratedTorqueKNm) * ratedCurrentA;
}
/** Coil mass from geometry, t. */
export function coilMass(mandrelRadiusMm, outerRadiusMm, widthMm) {
    const areaMm2 = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
    const volumeM3 = (areaMm2 * widthMm) / 1e9;
    return (volumeM3 * STEEL_DENSITY) / 1000;
}
/**
 * Strip length after a thickness change, m.
 *
 *   L1 = L0 · h0 / h1
 *
 * Volume conservation again: a coil rolled thinner gets longer by exactly the
 * reduction ratio. This is what carries coil length forward between passes and
 * keeps the "remaining length" countdown consistent across a reversal.
 */
export function lengthAfterReduction(lengthM, inputThickness, outputThickness) {
    if (outputThickness <= 0)
        return lengthM;
    return (lengthM * inputThickness) / outputThickness;
}
