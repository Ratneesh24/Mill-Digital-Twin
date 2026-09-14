/** Panel shell and small shared primitives. Layout only — no process values. */

import type { ReactNode } from 'react'
import type { Health, CtrlState } from '../../types/machine'

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-title">
        <h2 className="min-w-0">{title}</h2>
        {right}
      </header>
      <div className={`panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

const HEALTH_STYLE: Record<Health, string> = {
  HEALTHY: 'text-healthy border-healthy/40 bg-healthy/10',
  WARNING: 'text-warning border-warning/40 bg-warning/10',
  FAULT: 'text-alarm border-alarm/50 bg-alarm/10',
  OFF: 'text-text-faint border-line bg-transparent',
  UNKNOWN: 'text-text-faint border-line bg-transparent',
  NO_TAG: 'text-prov-notag border-prov-notag/60 border-dashed bg-transparent',
}

const HEALTH_TEXT: Record<Health, string> = {
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  FAULT: 'FAULT',
  OFF: 'OFF',
  UNKNOWN: 'UNKNOWN',
  NO_TAG: 'NO TAG',
}

export function HealthPill({ health }: { health: Health }) {
  return (
    <span
      className={`inline-block border px-1.5 text-micro leading-[15px] tracking-wider ${HEALTH_STYLE[health]}`}
    >
      {HEALTH_TEXT[health]}
    </span>
  )
}

const CTRL_STYLE: Record<CtrlState, string> = {
  ON: 'text-healthy border-healthy/40 bg-healthy/10',
  OFF: 'text-text-faint border-line bg-transparent',
  FAULT: 'text-alarm border-alarm/50 bg-alarm/10',
  UNKNOWN: 'text-text-faint border-line bg-transparent',
  NO_TAG: 'text-prov-notag border-prov-notag/60 border-dashed bg-transparent',
}

const CTRL_TEXT: Record<CtrlState, string> = {
  ON: 'ON',
  OFF: 'OFF',
  FAULT: 'FAULT',
  UNKNOWN: '—',
  NO_TAG: 'NO TAG',
}

export function ControlPill({ state }: { state: CtrlState }) {
  return (
    <span
      className={`inline-block border px-1.5 text-micro leading-[15px] tracking-wider ${CTRL_STYLE[state]}`}
    >
      {CTRL_TEXT[state]}
    </span>
  )
}

/**
 * Horizontal utilisation bar. `value` is a percentage; the warning and alarm
 * marks are drawn at their configured thresholds so the bar shows headroom, not
 * just a number.
 */
export function UtilisationBar({
  value,
  warningAt,
  alarmAt,
  label,
}: {
  value: number
  warningAt?: number
  alarmAt?: number
  label?: string
}) {
  const pct = Math.max(0, Math.min(value, 100))
  const tone =
    alarmAt !== undefined && value >= alarmAt
      ? 'bg-alarm'
      : warningAt !== undefined && value >= warningAt
        ? 'bg-warning'
        : 'bg-normal'

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between">
          <span className="label">{label}</span>
          <span className="num text-text-dim text-micro">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="bg-base-800 border-line relative mt-1 h-[6px] w-full border">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        {warningAt !== undefined && (
          <span
            className="bg-warning/70 absolute top-0 h-full w-px"
            style={{ left: `${warningAt}%` }}
          />
        )}
        {alarmAt !== undefined && (
          <span
            className="bg-alarm/80 absolute top-0 h-full w-px"
            style={{ left: `${alarmAt}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-text-faint py-3 text-center text-meta">{children}</p>
}
