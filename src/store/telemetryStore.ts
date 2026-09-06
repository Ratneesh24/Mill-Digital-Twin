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

import { engineeringConfig } from '../config/engineeringConfig'
import { RingBuffer } from '../utils/ringBuffer'
import {
  TREND_WINDOWS,
  type SignalDescriptor,
  type TelemetryPoint,
  type TelemetrySignal,
  type TrendWindowKey,
} from '../types/telemetry'

/** Points retained per window. 240 is ~1 point per 4 px on a full-width chart. */
const CAPACITY = 240

interface WindowBuffer {
  buffer: RingBuffer
  /** Emit one averaged point every this many ms. */
  intervalMs: number
  /** Accumulator since the last emitted point. */
  sum: number
  n: number
  lastEmit: number
}

class SignalSeries {
  readonly windows: Record<TrendWindowKey, WindowBuffer>

  constructor() {
    this.windows = Object.fromEntries(
      (Object.keys(TREND_WINDOWS) as TrendWindowKey[]).map((key) => [
        key,
        {
          buffer: new RingBuffer(CAPACITY),
          intervalMs: TREND_WINDOWS[key] / CAPACITY,
          sum: 0,
          n: 0,
          lastEmit: 0,
        },
      ]),
    ) as Record<TrendWindowKey, WindowBuffer>
  }

  write(timestamp: number, value: number): void {
    if (!Number.isFinite(value)) return
    for (const key of Object.keys(this.windows) as TrendWindowKey[]) {
      const w = this.windows[key]
      w.sum += value
      w.n += 1
      if (w.lastEmit === 0) w.lastEmit = timestamp
      if (timestamp - w.lastEmit >= w.intervalMs) {
        w.buffer.push(timestamp, w.sum / w.n)
        w.sum = 0
        w.n = 0
        w.lastEmit = timestamp
      }
    }
  }

  read(window: TrendWindowKey): TelemetryPoint[] {
    return this.windows[window].buffer.toArray()
  }

  clear(): void {
    for (const key of Object.keys(this.windows) as TrendWindowKey[]) {
      const w = this.windows[key]
      w.buffer.clear()
      w.sum = 0
      w.n = 0
      w.lastEmit = 0
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
export const SIGNALS: SignalDescriptor[] = [
  {
    key: 'speed',
    label: 'Mill speed',
    unit: 'm/min',
    color: '#005a9c',
    decimals: 0,
    tagName: 'MILL.SPEED.ACTUAL',
  },
  {
    key: 'thickness',
    label: 'Thickness',
    unit: 'mm',
    color: '#187447',
    decimals: 3,
    tagName: 'STRIP.THICKNESS',
  },
  {
    key: 'thicknessDeviation',
    label: 'Thickness deviation',
    unit: 'µm',
    color: '#976000',
    decimals: 1,
    tagName: 'STRIP.THICKNESS.DEVIATION',
  },
  {
    key: 'rollingForce',
    label: 'Rolling force',
    unit: 't',
    color: '#c13335',
    decimals: 0,
    tagName: 'ROLL.FORCE.ACTUAL',
  },
  {
    key: 'rollGap',
    label: 'Roll gap',
    unit: 'mm',
    color: '#7050a2',
    decimals: 3,
    tagName: 'ROLL.GAP.ACTUAL',
  },
  {
    key: 'entryTension',
    label: 'Entry tension',
    unit: 'kN',
    color: '#0b6e7a',
    decimals: 1,
    tagName: 'TENSION.ENTRY',
  },
  {
    key: 'exitTension',
    label: 'Exit tension',
    unit: 'kN',
    color: '#a91e63',
    decimals: 1,
    tagName: 'TENSION.EXIT',
  },
  {
    key: 'torque',
    label: 'Drive torque',
    unit: 'kNm',
    color: '#b54708',
    decimals: 1,
    tagName: 'DRIVE.TORQUE',
  },
  {
    key: 'current',
    label: 'Drive current',
    unit: 'A',
    color: '#47586e',
    decimals: 0,
    tagName: 'DRIVE.CURRENT',
  },
]

export const SIGNAL_BY_KEY: Record<TelemetrySignal, SignalDescriptor> = Object.fromEntries(
  SIGNALS.map((s) => [s.key, s]),
) as Record<TelemetrySignal, SignalDescriptor>

class TelemetryStore {
  private series: Record<TelemetrySignal, SignalSeries> = Object.fromEntries(
    SIGNALS.map((s) => [s.key, new SignalSeries()]),
  ) as Record<TelemetrySignal, SignalSeries>

  private lastSampleMs = 0

  /**
   * Record one sample set. Called from the machine store on every frame but
   * rate-limited to `telemetrySampleMs` so a 20 Hz feed does not fill the
   * buffers 5x faster than the windows expect.
   */
  record(timestamp: number, values: Partial<Record<TelemetrySignal, number>>): void {
    if (timestamp - this.lastSampleMs < engineeringConfig.telemetrySampleMs) return
    this.lastSampleMs = timestamp
    for (const [key, value] of Object.entries(values) as [TelemetrySignal, number][]) {
      if (value === undefined || value === null) continue
      this.series[key].write(timestamp, value)
    }
  }

  read(signal: TelemetrySignal, window: TrendWindowKey): TelemetryPoint[] {
    return this.series[signal].read(window)
  }

  /** Multi-signal snapshot merged on timestamp, for a multi-series chart. */
  readMerged(
    signals: TelemetrySignal[],
    window: TrendWindowKey,
  ): Array<Record<string, number>> {
    if (signals.length === 0) return []
    const columns = signals.map((s) => this.read(s, window))
    const base = columns.reduce((a, b) => (a.length >= b.length ? a : b), columns[0])
    return base.map((point, index) => {
      const row: Record<string, number> = { timestamp: point.timestamp }
      signals.forEach((signal, si) => {
        const col = columns[si]
        // Windows share a cadence, so index alignment holds; fall back to the
        // last available point when a signal started recording later.
        const p = col[index] ?? col[col.length - 1]
        if (p) row[signal] = p.value
      })
      return row
    })
  }

  clear(): void {
    for (const s of Object.values(this.series)) s.clear()
    this.lastSampleMs = 0
  }
}

export const telemetryStore = new TelemetryStore()
