/**
 * Single-signal trend charts (§12).
 *
 * `SignalChart` is the shared implementation; the named exports below are the
 * per-signal charts the spec lists in §5, each preset with its own axis
 * treatment. They are thin on purpose: one chart implementation means one place
 * where a trend can be drawn wrongly.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { engineeringConfig } from '../../config/engineeringConfig'
import { millConfig } from '../../config/millConfig'
import { SIGNAL_BY_KEY } from '../../store/telemetryStore'
import { useMachineStore } from '../../store/machineStore'
import { useTrend } from '../../utils/useTelemetry'
import type { TelemetrySignal, TrendWindowKey } from '../../types/telemetry'
import { ProvenanceBadge } from '../common/ProvenanceBadge'

interface Props {
  signal: TelemetrySignal
  window?: TrendWindowKey
  height?: number
  /** Horizontal reference lines — limits, targets, setpoints. */
  references?: Array<{ value: number; color: string; label?: string }>
}

export function SignalChart({ signal, window = '5m', height = 132, references = [] }: Props) {
  const descriptor = SIGNAL_BY_KEY[signal]
  const points = useTrend(signal, window)
  const tag = useMachineStore((s) => s.tags[descriptor.tagName])

  return (
    <div className="bg-base-850 border-line rounded-lg border p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="label truncate">
          {descriptor.label}{' '}
          <span className="text-text-faint">({descriptor.unit})</span>
        </span>
        {tag && <ProvenanceBadge provenance={tag.provenance} quality={tag.quality} />}
      </div>
      <div style={{ height }}>
        {points.length < 2 ? (
          <div className="text-text-faint flex h-full items-center justify-center text-[11px]">
            Collecting data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id={`fill-${signal}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={descriptor.color} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={descriptor.color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis
                stroke="var(--color-line-bright)"
                tick={{ fontSize: 10, fill: 'var(--color-text-faint)' }}
                width={48}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid var(--color-line-bright)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--color-text)',
                  boxShadow: '0 8px 24px rgb(23 43 77 / 12%)',
                }}
                labelStyle={{ color: 'var(--color-text-dim)', fontWeight: 600 }}
                labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()}
                formatter={(value: number) => [
                  `${value.toFixed(descriptor.decimals)} ${descriptor.unit}`,
                  descriptor.label,
                ]}
              />
              {references.map((ref) => (
                <ReferenceLine
                  key={`${ref.value}-${ref.label ?? ''}`}
                  y={ref.value}
                  stroke={ref.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{
                    value: ref.label,
                    fill: ref.color,
                    fontSize: 10,
                    fontWeight: 600,
                    position: 'insideTopRight',
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="value"
                stroke={descriptor.color}
                strokeWidth={2}
                fill={`url(#fill-${signal})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/** Thickness trend with the ±tolerance band marked. */
export function ThicknessChart({ window }: { window?: TrendWindowKey }) {
  return <SignalChart signal="thickness" window={window} />
}

/** Thickness deviation against the ±5 µm target (§2). */
export function ThicknessDeviationChart({ window }: { window?: TrendWindowKey }) {
  const tol = engineeringConfig.thicknessTolerance
  return (
    <SignalChart
      signal="thicknessDeviation"
      window={window}
      references={[
        { value: tol, color: 'var(--color-warning)', label: `+${tol} µm` },
        { value: -tol, color: 'var(--color-warning)', label: `−${tol} µm` },
      ]}
    />
  )
}

/** Rolling force with the warning and alarm limits marked. */
export function ForceChart({ window }: { window?: TrendWindowKey }) {
  return (
    <SignalChart
      signal="rollingForce"
      window={window}
      references={[
        {
          value: engineeringConfig.forceLimits.warning,
          color: 'var(--color-warning)',
          label: 'WARN',
        },
        { value: engineeringConfig.forceLimits.alarm, color: 'var(--color-alarm)', label: 'ALARM' },
      ]}
    />
  )
}

export function RollGapChart({ window }: { window?: TrendWindowKey }) {
  return <SignalChart signal="rollGap" window={window} />
}

export function TensionChart({ window }: { window?: TrendWindowKey }) {
  return (
    <div className="space-y-2.5">
      <SignalChart signal="entryTension" window={window} height={104} />
      <SignalChart signal="exitTension" window={window} height={104} />
    </div>
  )
}

export function SpeedChart({ window }: { window?: TrendWindowKey }) {
  return (
    <SignalChart
      signal="speed"
      window={window}
      references={[
        {
          value: millConfig.ratings.maxMillSpeed,
          color: 'var(--color-alarm)',
          label: 'MAX',
        },
      ]}
    />
  )
}

export function TorqueChart({ window }: { window?: TrendWindowKey }) {
  return <SignalChart signal="torque" window={window} />
}

export function CurrentChart({ window }: { window?: TrendWindowKey }) {
  return (
    <SignalChart
      signal="current"
      window={window}
      references={[
        {
          value: engineeringConfig.motorLimits.currentMax,
          color: 'var(--color-alarm)',
          label: 'RATING',
        },
      ]}
    />
  )
}
