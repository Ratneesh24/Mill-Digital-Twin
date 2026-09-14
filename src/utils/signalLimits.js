/**
 * Engineering limits per trend signal.
 *
 * Consolidates the reference values that were previously hard-coded across the
 * eight `SignalChart` preset wrappers, so the trends page draws a warning or
 * alarm line from the same constants the alarm engine trips on. If these ever
 * disagree with `alarmEngine`, the chart is lying about where the limit is.
 */
import { engineeringConfig } from '../config/engineeringConfig';
import { millConfig } from '../config/millConfig';
const TONE_COLOR = {
    target: 'var(--color-inactive)',
    warning: 'var(--color-warning)',
    alarm: 'var(--color-alarm)',
};
export function referenceColor(tone) {
    return TONE_COLOR[tone];
}
export function limitsFor(signal) {
    switch (signal) {
        case 'rollingForce':
            return [
                { value: engineeringConfig.forceLimits.warning, label: 'WARN', tone: 'warning' },
                { value: engineeringConfig.forceLimits.alarm, label: 'ALARM', tone: 'alarm' },
            ];
        case 'forcePercent':
            return [
                { value: 80, label: 'WARN', tone: 'warning' },
                { value: 92, label: 'ALARM', tone: 'alarm' },
            ];
        case 'thicknessDeviation':
            return [
                { value: engineeringConfig.thicknessTolerance, label: '+TOL', tone: 'warning' },
                { value: -engineeringConfig.thicknessTolerance, label: '−TOL', tone: 'warning' },
                { value: 0, label: 'TARGET', tone: 'target' },
            ];
        case 'speed':
            return [{ value: millConfig.ratings.maxMillSpeed, label: 'MAX', tone: 'alarm' }];
        case 'current':
            return [{ value: engineeringConfig.motorLimits.currentMax, label: 'RATING', tone: 'alarm' }];
        case 'torque':
            return [{ value: engineeringConfig.motorLimits.torqueMax, label: 'RATING', tone: 'alarm' }];
        case 'power':
            return [{ value: engineeringConfig.motorLimits.powerMax, label: 'RATING', tone: 'alarm' }];
        case 'motorLoad':
            return [
                { value: 80, label: 'WARN', tone: 'warning' },
                { value: 100, label: 'RATING', tone: 'alarm' },
            ];
        case 'entryTension':
            return [
                { value: engineeringConfig.tensionLimits.entryMin, label: 'MIN', tone: 'alarm' },
                { value: engineeringConfig.tensionLimits.entryMax, label: 'MAX', tone: 'alarm' },
            ];
        case 'exitTension':
            return [
                { value: engineeringConfig.tensionLimits.exitMin, label: 'MIN', tone: 'alarm' },
                { value: engineeringConfig.tensionLimits.exitMax, label: 'MAX', tone: 'alarm' },
            ];
        case 'entrySpecificTension':
        case 'exitSpecificTension':
            return [
                { value: engineeringConfig.specificTensionLimits.min, label: 'MIN', tone: 'warning' },
                { value: engineeringConfig.specificTensionLimits.max, label: 'MAX', tone: 'warning' },
            ];
        case 'loadingPressure':
            return [
                { value: engineeringConfig.hydraulicPressureMin, label: 'MIN', tone: 'alarm' },
            ];
        case 'massFlowError':
            return [
                { value: 1, label: '+1%', tone: 'warning' },
                { value: -1, label: '−1%', tone: 'warning' },
            ];
        default:
            return [];
    }
}
