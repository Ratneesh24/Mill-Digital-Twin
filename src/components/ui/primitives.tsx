/**
 * UI PRIMITIVES — shadcn-style local building blocks (no new dependency).
 *
 * Plant network is isolated, so these are copy-paste components using the
 * existing Tailwind v4 tokens + `cn()`. They give the dashboard the premium
 * card/badge/progress/gauge language without pulling in tremor/MUI.
 */

import type { ReactNode } from 'react'
import { cn } from './cn'

/* ── Card ─────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-line bg-base-900 rounded-card border shadow-card min-w-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ── Icon chip — the visual anchor for every metric / group ───────────── */

const CHIP_TONE: Record<string, string> = {
  brand: 'bg-brand/10 text-brand',
  green: 'bg-healthy/10 text-healthy',
  amber: 'bg-warning/10 text-warning',
  red: 'bg-alarm/10 text-alarm',
  violet: 'bg-prov-simulated/10 text-prov-simulated',
  slate: 'bg-base-800 text-text-dim',
}

export function IconChip({
  tone = 'brand',
  children,
  size = 34,
}: {
  tone?: keyof typeof CHIP_TONE | string
  children: ReactNode
  size?: number
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        (CHIP_TONE as Record<string, string>)[tone] ?? CHIP_TONE.slate,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  )
}

/* ── Progress — pass progress, load bars, tank levels ─────────────────── */

export function Progress({
  value,
  tone = 'bg-normal',
  className = '',
  ariaLabel,
}: {
  value: number
  tone?: string
  className?: string
  ariaLabel?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-base-800 border-line h-2 w-full overflow-hidden rounded-full border', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ── Donut gauge — motor load, utilisation at a glance ────────────────── */

export function DonutGauge({
  value,
  size = 92,
  stroke = 10,
  tone = 'var(--color-normal)',
  track = 'var(--color-base-800)',
  children,
  ariaLabel,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: string
  track?: string
  children?: ReactNode
  ariaLabel?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `${Math.round(pct)} percent`}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* ── Section heading — consistent eyebrow + action row ────────────────── */

export function SectionHeading({
  icon,
  title,
  hint,
  right,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  right?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <h2 className="text-text text-body truncate font-bold tracking-tight">{title}</h2>
        {hint && <p className="text-text-faint text-micro mt-0.5 truncate">{hint}</p>}
      </div>
      {right}
    </div>
  )
}
