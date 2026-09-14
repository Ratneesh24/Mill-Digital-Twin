/**
 * TELEMETRY STORE — §12 of the master spec.
 *
 * Rolling buffers for 1 min / 5 min / 15 min / 30 min / 1 h, one set per signal.
 * Each window has a FIXED capacity, and samples are DOWNSAMPLED ON WRITE, not on
 * render: the 1 h window stores one averaged point every 15 s rather than
 * 14 400 raw points that a chart would then have to decimate on every repaint.
 *
 * This store lives OUTSIDE React on purpose (§15). Writing a telemetry sample
 * must never re-render a component; charts pull a snapshot on their own throttle.
 */
import { engineeringConfig } from '../config/engineeringConfig';
import { RingBuffer } from '../utils/ringBuffer';
import { TREND_WINDOWS, } from '../types/telemetry';
/** Points retained per window. 240 is ~1 point per 4 px on a full-width chart. */
const CAPACITY = 240;
class SignalSeries {
    windows;
    constructor() {
        this.windows = Object.fromEntries(Object.keys(TREND_WINDOWS).map((key) => [
            key,
            {
                buffer: new RingBuffer(CAPACITY),
                intervalMs: TREND_WINDOWS[key] / CAPACITY,
                sum: 0,
                n: 0,
                lastEmit: 0,
            },
        ]));
    }
    write(timestamp, value) {
        if (!Number.isFinite(value))
            return;
        for (const key of Object.keys(this.windows)) {
            const w = this.windows[key];
            w.sum += value;
            w.n += 1;
            if (w.lastEmit === 0)
                w.lastEmit = timestamp;
            if (timestamp - w.lastEmit >= w.intervalMs) {
                w.buffer.push(timestamp, w.sum / w.n);
                w.sum = 0;
                w.n = 0;
                w.lastEmit = timestamp;
            }
        }
    }
    read(window) {
        return this.windows[window].buffer.toArray();
    }
    clear() {
        for (const key of Object.keys(this.windows)) {
            const w = this.windows[key];
            w.buffer.clear();
            w.sum = 0;
            w.n = 0;
            w.lastEmit = 0;
        }
    }
}
/**
 * Signals recorded to trends (§12), with the tag that owns each one. The chart
 * looks the provenance badge up from this tag rather than guessing, so a trend
 * of an ESTIMATED value is labelled EST on the chart too.
 */
/**
 * Light-workspace series palette. Dark, saturated lines on white with distinct
 * hues that remain legible beside the Tata Steel blue primary.
 */
