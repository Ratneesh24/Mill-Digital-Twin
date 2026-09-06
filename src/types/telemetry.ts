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

/** Signals recorded to the trend buffers (§12). */
export type TelemetrySignal =
  | 'speed'
  | 'thickness'
  | 'thicknessDeviation'
  | 'rollingForce'
  | 'rollGap'
  | 'entryTension'
  | 'exitTension'
  | 'torque'
  | 'current'

export interface SignalDescriptor {
  key: TelemetrySignal
  label: string
  unit: string
  color: string
  decimals: number
  /** Tag that owns this signal — used to look up provenance for the chart badge. */
  tagName: string
}
