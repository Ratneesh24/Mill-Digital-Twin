/**
 * MILL STATUS HERO — the visual-executive strip above the KPI ribbon.
 *
 * Three premium cards:
 *   1. Mill state (status word + direction + pass progress)
 *   2. Animated mill-line schematic (SVG, no canvas/chart libs)
 *   3. Drive load donut + speed + energy snapshot
 *
 * Tag values still come from ValueReadout / the store, so NO TAG honesty is
 * preserved — this strip only changes hierarchy, never data.
 */

import { ArrowLeft, ArrowRight, Flame, GaugeCircle, Package, Timer, Zap } from 'lucide-react'
import { millConfig } from '../../config/millConfig'
import { STATUS_LABEL } from '../../machine/machineStateMachine'
import { formatHMS, specificEnergy, throughput } from '../../machine/rollingEngine'
import { useMachineStore } from '../../store/machineStore'
import { ValueReadout } from '../common/ValueReadout'
import { ProvenanceBadge } from '../common/ProvenanceBadge'
import { getTagDefinition } from '../../data/tagDefinitions'
import { DonutGauge, Progress } from '../ui/primitives'
import { cn } from '../ui/cn'
import { MillLineSchematic } from './MillLineSchematic'

export function MillStatusHero() {
  const status = useMachineStore((s) => s.state.machineStatus)
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const pass = useMachineStore((s) => s.state.pass)
  const speed = useMachineStore((s) => s.state.speed.actual)
  const load = useMachineStore((s) => s.state.drive.torquePercentage)
  const state = useMachineStore((s) => s.state)

  const fwd = direction === 'FORWARD'
  const passPct = pass.total > 0 ? (pass.current / pass.total) * 100 : 0
  const tph = throughput(state)
  const spec = tph > 0.01 ? specificEnergy(state) : null

  const accent =
    status === 'ROLLING'
      ? 'var(--color-healthy)'
      : status === 'FAST_STOP' || status === 'FAULT'
        ? 'var(--color-trip)'
        : status === 'REVERSING' || status === 'DECELERATING'
          ? 'var(--color-warning)'
          : 'var(--color-brand)'

  const stateTone =
    status === 'ROLLING'
      ? 'text-healthy'
      : status === 'FAST_STOP' || status === 'FAULT'
        ? 'text-trip alarm-pulse'
        : status === 'REVERSING' || status === 'DECELERATING'
          ? 'text-warning'
          : 'text-text'

  const loadTone =
    load >= 100 ? 'var(--color-trip)' : load >= 80 ? 'var(--color-warning)' : 'var(--color-healthy)'
  // Torque noise at standstill formats as "-0" — clamp visual zero.
  const loadDisplay = Math.abs(load) < 0.5 ? 0 : load

  return (
    <section aria-label="Mill status overview" className="hero-grid">
      {/* 1 — state */}
      <div
        className="hero-card border-line bg-base-900 border"
        style={{ '--hero-accent': accent } as React.CSSProperties}
      >
        <div className="hero-state-glow" aria-hidden />
        <p className="label">Mill state · Pass {pass.current}/{pass.total}</p>
        <p className={cn('num mt-1 text-value-lg font-semibold tracking-tight', stateTone)}>
          {STATUS_LABEL[status]}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-bold tracking-wider',
              fwd
                ? 'border-normal/40 bg-normal/10 text-normal'
                : 'border-prov-simulated/40 bg-prov-simulated/10 text-prov-simulated',
            )}
          >
            {fwd ? <ArrowRight size={13} aria-hidden /> : <ArrowLeft size={13} aria-hidden />}
            {direction}
          </span>
          <span className="text-text-dim text-micro num inline-flex items-center gap-1">
            <GaugeCircle size={13} aria-hidden />
            {speed.toFixed(0)} m/min
          </span>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">Pass progress</span>
            <span className="num text-text-dim text-micro">{passPct.toFixed(0)}%</span>
          </div>
          <Progress value={passPct} ariaLabel={`Pass ${pass.current} of ${pass.total}`} />
        </div>
        <div
          className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5"
          title="Derived throughput from strip speed and section — not a measured tag"
        >
          <span className="label inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="bg-brand/12 text-brand grid h-6 w-6 place-items-center rounded-lg"
            >
              <Package size={13} />
            </span>
            Running TPH
          </span>
          <span className="num text-text text-value font-semibold">
            {tph.toFixed(1)} <span className="text-text-faint text-micro font-normal">t/h</span>
          </span>
        </div>
        <p className="text-text-faint text-micro mt-2.5 truncate">
          {millConfig.identity.mill} · Coil {state.coil.id}
        </p>
      </div>

      {/* 2 — schematic */}
      <div className="hero-card border-line bg-base-900 border">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="label">4HI reversing line · live</p>
          <span className="text-text-faint text-micro num hidden sm:inline">
            GAP <ValueReadout tagName="ROLL.GAP.ACTUAL" size="sm" decimals={3} hideBadge hideUnit />
            {' mm · '}
            FORCE <ValueReadout tagName="ROLL.FORCE.ACTUAL" size="sm" decimals={0} hideBadge hideUnit />
            {' kN'}
          </span>
        </div>
        <MillLineSchematic />
      </div>

      {/* 3 — load + energy */}
      <div
        className="hero-card border-line bg-base-900 flex items-center gap-4 border"
        style={{ '--hero-accent': loadTone } as React.CSSProperties}
      >
        <DonutGauge value={load} tone={loadTone} ariaLabel={`Motor load ${load.toFixed(1)} percent`}>
          <div className="text-center leading-none">
            <div className="num text-text text-value font-bold">{loadDisplay.toFixed(0)}</div>
            <div className="text-text-faint text-micro">%</div>
          </div>
        </DonutGauge>
        <div className="min-w-0 flex-1">
          <p className="label">Motor load · of {millConfig.ratings.mainDriveRatedTorque} kNm</p>
          <p
            className={cn(
              'text-micro mt-1 font-bold tracking-wider',
              load >= 100 ? 'text-trip' : load >= 80 ? 'text-warning' : 'text-healthy',
            )}
          >
            {load >= 100 ? 'OVERLOAD' : load >= 80 ? 'HIGH LOAD' : 'NORMAL'}
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-line pt-2.5">
            <div className="min-w-0">
              <p className="label flex items-center gap-1">
                <Zap size={11} aria-hidden /> Power
              </p>
              <ValueReadout tagName="DRIVE.POWER" size="md" decimals={0} hideBadge />
            </div>
            <div className="min-w-0">
              <p className="label flex items-center gap-1">
                <Flame size={11} aria-hidden /> kWh/t
              </p>
              <p className="num text-text text-value font-semibold">
                {spec === null ? '—' : spec.toFixed(1)}
              </p>
            </div>
          </div>
          <RollingTimeRow />
        </div>
      </div>
    </section>
  )
}

