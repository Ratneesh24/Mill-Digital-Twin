/**
 * ENGINEERING CALCULATIONS LAYER — the "Engineering Calculations" box in the §4
 * architecture diagram.
 *
 * Derived engineering indicators computed FROM MachineState for the health and
 * KPI panels. Everything here is a pure function of state: a utilisation
 * percentage, a ratio, a consistency check. No new process values are invented,
 * and nothing here feeds back into the simulation.
 *
 * These live in one module rather than in the components that display them so
 * that "force utilisation" means exactly one thing everywhere it appears (§18).
 */
import { engineeringConfig, STEEL_DENSITY } from '../config/engineeringConfig';
import { millConfig } from '../config/millConfig';
export function calculateUtilisation(state) {
    const { motorLimits, speedLimits } = engineeringConfig;
    return {
        force: (state.rollingForce.actual / millConfig.ratings.maxRollingForce) * 100,
        torque: state.drive.torquePercentage,
        current: (state.drive.current / motorLimits.currentMax) * 100,
        power: (state.drive.power / motorLimits.powerMax) * 100,
        speed: (state.speed.actual / speedLimits.max) * 100,
    };
}
/**
 * The three internal-consistency checks a commissioning engineer would run
 * against a twin (§18/§19). Exposed on screen so the model can be challenged
 * rather than trusted.
 */
export function calculateConsistency(state) {
    const referenceForce = state.rollingForce.reference;
    const forceVsScheduleErrorPct = referenceForce > 0
        ? ((state.rollingForce.actual - referenceForce) / referenceForce) * 100
        : 0;
    return {
        massFlowErrorPct: state.diagnostics.massFlowErrorPct,
        massFlowOk: Math.abs(state.diagnostics.massFlowErrorPct) < 1,
        gaugemeterResidualUm: state.diagnostics.gaugemeterResidualUm,
        gaugemeterOk: state.diagnostics.gaugemeterResidualUm < 1,
        thicknessInTolerance: Math.abs(state.thickness.deviation) <= engineeringConfig.thicknessTolerance,
        forceVsScheduleErrorPct,
    };
}
/**
 * Specific energy consumed by the current pass, kWh/t.
 *
 *   e = P / (ṁ)  with  ṁ = h·w·v·ρ
 *
 * A standard rolling-mill efficiency indicator. Returns 0 when the mill is
 * stopped rather than dividing by zero.
 */
export function specificEnergy(state) {
    const thicknessM = state.thickness.actual / 1000;
    const widthM = state.coil.width / 1000;
    const speedMps = state.speed.actual / 60;
    // t/h = m³/s × kg/m³ × 3600 / 1000
    const throughputTph = thicknessM * widthM * speedMps * STEEL_DENSITY * 3.6;
    if (throughputTph <= 0.001)
        return 0;
    return state.drive.power / throughputTph;
}
/** Production rate at the current speed and section, t/h. */
export function throughput(state) {
    const thicknessM = state.thickness.actual / 1000;
    const widthM = state.coil.width / 1000;
    const speedMps = state.speed.actual / 60;
    return thicknessM * widthM * speedMps * STEEL_DENSITY * 3.6;
}
/** Estimated time to finish the current pass, seconds. */
export function passTimeRemaining(state) {
    if (state.speed.actual <= 0.1)
        return null;
    const entrySpeedMpm = state.thickness.entry > 0
        ? (state.speed.actual * state.thickness.actual) / state.thickness.entry
        : state.speed.actual;
    return (state.coil.remainingLength / entrySpeedMpm) * 60;
}
/** Format seconds as mm:ss for the pass countdown. */
export function formatDuration(seconds) {
    if (seconds === null || !Number.isFinite(seconds))
        return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
