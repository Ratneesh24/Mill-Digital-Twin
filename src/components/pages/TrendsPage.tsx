/**
 * REAL-TIME TRENDS — the investigative page.
 *
 * "How are the process parameters behaving over time?"
 *
 * A searchable parameter browser on the left, a synchronised multi-channel plot
 * on the right. Deliberately not on the dashboard: this is where you go to
 * study a transient, not to see the mill's current state.
 *
 * TWO CONSTRAINTS WORTH KNOWING BEFORE CHANGING ANYTHING HERE
 *
 * 1. Channels are capped (`MAX_CHANNELS`). Beyond about eight overlaid series a
 *    trend plot stops being readable, which is the exact clutter this page
 *    exists to avoid. The cap refuses politely rather than silently rendering
 *    a tenth line.
 *
 * 2. There is no pixel zoom, on purpose. Buffers are downsampled ON WRITE into
 *    fixed 240-point windows, so the 1 h window physically holds one point per
 *    15 s. Zooming into it would stretch pixels and invent nothing. Narrowing
 *    the TIME RANGE genuinely re-reads a finer buffer, so range *is* the zoom.
 */

import { useDeferredValue, useMemo, useState } from 'react'
import { Download, Pause, Play, Search } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SIGNALS, SIGNAL_BY_KEY } from '../../store/telemetryStore'
import { useMachineStore } from '../../store/machineStore'
import { useUiStore } from '../../store/uiStore'
import { useMergedTrend } from '../../utils/useTelemetry'
import { limitsFor, referenceColor } from '../../utils/signalLimits'
import {
  TREND_GROUPS,
  TREND_WINDOWS,
  type TelemetrySignal,
  type TrendWindowKey,
} from '../../types/telemetry'
import { Panel } from '../common/Panel'
import { ProvenanceBadge } from '../common/ProvenanceBadge'
import { cn } from '../ui/cn'

const WINDOW_KEYS = Object.keys(TREND_WINDOWS) as TrendWindowKey[]

/** Beyond this many overlaid series a trend stops being readable. */
const MAX_CHANNELS = 8

/**
 * Export the selected channels as CSV, exactly as plotted — the same
 * downsampled points the chart draws, not a re-query. What you see is what you
 * get, which is the only way the export can be checked against the screen.
 */