/**
 * ROLLING TIME · TODAY — shift/day total from the historian
 * (`MILL.TIME.ROLLING.DAY`). Rendered hh:mm:ss; until the historian supplies
 * the tag this reads NO TAG, exactly like the ENERGY TODAY tile (§7.4) —
 * a browser that was not running all day cannot reconstruct a day total.
 */
function RollingTimeRow() {
  const tag = useMachineStore((s) => s.tags['MILL.TIME.ROLLING.DAY'])
  const def = getTagDefinition('MILL.TIME.ROLLING.DAY')
  const seconds = typeof tag?.value === 'number' ? tag.value : null

  return (
    <div
      className="mt-2 flex items-center justify-between gap-2"
      title="Mill rolling time since 00:00 — historian feed"
    >
      <span className="label inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-lg"
          style={{
            background: 'color-mix(in srgb, var(--accent-tension) 14%, transparent)',
            color: 'var(--accent-tension)',
          }}
        >
          <Timer size={13} />
        </span>
        Rolling time · Today
      </span>
      {seconds === null ? (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="num text-value text-text-faint tracking-tight">—</span>
          <ProvenanceBadge
            provenance="UNAVAILABLE"
            note={def?.liveNote ?? 'Tag not available on the active feed'}
          />
        </span>
      ) : (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="num text-text text-value font-semibold tracking-tight">
            {formatHMS(seconds)}
          </span>
          {tag && (
            <ProvenanceBadge provenance={tag.provenance} quality={tag.quality} note={def?.liveNote} />
          )}
        </span>
      )}
    </div>
  )
}
