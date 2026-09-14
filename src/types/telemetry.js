/** Telemetry & trend types — §12. Bounded buffers only, never unbounded append. */
/** Trend windows offered by the UI. Values are window lengths in ms. */
export const TREND_WINDOWS = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
};
/**
 * Parameter groups, shared by the trends browser and the dashboard parameter
 * tables so a signal sits under the same heading in both places.
 */
export const TREND_GROUPS = [
    'THICKNESS',
    'ROLLING',
    'WORK ROLL',
    'TENSION',
    'DRIVE',
    'ENERGY',
    'HYDRAULIC',
    'COIL / STRIP',
    'SYSTEM',
];
