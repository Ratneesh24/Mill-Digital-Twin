/**
 * KPI BAR — §11.1 / §11.3.
 *
 * "SPEED │ THICKNESS │ FORCE │ GAP │ TENSION │ PASS │ STATUS"
 *
 * "Compact engineering modules, not oversized SaaS cards. Each: name, value,
 *  unit, status, small trend/sparkline, provenance badge."
 *
 *   ROLL FORCE
 *   166 t   NORMAL   ▲2.4%   ⟡ EST
 *
 * Every module reads a tag through `ValueReadout`, so the number here is the
 * same object the 3D label and the trend chart read (§18).
 */

import type { ReactNode } from 'react'
import { engineeringConfig } from '../../config/engineeringConfig'
import { millConfig } from '../../config/millConfig'
import { STATUS_LABEL } from '../../machine/machineStateMachine'
import { useMachineStore } from '../../store/machineStore'
import { SIGNAL_BY_KEY } from '../../store/telemetryStore'
import type { TelemetrySignal } from '../../types/telemetry'
import { Sparkline } from '../common/Sparkline'
import { ValueReadout } from '../common/ValueReadout'

interface ModuleProps {
  name: string
  tagName: string
  decimals?: number
  signal?: TelemetrySignal
  /** Small secondary line under the value — a reference, limit or trend. */
  footer?: ReactNode
  scale?: number
  unitOverride?: string
  signed?: boolean
}

function KpiModule({
  name,
  tagName,
  decimals,
  signal,
  footer,
  scale,
  unitOverride,
  signed,
}: ModuleProps) {
  const status = useMachineStore((s) => s.tags[tagName]?.status)
  const descriptor = signal ? SIGNAL_BY_KEY[signal] : null

  const statusText =
    status === 'TRIP'
      ? 'TRIP'
      : status === 'ALARM'
        ? 'ALARM'
        : status === 'WARNING'
          ? 'WARNING'
          : status === 'NORMAL'
            ? 'NORMAL'
            : '—'

  const statusClass =
    status === 'TRIP'
      ? 'text-trip'
      : status === 'ALARM'
        ? 'text-alarm'
        : status === 'WARNING'
          ? 'text-warning'
          : status === 'NORMAL'
            ? 'text-healthy'
            : 'text-text-faint'

  return (
    <div className="kpi-card border-line bg-base-900 flex min-w-0 flex-1 items-center justify-between gap-3 border">
      <div className="min-w-0">
        <div className="label truncate">{name}</div>
        <ValueReadout
          tagName={tagName}
          size="lg"
          decimals={decimals}
          scale={scale}
          unitOverride={unitOverride}
          signed={signed}
        />
        <div className="kpi-caption mt-1.5 flex items-center gap-2">
          <span className={`text-[9px] tracking-[0.1em] ${statusClass}`}>{statusText}</span>
          {footer}
        </div>
      </div>
      {descriptor && (
        <div className="kpi-sparkline shrink-0">
          <Sparkline signal={descriptor.key} color={descriptor.color} />
        </div>
      )}
    </div>
  )
}

/** Small dim caption used for reference values under a KPI. */
function Ref({ children }: { children: ReactNode }) {
  return <span className="text-text-faint num text-[9px]">{children}</span>
}

export function KPIBar() {
  const speedRef = useMachineStore((s) => s.state.speed.reference)
  const thicknessRef = useMachineStore((s) => s.state.thickness.reference)
  const forceRef = useMachineStore((s) => s.state.rollingForce.reference)
  const forcePct = useMachineStore((s) => s.state.rollingForce.percentage)
  const gapRef = useMachineStore((s) => s.state.rollGap.reference)
  const pass = useMachineStore((s) => s.state.pass)
  const status = useMachineStore((s) => s.state.machineStatus)
  const reduction = useMachineStore((s) => s.state.thickness.reduction)

  return (
    <div className="grid gap-3">
      <KpiModule
        name="MILL SPEED"
        tagName="MILL.SPEED.ACTUAL"
        decimals={0}
        signal="speed"
        footer={<Ref>REF {speedRef.toFixed(0)} · MAX {millConfig.ratings.maxMillSpeed}</Ref>}
      />
      <KpiModule
        name="EXIT THICKNESS"
        tagName="STRIP.THICKNESS"
        decimals={3}
        signal="thickness"
        footer={<Ref>REF {thicknessRef.toFixed(3)} mm · RED {reduction.toFixed(1)}%</Ref>}
      />
      <KpiModule
        name="ROLL FORCE"
        tagName="ROLL.FORCE.ACTUAL"
        decimals={0}
        signal="rollingForce"
        footer={
          <Ref>
            REF {forceRef.toFixed(0)} t · {forcePct.toFixed(0)}% OF{' '}
            {millConfig.ratings.maxRollingForce} t
          </Ref>
        }
      />
      <KpiModule
        name="ROLL GAP"
        tagName="ROLL.GAP.ACTUAL"
        decimals={3}
        signal="rollGap"
        footer={<Ref>S0 REF {gapRef === null ? 'NO TAG' : `${gapRef.toFixed(3)} mm`}</Ref>}
      />
      <KpiModule
        name="THICKNESS DEV"
        tagName="STRIP.THICKNESS.DEVIATION"
        decimals={1}
        signal="thicknessDeviation"
        signed
        footer={<Ref>TARGET ±{engineeringConfig.thicknessTolerance} µm</Ref>}
      />
      <KpiModule
        name="ENTRY TENSION"
        tagName="TENSION.ENTRY"
        decimals={1}
        signal="entryTension"
        footer={<Ref>EXIT — see reel panel</Ref>}
      />
      <KpiModule
        name="EXIT TENSION"
        tagName="TENSION.EXIT"
        decimals={1}
        signal="exitTension"
        footer={<Ref>kN on delivered section</Ref>}
      />

      {/* PASS and STATUS are not tag readouts — they are the mill's context. */}
      <div className="kpi-card border-line bg-base-900 flex min-w-0 flex-col justify-center border">
        <div className="label">PASS</div>
        <div className="num text-text text-[24px] leading-tight tracking-tight">
          {pass.current}
          <span className="text-text-faint text-[15px]"> / {pass.total}</span>
        </div>
        <div className="bg-base-800 border-line mt-1 h-[4px] w-full border">
          <div
            className="bg-normal h-full transition-[width] duration-300"
            style={{ width: `${Math.min(pass.progress * 100, 100)}%` }}
          />
        </div>
        <span className="text-text-faint num mt-0.5 text-[9px]">
          {(pass.progress * 100).toFixed(0)}% COMPLETE
        </span>
      </div>

      <div className="kpi-card border-line bg-base-900 flex min-w-0 flex-col justify-center border">
        <div className="label">MILL STATUS</div>
        <div
          className={`num text-[18px] leading-tight font-semibold tracking-[0.08em] ${
            status === 'ROLLING'
              ? 'text-healthy'
              : status === 'FAST_STOP' || status === 'FAULT'
                ? 'text-trip alarm-pulse'
                : status === 'REVERSING' || status === 'DECELERATING'
                  ? 'text-warning'
                  : 'text-text-dim'
          }`}
        >
          {STATUS_LABEL[status]}
        </div>
      </div>
    </div>
  )
}
