/**
 * PARAMETER GROUP — the full process-parameter set, grouped and tabulated.
 *
 * The KPI ribbon above is the high-priority SUBSET of these; this is the whole
 * list. Rows are a table rather than cards on purpose: forty parameters as
 * forty cards is unreadable, and an operator comparing an actual against its
 * setpoint wants them aligned in a column.
 *
 * Each group carries a muted accent on its heading edge purely as wayfinding —
 * it tells you WHICH group you are in. It is deliberately desaturated so it can
 * never be mistaken for a status colour, which is the only thing on this screen
 * allowed to be vivid.
 */

import type { ReactNode } from 'react'
import { ReadoutRow, DerivedRow } from '../common/ValueReadout'

export interface ParameterRow {
  label: string
  /** A tag-backed value — the normal case. */
  tagName?: string
  decimals?: number
  scale?: number
  unitOverride?: string
  signed?: boolean
  /** A derived (non-tag) value, rendered in the dimmer treatment. */
  derived?: { value: string; unit?: string; tone?: 'normal' | 'warning' | 'alarm' | 'healthy' | 'dim'; title?: string }
}

export function ParameterGroup({
  title,
  accent,
  icon,
  rows,
  footer,
}: {
  title: string
  accent: string
  icon?: React.ReactNode
  rows: ParameterRow[]
  footer?: ReactNode
}) {
  return (
    <section className="param-group border-line bg-base-900 border" style={{ '--group-accent': accent } as React.CSSProperties}>
      <h3 className="param-group-title flex items-center gap-2">
        {icon && (
          <span aria-hidden className="inline-flex items-center">
            {icon}
          </span>
        )}
        <span className="truncate">{title}</span>
        <span className="param-count" aria-label={`${rows.length} parameters`}>
          {rows.length}
        </span>
      </h3>
      <div className="px-4 py-2.5">
        {rows.map((row) =>
          row.derived ? (
            <DerivedRow
              key={row.label}
              label={row.label}
              value={row.derived.value}
              unit={row.derived.unit}
              tone={row.derived.tone}
              title={row.derived.title}
            />
          ) : (
            <ReadoutRow
              key={row.label}
              label={row.label}
              tagName={row.tagName as string}
              decimals={row.decimals}
              scale={row.scale}
              unitOverride={row.unitOverride}
              signed={row.signed}
            />
          ),
        )}
        {footer}
      </div>
    </section>
  )
}
