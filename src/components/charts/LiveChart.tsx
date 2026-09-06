/**
 * LIVE TREND CHART — §12.
 *
 * Reads the ring buffers on its own throttle (2 Hz repaint), completely
 * decoupled from both the 20 Hz-capable data feed and the 3D render loop (§15).
 * Buffers are already downsampled on write, so this never decimates on render.
 *
 * The provenance badge on each series comes from the same tag the series is
 * recorded from — a trend of an ESTIMATED value is labelled EST here too, so a
 * chart cannot quietly launder a model output into something that looks measured.
 */

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SIGNAL_BY_KEY, SIGNALS } from '../../store/telemetryStore'
import { useMachineStore } from '../../store/machineStore'
import { useUiStore } from '../../store/uiStore'
import { useMergedTrend } from '../../utils/useTelemetry'
import { TREND_WINDOWS, type TelemetrySignal, type TrendWindowKey } from '../../types/telemetry'
import { ProvenanceBadge } from '../common/ProvenanceBadge'
import { Panel } from '../common/Panel'

const WINDOW_KEYS = Object.keys(TREND_WINDOWS) as TrendWindowKey[]

export function LiveChart() {
  const signals = useUiStore((s) => s.trendSignals)
  const window = useUiStore((s) => s.trendWindow)
  const setWindow = useUiStore((s) => s.setTrendWindow)
  const toggleSignal = useUiStore((s) => s.toggleTrendSignal)

  return (
    <Panel
      title="Live trend"
      right={
        <div role="group" aria-label="Trend time window" className="flex gap-1">
          {WINDOW_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={window === key}
              onClick={() => setWindow(key)}
              className={`num min-h-8 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                window === key
                  ? 'border-normal bg-normal text-white'
                  : 'border-line text-text-dim hover:text-text hover:bg-base-800 bg-base-900'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0 flex flex-col"
    >
      <SignalLegend selected={signals} onToggle={toggleSignal} />
      <div className="min-h-0 flex-1 px-2 pb-2">
        <TrendPlot signals={signals} window={window} />
      </div>
    </Panel>
  )
}

function SignalLegend({
  selected,
  onToggle,
}: {
  selected: TelemetrySignal[]
  onToggle: (s: TelemetrySignal) => void
}) {
  const tags = useMachineStore((s) => s.tags)

  return (
    <div
      role="group"
      aria-label="Trend signals"
      className="border-line bg-base-850 flex flex-wrap gap-1.5 border-b px-2.5 py-2"
    >
      {SIGNALS.map((signal) => {
        const active = selected.includes(signal.key)
        const tag = tags[signal.tagName]
        return (
          <button
            key={signal.key}
            type="button"
            aria-pressed={active}
            title={`${signal.label} (${signal.unit}) — ${active ? 'hide' : 'show'} on trend`}
            onClick={() => onToggle(signal.key)}
            className={`flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors ${
              active
                ? 'border-normal/50 text-text bg-base-900 shadow-sm'
                : 'border-line text-text-faint hover:text-text-dim bg-base-900'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-[3px] w-3.5 shrink-0 rounded-full"
              style={{ background: active ? signal.color : 'var(--color-inactive)' }}
            />
            {signal.label}
            {active && tag && (
              <ProvenanceBadge provenance={tag.provenance} quality={tag.quality} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function TrendPlot({
  signals,
  window,
}: {
  signals: TelemetrySignal[]
  window: TrendWindowKey
}) {
  const rows = useMergedTrend(signals, window)

  const formatTime = useMemo(
    () => (value: number) =>
      new Date(value).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    [],
  )

  if (signals.length === 0) {
    return (
      <div className="text-text-faint flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-[12px]">
        <span className="font-medium">Select a signal to trend</span>
        <span className="text-[11px]">Use the pills above to add mill speed, force, gap and more.</span>
      </div>
    )
  }

  if (rows.length < 2) {
    return (
      <div className="text-text-faint flex h-full min-h-[120px] items-center justify-center text-[12px]">
        Collecting data…
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 10, right: 10, bottom: 2, left: -4 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 4" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          stroke="var(--color-line-bright)"
          tick={{ fontSize: 10, fill: 'var(--color-text-faint)' }}
          minTickGap={40}
        />
        {/*
          Each signal gets its own axis scale but only the first is drawn — nine
          visible axes would leave no room for the data. Values are always
          readable exactly in the tooltip and in the KPI modules.
        */}
        {signals.map((key, index) => (
          <YAxis
            key={key}
            yAxisId={key}
            hide={index > 0}
            stroke="var(--color-line-bright)"
            tick={{ fontSize: 10, fill: 'var(--color-text-faint)' }}
            width={46}
            domain={['auto', 'auto']}
          />
        ))}
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
          formatter={(value: number, name: string) => {
            const descriptor = SIGNAL_BY_KEY[name as TelemetrySignal]
            return [
              `${value.toFixed(descriptor?.decimals ?? 1)} ${descriptor?.unit ?? ''}`,
              descriptor?.label ?? name,
            ]
          }}
        />
        {signals.includes('thicknessDeviation') && (
          <ReferenceLine yAxisId="thicknessDeviation" y={0} stroke="var(--color-line-bright)" />
        )}
        {signals.map((key) => (
          <Line
            key={key}
            yAxisId={key}
            type="monotone"
            dataKey={key}
            stroke={SIGNAL_BY_KEY[key].color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
