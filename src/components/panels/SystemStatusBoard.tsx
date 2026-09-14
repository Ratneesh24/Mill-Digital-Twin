/**
 * SYSTEM STATUS — one box, every subsystem, with an overall verdict.
 *
 * Replaces the old scatter of Process Control / Mill Interlock / auxiliary
 * pills across three panels. An operator asking "is anything wrong?" should
 * find the answer in one place, and an abnormal system should be identifiable
 * without reading every row.
 *
 * HONESTY NOTE — on the CRM04 46-tag extract almost every row here is NO TAG:
 * the plant does not publish control-mode words, interlock states or auxiliary
 * health. That is the truthful picture and is exactly what §7.4 demands we
 * show. A green tick on a row we cannot actually see would be a lie, and the
 * OVERALL verdict below deliberately refuses to claim health it cannot verify.
 */

import { useMachineStore } from '../../store/machineStore'
import type { CtrlState, Health } from '../../types/machine'
import { ControlPill, HealthPill, Panel } from '../common/Panel'
import { cn } from '../ui/cn'

/** Three states, because "not faulted" and "healthy" are different claims. */
type Verdict = 'GOOD' | 'BAD' | 'UNKNOWN'

function fromInterlock(value: boolean | null): Verdict {
  if (value === null) return 'UNKNOWN'
  return value ? 'GOOD' : 'BAD'
}

function fromControl(state: CtrlState): Verdict {
  if (state === 'NO_TAG' || state === 'UNKNOWN') return 'UNKNOWN'
  if (state === 'FAULT') return 'BAD'
  return 'GOOD'
}

function fromHealth(health: Health): Verdict {
  if (health === 'NO_TAG' || health === 'UNKNOWN') return 'UNKNOWN'
  if (health === 'FAULT' || health === 'WARNING') return 'BAD'
  return 'GOOD'
}

export function SystemStatusBoard() {
  const state = useMachineStore((s) => s.state)
  const { controls, interlocks, auxiliarySystems: aux, communication: comm } = state

  const commState: CtrlState = comm.connected ? (comm.stale ? 'FAULT' : 'ON') : 'FAULT'
  // E-stop is inverted: pressed (true) is the abnormal condition.
  const safety = interlocks.emergencyStop === null ? null : !interlocks.emergencyStop

  const rows: Array<{ label: string; node: React.ReactNode; verdict: Verdict }> = [
    { label: 'MILL', node: <InterlockPill value={interlocks.mill} />, verdict: fromInterlock(interlocks.mill) },
    { label: 'DRIVE', node: <InterlockPill value={interlocks.drive} />, verdict: fromInterlock(interlocks.drive) },
    { label: 'HYDRAULIC', node: <InterlockPill value={interlocks.hydraulic} />, verdict: fromInterlock(interlocks.hydraulic) },
    { label: 'GAUGE', node: <InterlockPill value={interlocks.gauge} />, verdict: fromInterlock(interlocks.gauge) },
    { label: 'TENSION CONTROL', node: <ControlPill state={controls.trf} />, verdict: fromControl(controls.trf) },
    { label: 'COOLING', node: <HealthPill health={aux.coolant} />, verdict: fromHealth(aux.coolant) },
    { label: 'LUBRICATION', node: <HealthPill health={aux.lubrication} />, verdict: fromHealth(aux.lubrication) },
    { label: 'EXHAUST', node: <HealthPill health={aux.exhaust} />, verdict: fromHealth(aux.exhaust) },
    { label: 'AGC', node: <ControlPill state={controls.agc} />, verdict: fromControl(controls.agc) },
    { label: 'WR BENDING', node: <ControlPill state={controls.bending} />, verdict: fromControl(controls.bending) },
    { label: 'MASS FLOW CONTROL', node: <ControlPill state={controls.mfc} />, verdict: fromControl(controls.mfc) },
    { label: 'POSITION MODE', node: <ControlPill state={controls.positionMode} />, verdict: fromControl(controls.positionMode) },
    { label: 'PLC / DATA', node: <ControlPill state={commState} />, verdict: fromControl(commState) },
    { label: 'SAFETY INTERLOCK', node: <InterlockPill value={safety} />, verdict: fromInterlock(safety) },
  ]

  const faults = rows.filter((r) => r.verdict === 'BAD')
  // "Everything we can see is fine" is the strongest claim available when most
  // rows are NO TAG — so say that, rather than "SYSTEM HEALTHY".
  const unknown = rows.filter((r) => r.verdict === 'UNKNOWN').length

  return (
    <Panel
      title="System status"
      bodyClassName="p-0"
      right={
        <span
          className={cn(
            'text-micro inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold tracking-wider',
            faults.length > 0
              ? 'border-alarm/50 bg-alarm/10 text-alarm'
              : 'border-healthy/40 bg-healthy/10 text-healthy',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'dot-glow h-1.5 w-1.5 rounded-full',
              faults.length > 0 ? 'bg-alarm alarm-pulse' : 'bg-healthy',
            )}
          />
          {faults.length > 0 ? `${faults.length} ABNORMAL` : 'MONITORED'}
        </span>
      }
    >
      <ul className="divide-line divide-y">
        {rows.map((row) => (
          <li
            key={row.label}
            className={cn(
              'status-row flex items-center justify-between gap-3 px-4 py-[7px]',
              row.verdict === 'BAD' && 'bg-alarm/8',
            )}
          >
            <span
              className={cn(
                'text-meta truncate',
                row.verdict === 'BAD' ? 'text-alarm font-semibold' : 'text-text-dim',
              )}
            >
              {row.label}
            </span>
            {row.node}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'border-line flex items-center justify-between gap-3 border-t px-4 py-3',
          faults.length > 0 ? 'verdict-bad' : 'verdict-good',
        )}
      >
        <span className="label font-semibold">OVERALL</span>
        <span
          className={cn(
            'text-meta font-semibold tracking-wide',
            faults.length > 0 ? 'text-alarm' : unknown > 0 ? 'text-text-dim' : 'text-healthy',
          )}
        >
          {faults.length > 0
            ? `${faults.length} SYSTEM${faults.length === 1 ? '' : 'S'} ABNORMAL`
            : unknown > 0
              ? `NO FAULTS · ${unknown} NOT INSTRUMENTED`
              : 'SYSTEM HEALTHY'}
        </span>
      </div>
    </Panel>
  )
}

/** Interlock booleans are three-state: ready, not ready, or no tag at all. */
function InterlockPill({ value }: { value: boolean | null }) {
  if (value === null) return <HealthPill health="NO_TAG" />
  return <HealthPill health={value ? 'HEALTHY' : 'FAULT'} />
}
