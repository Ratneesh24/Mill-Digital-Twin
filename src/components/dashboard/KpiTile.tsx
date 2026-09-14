/**
 * KPI TILE — one primary process value, read at a glance.
 *
 *   ┌──────────────────────────────┐
 *   │ EXIT THICKNESS          [SIM]│  name + provenance
 *   │ 2.151 mm                     │  ACTUAL   — bold, largest
 *   │ SP 2.150 mm   Δ +1.0 µm      │  SETPOINT + DEVIATION
 *   │ ● NORMAL                     │  STATUS   — colour AND text
 *   └──────────────────────────────┘
 *
 * Compact by design. An operator scanning a wall of these needs the number to
 * dominate and everything else to stay legible but subordinate — so the value
 * is the only thing rendered large, and the group accent is a 3px edge rather
 * than a filled card, so it never competes with the status colour.
 *
 * Status is never carried by colour alone: every tile pairs the tone with a
 * word, which is what keeps it readable for colourblind operators and legible
 * from a few feet away.
 *
 * The value always comes from `ValueReadout`, so a parameter with no tag on the
 * active feed reads NO TAG here exactly as it does everywhere else (§7.4).
 */

import type { CSSProperties, ReactNode } from 'react'
import { useMachineStore } from '../../store/machineStore'
import type { TagStatus } from '../../types/tags'
import type { TelemetrySignal } from '../../types/telemetry'
import { ValueReadout } from '../common/ValueReadout'
import { Sparkline } from '../common/Sparkline'
import { cn } from '../ui/cn'

const STATUS_VIEW: Record<TagStatus | 'MISSING', { text: string; tone: string; dot: string; pill: string }> = {
  TRIP: { text: 'TRIP', tone: 'text-trip', dot: 'bg-trip', pill: 'status-pill-trip text-trip' },
  ALARM: { text: 'ALARM', tone: 'text-alarm', dot: 'bg-alarm', pill: 'status-pill-alarm text-alarm' },
  WARNING: { text: 'WARNING', tone: 'text-warning', dot: 'bg-warning', pill: 'status-pill-warning text-warning' },
  NORMAL: { text: 'NORMAL', tone: 'text-healthy', dot: 'bg-healthy', pill: 'status-pill-normal text-healthy' },
  UNKNOWN: { text: 'NO DATA', tone: 'text-text-faint', dot: 'bg-inactive', pill: 'status-pill-missing text-text-faint' },
  MISSING: { text: 'NO DATA', tone: 'text-text-faint', dot: 'bg-inactive', pill: 'status-pill-missing text-text-faint' },
}

interface Props {
  label: string
  tagName: string
  decimals?: number
  scale?: number
  unitOverride?: string
  signed?: boolean
  /** Accent colour for the group this tile belongs to (wayfinding only). */
  accent?: string
  /** Setpoint tag, rendered as `SP <value>` under the actual. */
  setpointTag?: string
  /**
   * Deviation tag. Prefer a real tag over subtracting in the component — the
   * model already publishes deviation where it is meaningful.
   */
  deviationTag?: string
  deviationDecimals?: number
  deviationUnit?: string
  /** Lucide icon shown in the accent chip (visual wayfinding only). */
  icon?: ReactNode
  /** Telemetry signal for the inline SVG sparkline (no chart lib on dashboard). */
  spark?: TelemetrySignal
}

export function KpiTile({
  label,
  tagName,
  decimals,
  scale,
  unitOverride,
  signed,
  accent,
  setpointTag,
  deviationTag,
  deviationDecimals,
  deviationUnit,
  icon,
  spark,
}: Props) {
  const status = useMachineStore((s) => s.tags[tagName]?.status)
  const view = STATUS_VIEW[status ?? 'MISSING']

  return (
    <div
      className="kpi-tile border-line bg-base-900 border"
      style={accent ? ({ '--kpi-accent': accent } as CSSProperties) : undefined}
    >
      <div className="kpi-tile-head">
        {icon && (
          <span aria-hidden className="kpi-icon">
            {icon}
          </span>
        )}
        <div className="label min-w-0 flex-1 truncate">{label}</div>
      </div>

      <div className="mt-1 min-w-0">
        <ValueReadout
          tagName={tagName}
          size="lg"
          decimals={decimals}
          scale={scale}
          unitOverride={unitOverride}
          signed={signed}
        />
      </div>

      {(setpointTag || deviationTag) && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {setpointTag && (
            <span className="text-text-faint text-micro inline-flex items-baseline gap-1">
              SP
              <ValueReadout
                tagName={setpointTag}
                size="sm"
                decimals={decimals}
                scale={scale}
                unitOverride={unitOverride}
                hideBadge
                className="text-text-dim"
              />
            </span>
          )}
          {deviationTag && (
            <span className="text-text-faint text-micro inline-flex items-baseline gap-1">
              Δ
              <ValueReadout
                tagName={deviationTag}
                size="sm"
                decimals={deviationDecimals}
                unitOverride={deviationUnit}
                signed
                hideBadge
              />
            </span>
          )}
        </div>
      )}

      <div className="mt-2">
        <span className={cn('status-pill', view.pill)}>
          <span aria-hidden className={cn('dot-glow h-1.5 w-1.5 shrink-0 rounded-full', view.dot)} />
          {view.text}
        </span>
      </div>

      {spark ? (
        <div className="kpi-spark kpi-sparkline" aria-hidden>
          <Sparkline signal={spark} color={accent ?? 'var(--color-brand)'} fluid height={26} />
        </div>
      ) : (
        <div className="kpi-spark" aria-hidden>
          <div className="border-line/60 border-b border-dashed" style={{ height: 26 }} />
        </div>
      )}
    </div>
  )
}

/**
 * A KPI that is NOT a tag — pass counters, mill state, derived indicators.
 * Rendered in the same tile shape so the ribbon stays even, but the caller
 * supplies the content because there is no tag to read.
 */
export function KpiSlot({
  label,
  accent,
  children,
}: {
  label: string
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="kpi-tile border-line bg-base-900 border"
      style={accent ? ({ '--kpi-accent': accent } as CSSProperties) : undefined}
    >
      <div className="label truncate">{label}</div>
      {children}
    </div>
  )
}
