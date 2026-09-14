/**
 * UNIT CONVERSION — §10.2 of the master spec.
 *
 * Millimetres are NEVER used as raw Three.js units. Scene units are METRES.
 * Every mesh in `components/digitalTwin` sizes itself through this module, so
 * there is exactly one place where industrial units become scene units.
 */
import { GRAVITY } from './engineeringConfig';
import { millConfig } from './millConfig';
/** 1 scene unit = 1 metre. */
export const SCENE_UNITS_PER_METRE = 1;
/** Industrial millimetres -> scene units. */
export function mmToScene(mm) {
    return (mm / 1000) * SCENE_UNITS_PER_METRE;
}
/** Scene units -> industrial millimetres. */
export function sceneToMm(scene) {
    return (scene / SCENE_UNITS_PER_METRE) * 1000;
}
/** Industrial metres -> scene units. */
export function mToScene(m) {
    return m * SCENE_UNITS_PER_METRE;
}
/**
 * Strip thickness -> scene units, with the disclosed visual exaggeration (§10.3).
 * The displayed NUMBER is always the true thickness; only the geometry is scaled.
 */
export function stripThicknessToScene(thicknessMm) {
    return mmToScene(thicknessMm * millConfig.visual.stripThicknessExaggeration);
}
/**
 * Work-roll surface separation for a given roll gap (§10.3):
 *   workRollDistance = stripThickness(exaggerated) + rollGapVisualOffset
 */
export function rollGapToScene(rollGapMm) {
    return (mmToScene(rollGapMm * millConfig.visual.rollGapExaggeration) +
        millConfig.visual.rollGapVisualOffset);
}
// ---------------------------------------------------------------------------
// Engineering unit conversions
// ---------------------------------------------------------------------------
/** Metric tonnes-force -> kilonewtons. */
export function tonnesToKN(t) {
    return t * GRAVITY;
}
/** Kilonewtons -> metric tonnes-force. */
export function kNToTonnes(kN) {
    return kN / GRAVITY;
}
/** Newtons -> metric tonnes-force. */
export function newtonsToTonnes(n) {
    return n / (GRAVITY * 1000);
}
/** m/min -> m/s. */
export function mpmToMps(mpm) {
    return mpm / 60;
}
/** m/s -> m/min. */
export function mpsToMpm(mps) {
    return mps * 60;
}
/** Millimetres -> micrometres. */
export function mmToUm(mm) {
    return mm * 1000;
}
/** Micrometres -> millimetres. */
export function umToMm(um) {
    return um / 1000;
}
/** rpm -> radians per second. */
export function rpmToRadPerSec(rpm) {
    return (rpm * 2 * Math.PI) / 60;
}
/** radians per second -> rpm. */
export function radPerSecToRpm(rad) {
    return (rad * 60) / (2 * Math.PI);
}
// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/** Linear interpolation. */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
/**
 * Frame-rate independent exponential damping (§10.4).
 * `halfLife` is the time in seconds for the remaining error to halve, so the
 * visual response is identical at 30 fps and 144 fps.
 */
export function damp(current, target, halfLife, dt) {
    if (halfLife <= 0)
        return target;
    const factor = 1 - Math.pow(2, -dt / halfLife);
    return current + (target - current) * factor;
}
/** Format a number for a control-room readout: fixed decimals, no locale commas. */
export function fmt(value, decimals = 1) {
    if (value === null || value === undefined || !Number.isFinite(value))
        return '—';
    return value.toFixed(decimals);
}
