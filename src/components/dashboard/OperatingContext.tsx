/**
 * OPERATING CONTEXT — the six facts that frame everything else on the screen.
 *
 *   COIL · GRADE · WIDTH · PASS · DIRECTION · MILL STATE
 *
 * Sits directly under the page title so process context is established before
 * the operator reads a single number. Deliberately not a KPI row: these are
 * identity and state, not measurements, so they get no setpoint or deviation.
 */

import { ArrowLeft, ArrowRight, Boxes, Layers, MoveHorizontal, Repeat2, Activity, Ruler } from 'lucide-react'
import { STATUS_LABEL } from '../../machine/machineStateMachine'
import { useMachineStore } from '../../store/machineStore'
import { ValueReadout } from '../common/ValueReadout'
import { Progress } from '../ui/primitives'
import { cn } from '../ui/cn'

export function OperatingContext() {
  const coilId = useMachineStore((s) => s.state.coil.id)
  const grade = useMachineStore((s) => s.state.coil.grade)
  const pass = useMachineStore((s) => s.state.pass)
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const status = useMachineStore((s) => s.state.machineStatus)

  const stateTone =
    status === 'ROLLING'
      ? 'text-healthy'
      : status === 'FAST_STOP' || status === 'FAULT'
        ? 'text-trip alarm-pulse'
        : status === 'REVERSING' || status === 'DECELERATING'
          ? 'text-warning'
          : 'text-text-dim'

  return (
    <section
      aria-label="Operating context"
      className="operating-context border-line bg-base-900 border"
    >
      <Cell label="CURRENT COIL" icon={<Boxes size={16} aria-hidden />}>
        <span className="num text-text text-value font-semibold">{coilId}</span>
      </Cell>

      <Cell label="GRADE" icon={<Layers size={16} aria-hidden />}>
        {grade ? (
          <span className="text-text text-body font-semibold">{grade}</span>
        ) : (
          <ValueReadout tagName="COIL.GRADE" size="sm" />
        )}
      </Cell>

      <Cell label="WIDTH" icon={<Ruler size={16} aria-hidden />}>
        <ValueReadout tagName="STRIP.WIDTH" size="md" decimals={0} hideBadge />
      </Cell>

      <Cell label="CURRENT PASS" icon={<Repeat2 size={16} aria-hidden />}>
        <span className="num text-text text-value font-semibold">
          {pass.current}
          <span className="text-text-faint text-body"> / {pass.total}</span>
        </span>
        <div className="mt-1.5 w-full max-w-[140px]">
          <Progress
            value={pass.total > 0 ? (pass.current / pass.total) * 100 : 0}
            ariaLabel={`Pass ${pass.current} of ${pass.total}`}
          />
        </div>
      </Cell>

      <Cell label="DIRECTION" icon={<MoveHorizontal size={16} aria-hidden />}>
        <span
          className={cn(
            'text-value inline-flex items-center gap-1.5 font-semibold',
            direction === 'FORWARD' ? 'text-normal' : 'text-prov-simulated',
          )}
        >
          {direction === 'FORWARD' ? (
            <ArrowRight size={17} aria-hidden />
          ) : (
            <ArrowLeft size={17} aria-hidden />
          )}
          {direction}
        </span>
      </Cell>

      <Cell label="MILL STATE" icon={<Activity size={16} aria-hidden />} live={status === 'ROLLING'}>
        <span className={cn('num text-value font-semibold tracking-tight', stateTone)}>
          {STATUS_LABEL[status]}
        </span>
      </Cell>
    </section>
  )
}

function Cell({ label, icon, live = false, children }: { label: string; icon?: React.ReactNode; live?: boolean; children: React.ReactNode }) {
  return (
    <div className="ctx-cell min-w-0">
      {icon && (
        <span aria-hidden className={cn('ctx-ico', live && 'bg-healthy/15 text-healthy')}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="label truncate">{label}</div>
        <div className="mt-1 truncate">{children}</div>
      </div>
    </div>
  )
}