function exportCsv(
  rows: Array<Record<string, number>>,
  signals: TelemetrySignal[],
  window: TrendWindowKey,
): void {
  const header = ['timestamp_iso', ...signals.map((k) => `${SIGNAL_BY_KEY[k].label} (${SIGNAL_BY_KEY[k].unit})`)]
  const lines = rows.map((r) => [
    new Date(r.timestamp).toISOString(),
    ...signals.map((k) => {
      const v = r[k]
      return typeof v === 'number' ? v.toFixed(SIGNAL_BY_KEY[k].decimals) : ''
    }),
  ])
  const csv = [header, ...lines].map((cells) => cells.join(',')).join('\n')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `crm04-trend-${window}-${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TrendsPage() {
  const selected = useUiStore((s) => s.trendSignals)
  const setSignals = useUiStore((s) => s.setTrendSignals)
  const toggleSignal = useUiStore((s) => s.toggleTrendSignal)
  const window = useUiStore((s) => s.trendWindow)
  const setWindow = useUiStore((s) => s.setTrendWindow)
  const paused = useUiStore((s) => s.trendPaused)
  const togglePaused = useUiStore((s) => s.toggleTrendPaused)

  const [query, setQuery] = useState('')
  const [atCap, setAtCap] = useState(false)
  const deferredQuery = useDeferredValue(query)

  function handleToggle(key: TelemetrySignal) {
    if (!selected.includes(key) && selected.length >= MAX_CHANNELS) {
      setAtCap(true)
      return
    }
    setAtCap(false)
    toggleSignal(key)
  }

  // The root deliberately does NOT carry the `grid` utility class: the
  // responsive `.dashboard-content > .grid { height: auto }` rule at ≤1279px
  // would otherwise strip this band's height and collapse the chart to zero.
  // `display: grid` comes from the semantic class instead.
  return (
    <div className="dashboard-trendspage min-h-0">
      <SignalBrowser
        query={query}
        deferredQuery={deferredQuery}
        onQuery={setQuery}
        selected={selected}
        onToggle={handleToggle}
        onClear={() => {
          setSignals([])
          setAtCap(false)
        }}
        atCap={atCap}
      />

      <Panel
        title="Trend"
        className="min-h-0"
        bodyClassName="p-0 flex flex-col min-h-0"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={paused}
              onClick={togglePaused}
              title={paused ? 'Resume live updates' : 'Freeze the plot to inspect a transient'}
              className={cn(
                'text-meta inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 font-semibold tracking-wide normal-case',
                paused
                  ? 'border-warning/55 text-warning bg-warning/10'
                  : 'border-line text-text-dim hover:text-text bg-base-900',
              )}
            >
              {paused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
              {paused ? 'PAUSED' : 'LIVE'}
            </button>

            <div role="group" aria-label="Trend time range" className="segmented">
              {WINDOW_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={window === key}
                  onClick={() => setWindow(key)}
                  className="num"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <TrendPlot signals={selected} window={window} paused={paused} />
      </Panel>
    </div>
  )
}

/* ── Parameter browser ──────────────────────────────────────────────────── */

function SignalBrowser({
  query,
  deferredQuery,
  onQuery,
  selected,
  onToggle,
  onClear,
  atCap,
}: {
  query: string
  deferredQuery: string
  onQuery: (q: string) => void
  selected: TelemetrySignal[]
  onToggle: (key: TelemetrySignal) => void
  onClear: () => void
  atCap: boolean
}) {
  const needle = deferredQuery.trim().toLowerCase()

  const grouped = useMemo(() => {
    const matches = SIGNALS.filter(
      (s) =>
        needle === '' ||
        s.label.toLowerCase().includes(needle) ||
        s.unit.toLowerCase().includes(needle) ||
        s.tagName.toLowerCase().includes(needle) ||
        s.group.toLowerCase().includes(needle),
    )
    return TREND_GROUPS.map((group) => ({
      group,
      signals: matches.filter((s) => s.group === group),
    })).filter((g) => g.signals.length > 0)
  }, [needle])

  return (
    <Panel
      title={`Parameters · ${selected.length}/${MAX_CHANNELS}`}
      bodyClassName="p-0 flex flex-col min-h-0"
      right={
        selected.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="text-text-faint hover:text-text-dim text-micro tracking-wider"
          >
            CLEAR
          </button>
        ) : undefined
      }
    >
      <div className="border-line bg-base-850 shrink-0 border-b px-3 py-2.5">
        <div className="relative">
          <Search
            size={14}
            aria-hidden
            className="text-text-faint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search parameters, units or tags…"
            aria-label="Search trend parameters"
            className="border-line bg-base-900 text-text text-meta focus:border-brand min-h-9 w-full rounded-md border py-1.5 pr-2.5 pl-8"
          />
        </div>

        {atCap && (
          <p role="status" className="text-warning text-micro mt-2 leading-snug">
            {MAX_CHANNELS} channels is the maximum — remove one before adding another.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <p className="text-text-faint text-meta px-3 py-4 text-center">
            No parameter matches “{query}”.
          </p>
        ) : (
          grouped.map(({ group, signals }) => (
            <section key={group}>
              <h3
                className="label bg-base-850/70 border-line sticky top-0 z-10 border-b px-3 py-1.5 font-semibold"
                style={{ borderLeft: `3px solid ${groupAccent(group)}` }}
              >
                {group}
              </h3>
              <ul>
                {signals.map((s) => {
                  const active = selected.includes(s.key)
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggle(s.key)}
                        className={cn(
                          'border-line/60 flex w-full items-center gap-2 border-b px-3 py-2 text-left transition-colors',
                          active ? 'bg-brand/8' : 'hover:bg-base-800',
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-[3px] w-4 shrink-0 rounded-full"
                          style={{
                            background: active ? s.color : 'var(--color-inactive)',
                            opacity: active ? 1 : 0.4,
                          }}
                        />
                        <span
                          className={cn(
                            'text-meta min-w-0 flex-1 truncate',
                            active ? 'text-text font-semibold' : 'text-text-dim',
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="text-text-faint text-micro shrink-0">{s.unit}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </Panel>
  )
}

/** Muted wayfinding accents — never confusable with a status colour. */
export function groupAccent(group: string): string {
  switch (group) {
    case 'THICKNESS':
      return 'var(--accent-thickness)'
    case 'ROLLING':
      return 'var(--accent-rolling)'
    case 'WORK ROLL':
      return 'var(--accent-workroll)'
    case 'TENSION':
      return 'var(--accent-tension)'
    case 'DRIVE':
      return 'var(--accent-drive)'
    case 'HYDRAULIC':
      return 'var(--accent-hydraulic)'
    case 'ENERGY':
      return 'var(--accent-energy)'
    case 'COIL / STRIP':
      return 'var(--accent-coil)'
    default:
      return 'var(--accent-system)'
  }
}

/* ── Plot ───────────────────────────────────────────────────────────────── */

function TrendPlot({
  signals,
  window,
  paused,
}: {
  signals: TelemetrySignal[]
  window: TrendWindowKey
  paused: boolean
}) {
  const live = useMergedTrend(signals, window)
  const tags = useMachineStore((s) => s.tags)

  // Freeze a copy while paused. The ring buffer keeps overwriting underneath
  // regardless, so holding the reference is what actually stops the motion.
  const [frozen, setFrozen] = useState<typeof live | null>(null)
  if (paused && frozen === null) setFrozen(live)
  if (!paused && frozen !== null) setFrozen(null)
  const all = paused && frozen ? frozen : live

  // Drag-to-zoom across the X axis. This narrows the view to a sub-range of the
  // points already in the buffer — it does NOT invent resolution, which is why
  // it is honest where a pixel zoom into a coarse window would not be. To see
  // genuinely finer detail, narrow the TIME RANGE instead: that reads a
  // different, finer buffer.
  const [zoom, setZoom] = useState<{ from: number; to: number } | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragTo, setDragTo] = useState<number | null>(null)

  const rows = useMemo(() => {
    if (!zoom) return all
    return all.filter((r) => r.timestamp >= zoom.from && r.timestamp <= zoom.to)
  }, [all, zoom])

  function commitZoom() {
    if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
      const [from, to] = dragFrom < dragTo ? [dragFrom, dragTo] : [dragTo, dragFrom]
      // Refuse a selection too small to hold a couple of points — otherwise the
      // chart zooms into an empty range and looks broken.
      if (all.filter((r) => r.timestamp >= from && r.timestamp <= to).length >= 2) {
        setZoom({ from, to })
      }
    }
    setDragFrom(null)
    setDragTo(null)
  }

  if (signals.length === 0) {
    return (
      <div className="text-text-faint text-meta flex min-h-[320px] flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="text-value font-semibold">Select a parameter to trend</span>
        <span>Search or pick from the groups on the left. Up to {MAX_CHANNELS} at once.</span>
      </div>
    )
  }

  if (rows.length < 2) {
    return (
      <div className="text-text-faint text-meta flex min-h-[320px] flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="text-value font-semibold">Collecting data…</span>
        <span>
          The trend draws as soon as the feed delivers samples. A parameter with no tag on this feed
          never starts.
        </span>
      </div>
    )
  }

  return (
    <>
      {/* Active-channel legend, with each series' live provenance.
          Fixed height (`.trend-legend`) so the plot below keeps a definite
          size no matter how many channels wrap — see the height contract in
          index.css. Overflow scrolls inside the legend rather than stealing
          from the chart. */}
      <div className="trend-legend border-line bg-base-850 flex flex-wrap content-start gap-x-4 gap-y-1.5 border-b px-3 py-2">
        {signals.map((key) => {
          const s = SIGNAL_BY_KEY[key]
          const tag = tags[s.tagName]
          return (
            <span key={key} className="text-meta inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-[3px] w-4 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-text-dim">{s.label}</span>
              <span className="text-text-faint text-micro">{s.unit}</span>
              {tag && <ProvenanceBadge provenance={tag.provenance} quality={tag.quality} />}
            </span>
          )
        })}

        <button
          type="button"
          onClick={() => exportCsv(rows, signals, window)}
          title="Download the plotted points as CSV"
          className="border-line text-text-dim hover:text-text hover:bg-base-800 text-micro ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold"
        >
          <Download size={12} aria-hidden />
          CSV
        </button>
      </div>

      {/* Floated over the plot rather than stacked above it: a banner in the
          flex column would add height the band contract does not budget for,
          and `.panel { overflow: hidden }` would clip the time axis. */}
      <div className="trend-plot relative min-h-0 flex-1 px-2 pb-2">
        {zoom && (
          <div className="border-warning/40 bg-base-900/95 absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3 py-1.5 shadow-[var(--shadow-pop)]">
            <span className="text-warning text-micro font-semibold">
              ZOOMED · {rows.length} of {all.length} points
            </span>
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="border-line text-text-dim hover:text-text text-micro rounded-full border px-2.5 py-0.5 font-semibold"
            >
              RESET ZOOM
            </button>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 12, right: 16, bottom: 4, left: -4 }}
            syncId="crm04"
            onMouseDown={(e) => {
              if (e && typeof e.activeLabel === 'number') setDragFrom(e.activeLabel)
            }}
            onMouseMove={(e) => {
              if (dragFrom !== null && e && typeof e.activeLabel === 'number') {
                setDragTo(e.activeLabel)
              }
            }}
            onMouseUp={commitZoom}
            onMouseLeave={commitZoom}
          >
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v: number) => new Date(v).toLocaleTimeString()}
              stroke="var(--color-line-bright)"
              tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
              minTickGap={48}
            />
            {/* One scale per signal — mixing units on a shared axis would be a
                misleading comparison. Only the first axis is drawn; exact
                values are always readable in the cursor tooltip. */}
            {signals.map((key, i) => (
              <YAxis
                key={key}
                yAxisId={key}
                hide={i > 0}
                stroke="var(--color-line-bright)"
                tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
                width={52}
                domain={['auto', 'auto']}
              />
            ))}
            <Tooltip
              contentStyle={{
                background: 'var(--color-base-900)',
                border: '1px solid var(--color-line-bright)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--color-text)',
                boxShadow: 'var(--shadow-pop)',
              }}
              labelFormatter={(label) =>
                typeof label === 'number' ? new Date(label).toLocaleTimeString() : ''
              }
              formatter={(value, name) => {
                const s = SIGNAL_BY_KEY[name as TelemetrySignal]
                if (!s || typeof value !== 'number') return [String(value), String(name)]
                return [`${value.toFixed(s.decimals)} ${s.unit}`, s.label]
              }}
            />

            {/* Engineering limits for the FIRST channel only — the axis the
                gridlines belong to. Drawing another channel's limit against a
                scale it does not share would put the line in the wrong place. */}
            {limitsFor(signals[0]).map((ref) => (
              <ReferenceLine
                key={`${signals[0]}-${ref.label}`}
                yAxisId={signals[0]}
                y={ref.value}
                stroke={referenceColor(ref.tone)}
                strokeDasharray="5 4"
                strokeOpacity={0.75}
                label={{
                  value: ref.label,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: referenceColor(ref.tone),
                }}
              />
            ))}

            {signals.map((key) => {
              const s = SIGNAL_BY_KEY[key]
              return (
                <Line
                  key={key}
                  yAxisId={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.isReference ? '5 4' : undefined}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )
            })}

            {/* The drag selection, drawn while the pointer is down. */}
            {dragFrom !== null && dragTo !== null && (
              <ReferenceArea
                yAxisId={signals[0]}
                x1={dragFrom}
                x2={dragTo}
                strokeOpacity={0}
                fill="var(--color-normal)"
                fillOpacity={0.12}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
