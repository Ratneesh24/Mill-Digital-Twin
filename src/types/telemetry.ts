/** Telemetry & trend types — §12. Bounded buffers only, never unbounded append. */

export interface TelemetryPoint {
  timestamp: number
  value: number
}

/** Trend windows offered by the UI. Values are window lengths in ms. */
export const TREND_WINDOWS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
} as const

export type TrendWindowKey = keyof typeof TREND_WINDOWS

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
] as const

export type TrendGroup = (typeof TREND_GROUPS)[number]

/**
 * Signals recorded to the trend buffers (§12).
 *
 * A closed union, and deliberately so: `TelemetryStore` allocates every ring
 * buffer up front, and `readMerged` aligns series BY ARRAY INDEX — which is
 * only sound because every buffer starts recording at the same moment. Opening
 * this to arbitrary tag names would require lazily-created buffers and a true
 * timestamp merge. Adding a signal here is cheap (~19 KB); the list is curated
 * on purpose.
 */
export type TelemetrySignal =
  // THICKNESS
  | 'thickness'
  | 'thicknessEntry'
  | 'thicknessTarget'
  | 'thicknessDeviation'
  | 'reduction'
  | 'gaugeDtr'
  | 'gaugeEtr'
  // ROLLING
  | 'speed'
  | 'speedRef'
  | 'rollingForce'
  | 'rollingForceRef'
  | 'forcePercent'
  | 'rollGap'
  | 'rollGapRef'
  | 'rollRpm'
  // WORK ROLL / SHAPE
  | 'wrTopBending'
  | 'wrBottomBending'
  | 'rollGapTilt'
  | 'forceOs'
  | 'forceDs'
  // TENSION
  | 'entryTension'
  | 'exitTension'
  | 'entryTensionRef'
  | 'exitTensionRef'
  | 'entrySpecificTension'
  | 'exitSpecificTension'
  // DRIVE
  | 'torque'
  | 'current'
  | 'power'
  | 'driveRpm'
  | 'motorLoad'
  // HYDRAULIC
  | 'loadingPressure'
  | 'bendingPressure'
  | 'gapPosition'
  | 'lpPressure'
  // COIL / STRIP
  | 'coilDiameter'
  | 'coilRemaining'
  | 'passProgress'
  // SYSTEM
  | 'massFlowError'
  | 'updateRate'

export interface SignalDescriptor {
  key: TelemetrySignal
  label: string
  unit: string
  color: string
  decimals: number
  group: TrendGroup
  /** Tag that owns this signal — used to look up provenance for the chart badge. */
  tagName: string
  /** A reference/setpoint series, drawn dashed and excluded from the KPI tier. */
  isReference?: boolean
}