export const SIGNALS = [
    // ── THICKNESS ────────────────────────────────────────────────────────────
    { key: 'thickness', label: 'Exit thickness', unit: 'mm', color: '#187447', decimals: 3, group: 'THICKNESS', tagName: 'STRIP.THICKNESS' },
    { key: 'thicknessEntry', label: 'Entry thickness', unit: 'mm', color: '#3f9c6d', decimals: 3, group: 'THICKNESS', tagName: 'STRIP.THICKNESS.ENTRY' },
    { key: 'thicknessTarget', label: 'Target thickness', unit: 'mm', color: '#7fb79b', decimals: 3, group: 'THICKNESS', tagName: 'STRIP.THICKNESS.REF', isReference: true },
    { key: 'thicknessDeviation', label: 'Thickness deviation', unit: 'µm', color: '#976000', decimals: 1, group: 'THICKNESS', tagName: 'STRIP.THICKNESS.DEVIATION' },
    { key: 'reduction', label: 'Reduction', unit: '%', color: '#0f766e', decimals: 2, group: 'THICKNESS', tagName: 'STRIP.REDUCTION' },
    { key: 'gaugeDtr', label: 'DTR gauge thickness', unit: 'mm', color: '#2f8f5b', decimals: 3, group: 'THICKNESS', tagName: 'GAUGE.DTR.THICKNESS' },
    { key: 'gaugeEtr', label: 'ETR gauge thickness', unit: 'mm', color: '#5aa87f', decimals: 3, group: 'THICKNESS', tagName: 'GAUGE.ETR.THICKNESS' },
    // ── ROLLING ──────────────────────────────────────────────────────────────
    { key: 'speed', label: 'Mill speed', unit: 'm/min', color: '#005a9c', decimals: 0, group: 'ROLLING', tagName: 'MILL.SPEED.ACTUAL' },
    { key: 'speedRef', label: 'Speed setpoint', unit: 'm/min', color: '#6fa8d0', decimals: 0, group: 'ROLLING', tagName: 'MILL.SPEED.REF', isReference: true },
    { key: 'rollingForce', label: 'Roll force', unit: 't', color: '#c13335', decimals: 0, group: 'ROLLING', tagName: 'ROLL.FORCE.ACTUAL' },
    { key: 'rollingForceRef', label: 'Roll force setpoint', unit: 't', color: '#e08a8b', decimals: 0, group: 'ROLLING', tagName: 'ROLL.FORCE.REF', isReference: true },
    { key: 'forcePercent', label: 'Force utilisation', unit: '%', color: '#a3423f', decimals: 1, group: 'ROLLING', tagName: 'ROLL.FORCE.ACTUAL' },
    { key: 'rollGap', label: 'Roll gap', unit: 'mm', color: '#7050a2', decimals: 3, group: 'ROLLING', tagName: 'ROLL.GAP.ACTUAL' },
    { key: 'rollGapRef', label: 'Gap setpoint S0', unit: 'mm', color: '#a793c7', decimals: 3, group: 'ROLLING', tagName: 'ROLL.GAP.REF', isReference: true },
    { key: 'rollRpm', label: 'Work roll RPM', unit: 'rpm', color: '#4c1d95', decimals: 0, group: 'ROLLING', tagName: 'WR.TOP.RPM' },
    // ── WORK ROLL / SHAPE ────────────────────────────────────────────────────
    { key: 'wrTopBending', label: 'WR bending (top)', unit: 'kN', color: '#b45309', decimals: 0, group: 'WORK ROLL', tagName: 'WR.TOP.BENDING' },
    { key: 'wrBottomBending', label: 'WR bending (bottom)', unit: 'kN', color: '#d97706', decimals: 0, group: 'WORK ROLL', tagName: 'WR.BOTTOM.BENDING' },
    { key: 'rollGapTilt', label: 'Tilting (OS−DS)', unit: 'µm', color: '#92400e', decimals: 1, group: 'WORK ROLL', tagName: 'ROLL.GAP.TILT' },
    { key: 'forceOs', label: 'Roll force OS', unit: 't', color: '#be123c', decimals: 0, group: 'WORK ROLL', tagName: 'ROLL.FORCE.OS' },
    { key: 'forceDs', label: 'Roll force DS', unit: 't', color: '#e11d48', decimals: 0, group: 'WORK ROLL', tagName: 'ROLL.FORCE.DS' },
    // ── TENSION ──────────────────────────────────────────────────────────────
    { key: 'entryTension', label: 'Entry tension', unit: 'kN', color: '#0b6e7a', decimals: 1, group: 'TENSION', tagName: 'TENSION.ENTRY' },
    { key: 'exitTension', label: 'Exit tension', unit: 'kN', color: '#a91e63', decimals: 1, group: 'TENSION', tagName: 'TENSION.EXIT' },
    { key: 'entryTensionRef', label: 'Entry tension setpoint', unit: 'kN', color: '#66a6ae', decimals: 1, group: 'TENSION', tagName: 'TENSION.ENTRY.REF', isReference: true },
    { key: 'exitTensionRef', label: 'Exit tension setpoint', unit: 'kN', color: '#d178a2', decimals: 1, group: 'TENSION', tagName: 'TENSION.EXIT.REF', isReference: true },
    { key: 'entrySpecificTension', label: 'Entry specific tension', unit: 'N/mm²', color: '#08505a', decimals: 1, group: 'TENSION', tagName: 'TENSION.ENTRY' },
    { key: 'exitSpecificTension', label: 'Exit specific tension', unit: 'N/mm²', color: '#7d1547', decimals: 1, group: 'TENSION', tagName: 'TENSION.EXIT' },
    // ── DRIVE ────────────────────────────────────────────────────────────────
    { key: 'torque', label: 'Drive torque', unit: 'kNm', color: '#b54708', decimals: 1, group: 'DRIVE', tagName: 'DRIVE.TORQUE' },
    { key: 'current', label: 'Drive current', unit: 'A', color: '#47586e', decimals: 0, group: 'DRIVE', tagName: 'DRIVE.CURRENT' },
    { key: 'driveRpm', label: 'Drive RPM', unit: 'rpm', color: '#334155', decimals: 0, group: 'DRIVE', tagName: 'DRIVE.RPM' },
    { key: 'motorLoad', label: 'Motor load', unit: '%', color: '#7c2d12', decimals: 1, group: 'DRIVE', tagName: 'DRIVE.TORQUE' },
    // ── ENERGY ───────────────────────────────────────────────────────────────
    // Instantaneous power only. Cumulative kWh (coil and day) is declared but
    // UNAVAILABLE — it needs historian integration, so there is nothing to trend.
    { key: 'power', label: 'Current power', unit: 'kW', color: '#1e40af', decimals: 0, group: 'ENERGY', tagName: 'DRIVE.POWER' },
    // ── HYDRAULIC ────────────────────────────────────────────────────────────
    { key: 'loadingPressure', label: 'Loading pressure', unit: 'bar', color: '#5b21b6', decimals: 0, group: 'HYDRAULIC', tagName: 'HYD.LOADING.PRESSURE' },
    { key: 'bendingPressure', label: 'Bending pressure', unit: 'bar', color: '#7e22ce', decimals: 0, group: 'HYDRAULIC', tagName: 'HYD.BENDING.PRESSURE' },
    { key: 'gapPosition', label: 'Capsule position', unit: 'mm', color: '#9333ea', decimals: 3, group: 'HYDRAULIC', tagName: 'HYD.GAP.POSITION' },
    { key: 'lpPressure', label: 'LP system pressure', unit: 'bar', color: '#a855f7', decimals: 1, group: 'HYDRAULIC', tagName: 'LP.PRESSURE' },
    // ── COIL / STRIP ─────────────────────────────────────────────────────────
    { key: 'coilDiameter', label: 'Coil diameter', unit: 'mm', color: '#0369a1', decimals: 0, group: 'COIL / STRIP', tagName: 'COIL.DIAMETER' },
    { key: 'coilRemaining', label: 'Remaining length', unit: 'm', color: '#0284c7', decimals: 0, group: 'COIL / STRIP', tagName: 'COIL.REMAINING_LENGTH' },
    { key: 'passProgress', label: 'Pass progress', unit: '%', color: '#0891b2', decimals: 0, group: 'COIL / STRIP', tagName: 'PASS.PROGRESS' },
    // ── SYSTEM ───────────────────────────────────────────────────────────────
    { key: 'massFlowError', label: 'Mass flow closure', unit: '%', color: '#475569', decimals: 3, group: 'SYSTEM', tagName: 'MILL.MASSFLOW.ERROR' },
    { key: 'updateRate', label: 'Feed update rate', unit: 'Hz', color: '#64748b', decimals: 1, group: 'SYSTEM', tagName: 'MILL.STATUS' },
];
export const SIGNAL_BY_KEY = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));
class TelemetryStore {
    series = Object.fromEntries(SIGNALS.map((s) => [s.key, new SignalSeries()]));
    lastSampleMs = 0;
    /**
     * Record one sample set. Called from the machine store on every frame but
     * rate-limited to `telemetrySampleMs` so a 20 Hz feed does not fill the
     * buffers 5x faster than the windows expect.
     */
    /**
     * `null` is accepted and skipped, not coerced. A parameter with no tag on the
     * active feed arrives here as null, and recording a zero for it would put a
     * flat line on the chart for a value nobody is measuring (§7.4).
     */
    record(timestamp, values) {
        if (timestamp - this.lastSampleMs < engineeringConfig.telemetrySampleMs)
            return;
        this.lastSampleMs = timestamp;
        for (const [key, value] of Object.entries(values)) {
            if (value === undefined || value === null)
                continue;
            this.series[key].write(timestamp, value);
        }
    }
    read(signal, window) {
        return this.series[signal].read(window);
    }
    /** Multi-signal snapshot merged on timestamp, for a multi-series chart. */
    readMerged(signals, window) {
        if (signals.length === 0)
            return [];
        const columns = signals.map((s) => this.read(s, window));
        const base = columns.reduce((a, b) => (a.length >= b.length ? a : b), columns[0]);
        return base.map((point, index) => {
            const row = { timestamp: point.timestamp };
            signals.forEach((signal, si) => {
                const col = columns[si];
                // Windows share a cadence, so index alignment holds; fall back to the
                // last available point when a signal started recording later.
                const p = col[index] ?? col[col.length - 1];
                if (p)
                    row[signal] = p.value;
            });
            return row;
        });
    }
    clear() {
        for (const s of Object.values(this.series))
            s.clear();
        this.lastSampleMs = 0;
    }
}
export const telemetryStore = new TelemetryStore();
