/**
 * ROLLING KINEMATICS & MATERIAL MODEL — §8 of the master spec.
 *
 * Shared primitives used by the force, thickness, drive and tension models.
 * Every function here is single-purpose and pure (§19.3): same inputs, same
 * outputs, no hidden state, no randomness.
 *
 * MODEL CLASS: simplified textbook cold-rolling relations (Hitchcock roll
 * flattening + a Bland–Ford-type mean-pressure form). NOT the mill technology
 * model (§19.6).
 */
import { engineeringConfig } from '../config/engineeringConfig';
/**
 * Reduction, %.
 *   r = (h0 - h1) / h0 × 100
 */
export function calculateReduction(inputThickness, outputThickness) {
    if (inputThickness <= 0)
        return 0;
    return ((inputThickness - outputThickness) / inputThickness) * 100;
}
/**
 * Output thickness from a scheduled reduction (§8.1 pass-schedule form).
 *   h1 = h0 × (1 - r)
 */
export function outputThicknessFromReduction(inputThickness, reductionPct) {
    return inputThickness * (1 - reductionPct / 100);
}
/**
 * True (logarithmic) strain through the pass.
 *   ε = ln(h0 / h1)
 * Cold rolling is plane strain, so this is also the equivalent strain up to the
 * plane-strain factor applied in the force model.
 */
export function calculateTrueStrain(inputThickness, outputThickness) {
    if (inputThickness <= 0 || outputThickness <= 0)
        return 0;
    return Math.log(inputThickness / outputThickness);
}
/**
 * Mean deformation resistance (flow stress) over the pass, MPa.
 *
 *   kf(ε) = kf0 · (1 + C·ε)^n            [Ludwik-type hardening]
 *   kf_mean = (1/(ε1-ε0)) ∫ kf dε        [integrated, analytic]
 *
 * `accumulatedStrain` is the strain the material already carries from previous
 * passes — this is what makes pass 4 harder than pass 1, and it is why the twin
 * must track cumulative strain per coil rather than per pass.
 *
 * LIMITATION: a single fitted curve stands in for a per-grade flow curve, and
 * there is no recovery/annealing term.
 */
export function calculateMeanFlowStress(inputThickness, outputThickness, accumulatedStrain) {
    const { materialFactor: kf0, hardeningCoefficient: C, hardeningExponent: n } = engineeringConfig;
    const e0 = accumulatedStrain;
    const e1 = accumulatedStrain + calculateTrueStrain(inputThickness, outputThickness);
    if (e1 - e0 < 1e-9) {
        return kf0 * Math.pow(1 + C * e0, n);
    }
    // ∫ kf0 (1 + Cε)^n dε = kf0 (1 + Cε)^(n+1) / (C (n+1))
    const antiderivative = (e) => (kf0 * Math.pow(1 + C * e, n + 1)) / (C * (n + 1));
    return (antiderivative(e1) - antiderivative(e0)) / (e1 - e0);
}
/**
 * Hitchcock's flattened work-roll radius, mm.
 *
 *   R' = R · (1 + 16(1-ν²)·F' / (π·E·Δh))
 *
 * where F' is roll force per unit width (N/mm). Roll flattening is not a detail
 * in cold rolling: at high reduction on thin strip it can double the contact
 * length, and a model without it under-predicts force badly.
 *
 * LIMITATION: Hitchcock assumes elastic Hertzian flattening of a circular roll
 * and breaks down as the strip approaches the minimum rollable thickness.
 */
export function calculateFlattenedRadius(nominalRadiusMm, forcePerWidthNPerMm, draftMm) {
    if (draftMm <= 1e-6 || forcePerWidthNPerMm <= 0)
        return nominalRadiusMm;
    const { rollYoungsModulus: E, rollPoissonRatio: nu } = engineeringConfig;
    const c = (16 * (1 - nu * nu)) / (Math.PI * E);
    const flattened = nominalRadiusMm * (1 + (c * forcePerWidthNPerMm) / draftMm);
    // Guard: cap flattening at 4x nominal so a numerical excursion cannot produce
    // a non-physical contact length.
    return Math.min(flattened, nominalRadiusMm * 4);
}
/**
 * Arc-of-contact (projected contact length), mm.
 *   L = √(R' · Δh)                                        (§8.2)
 */
export function calculateContactLength(flattenedRadiusMm, draftMm) {
    if (draftMm <= 0)
        return 0;
    return Math.sqrt(flattenedRadiusMm * draftMm);
}
/**
 * Roll surface speed from strip exit speed, m/min.
 *
 *   v_exit = v_roll · (1 + f)   →   v_roll = v_exit / (1 + f)
 *
 * Forward slip f is what makes the strip leave the bite faster than the roll
 * surface. Deriving roll speed this way (rather than setting it independently)
 * is what keeps §8.6's "mill speed changes → roll rpm changes" coupling honest.
 */
export function rollSurfaceSpeedFromStripSpeed(stripExitSpeedMpm) {
    return stripExitSpeedMpm / (1 + engineeringConfig.forwardSlip);
}
/**
 * Work roll rotational speed, rpm (§8.4).
 *
 *   rollRPM = v_surface / (π · D)
 *
 * with v in m/min and D in mm (hence the 1000 factor). Rotation is DERIVED from
 * speed — there are no arbitrary animation timers anywhere in the twin, and
 * zero speed necessarily means zero rpm.
 */
export function calculateRollRPM(surfaceSpeedMpm, rollDiameterMm) {
    if (rollDiameterMm <= 0)
        return 0;
    return (surfaceSpeedMpm * 1000) / (Math.PI * rollDiameterMm);
}
/**
 * Entry strip speed from mass flow, m/min (§8.1).
 *
 *   h_entry · v_entry = h_exit · v_exit
 *
 * Volume is conserved through the bite (strip width is effectively constant in
 * cold rolling), so the entry side must run slower by exactly the reduction
 * ratio. The decoiler speed reference follows from this, not from a guess.
 */
export function entrySpeedFromMassFlow(exitSpeedMpm, inputThickness, outputThickness) {
    if (inputThickness <= 0)
        return exitSpeedMpm;
    return (exitSpeedMpm * outputThickness) / inputThickness;
}
/**
 * Mass-flow closure error, %.
 *
 * Surfaced as a DIAGNOSTIC (§8.1) — the sim never silently corrects itself with
 * this number. A non-zero value means the kinematic chain has drifted and is
 * worth showing to a commissioning engineer.
 */
export function massFlowError(inputThickness, entrySpeedMpm, outputThickness, exitSpeedMpm) {
    const entryFlow = inputThickness * entrySpeedMpm;
    const exitFlow = outputThickness * exitSpeedMpm;
    if (Math.abs(exitFlow) < 1e-9)
        return 0;
    return ((entryFlow - exitFlow) / exitFlow) * 100;
}
/**
 * Specific tension (stress) from tension force, N/mm².
 *   σ = T / (h · w)
 */
export function specificTension(tensionKN, thicknessMm, widthMm) {
    const area = thicknessMm * widthMm;
    if (area <= 0)
        return 0;
    return (tensionKN * 1000) / area;
}
/**
 * Tension force from specific tension, kN.
 *   T = σ · h · w
 */
export function tensionForceFromSpecific(specificTensionNPerMm2, thicknessMm, widthMm) {
    return (specificTensionNPerMm2 * thicknessMm * widthMm) / 1000;
}
