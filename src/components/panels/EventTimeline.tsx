/**
 * EVENT TIMELINE — §11.4.
 *
 *   12:15:04 PASS 2 STARTED
 *   12:15:17 SPEED 120→150 mpm
 *   12:15:32 ROLLING FORCE HIGH
 *
 * Bounded log (§15) — the oldest events fall off rather than accumulating over a
 * multi-day shift.
 */

import { useMachineStore } from '../../store/machineStore'
import type { MachineEvent } from '../../types/machine'
import { EmptyNote, Panel } from '../common/Panel'

const CATEGORY_STYLE: Record<MachineEvent['category'], string> = {
  STATE: 'text-normal',
  PASS: 'text-healthy',
  SETPOINT: 'text-text-dim',
  ALARM: 'text-alarm',
  COMMS: 'text-warning',
  OPERATOR: 'text-prov-simulated',
}

export function EventTimeline() {
  const events = useMachineStore((s) => s.events)

  return (
    <Panel title="Event timeline" bodyClassName="p-0">
      {events.length === 0 ? (
        <EmptyNote>No events recorded</EmptyNote>
      ) : (
        <ul className="divide-line divide-y">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline gap-2 px-2.5 py-[3px]">
              <span className="num text-text-faint shrink-0 text-micro">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span className={`truncate text-micro tracking-wide ${CATEGORY_STYLE[event.category]}`}>
                {event.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
