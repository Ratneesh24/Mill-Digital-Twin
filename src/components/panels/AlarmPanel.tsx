/**
 * ALARM PANEL — §13.1.
 *
 * Active alarms, most severe first, each naming the parameter, the actual value
 * and the limit it crossed. Acknowledging silences the visual attention but does
 * not clear the alarm — only the condition going away does that.
 */

import { useAlarmStore } from '../../store/alarmStore'
import type { Alarm, AlarmSeverity } from '../../types/alarms'
import { EmptyNote, Panel } from '../common/Panel'

const SEVERITY_STYLE: Record<AlarmSeverity, string> = {
  TRIP: 'border-l-trip text-trip',
  ALARM: 'border-l-alarm text-alarm',
  WARNING: 'border-l-warning text-warning',
  INFO: 'border-l-normal text-normal',
}

export function AlarmPanel() {
  const active = useAlarmStore((s) => s.active)
  const acknowledge = useAlarmStore((s) => s.acknowledge)
  const acknowledgeAll = useAlarmStore((s) => s.acknowledgeAll)

  return (
    <Panel
      title={`Alarms${active.length ? ` · ${active.length}` : ''}`}
      right={
        active.length > 0 ? (
          <button
            type="button"
            onClick={acknowledgeAll}
            className="text-text-faint hover:text-text-dim text-[9px] tracking-wider"
          >
            ACK ALL
          </button>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {active.length === 0 ? (
        <EmptyNote>No active alarms</EmptyNote>
      ) : (
        <ul>
          {active.map((alarm) => (
            <AlarmRow key={alarm.id} alarm={alarm} onAck={() => acknowledge(alarm.id)} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function AlarmRow({ alarm, onAck }: { alarm: Alarm; onAck: () => void }) {
  const unacked = !alarm.acknowledged
  const attention = unacked && (alarm.severity === 'ALARM' || alarm.severity === 'TRIP')

  return (
    <li
      className={`border-line border-b border-l-2 px-2.5 py-1.5 ${SEVERITY_STYLE[alarm.severity]} ${
        alarm.acknowledged ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[11px] leading-snug ${attention ? 'alarm-pulse' : ''}`}>
            {alarm.message}
          </div>
          <div className="text-text-faint num mt-0.5 text-[9px]">
            {new Date(alarm.timestamp).toLocaleTimeString()} · {alarm.tagName}
            {alarm.unit && (
              <>
                {' '}
                · {alarm.actualValue.toFixed(1)} {alarm.unit} vs limit{' '}
                {alarm.limit.toFixed(1)} {alarm.unit}
              </>
            )}
          </div>
        </div>
        {unacked && (
          <button
            type="button"
            onClick={onAck}
            className="border-line text-text-faint hover:text-text-dim shrink-0 border px-1.5 text-[9px] leading-[16px] tracking-wider"
          >
            ACK
          </button>
        )}
      </div>
    </li>
  )
}
