/**
 * ALARM PANEL — §13.1.
 *
 * Active alarms, most severe first, each naming the parameter, the actual value
 * and the limit it crossed. Acknowledging silences the visual attention but does
 * not clear the alarm — only the condition going away does that.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { useAlarmStore } from '../../store/alarmStore'
import type { Alarm, AlarmSeverity } from '../../types/alarms'
import { Panel } from '../common/Panel'
import { cn } from '../ui/cn'

const SEVERITY_STYLE: Record<AlarmSeverity, string> = {
  TRIP: 'border-l-trip text-trip sev-glow-trip',
  ALARM: 'border-l-alarm text-alarm sev-glow-alarm',
  WARNING: 'border-l-warning text-warning sev-glow-warning',
  INFO: 'border-l-normal text-normal sev-glow-info',
}

const SEVERITY_ICON: Record<AlarmSeverity, typeof TriangleAlert> = {
  TRIP: TriangleAlert,
  ALARM: TriangleAlert,
  WARNING: TriangleAlert,
  INFO: ShieldCheck,
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
            className="text-text-faint hover:text-text-dim text-micro tracking-wider"
          >
            ACK ALL
          </button>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {active.length === 0 ? (
        <div className="flex items-center justify-center gap-2.5 px-4 py-5">
          <span
            aria-hidden
            className="bg-healthy/12 text-healthy grid h-9 w-9 place-items-center rounded-full"
          >
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-text text-body font-semibold leading-tight">All clear</p>
            <p className="text-text-faint text-micro mt-0.5">No active alarms</p>
          </div>
        </div>
      ) : (
        <ul>
          {/* A row sliding in is the signal that something just changed —
              worth animating on the one panel an operator scans first. */}
          <AnimatePresence initial={false}>
            {active.map((alarm) => (
              <AlarmRow key={alarm.id} alarm={alarm} onAck={() => acknowledge(alarm.id)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  )
}

function AlarmRow({ alarm, onAck }: { alarm: Alarm; onAck: () => void }) {
  const unacked = !alarm.acknowledged
  const attention = unacked && (alarm.severity === 'ALARM' || alarm.severity === 'TRIP')
  const still = useReducedMotion()
  const SevIcon = SEVERITY_ICON[alarm.severity]

  return (
    <motion.li
      layout={!still}
      initial={still ? false : { opacity: 0, height: 0, x: -8 }}
      animate={{ opacity: alarm.acknowledged ? 0.55 : 1, height: 'auto', x: 0 }}
      exit={still ? undefined : { opacity: 0, height: 0, x: 8 }}
      transition={{ duration: still ? 0 : 0.22, ease: 'easeOut' }}
      className={cn(
        'border-line overflow-hidden border-b border-l-2 px-2.5 py-2',
        SEVERITY_STYLE[alarm.severity],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <SevIcon size={15} aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className={`text-meta leading-snug ${attention ? 'alarm-pulse' : ''}`}>
              {alarm.message}
            </div>
            <div className="text-text-faint num mt-0.5 text-micro">
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
        </div>
        {unacked && (
          <button
            type="button"
            onClick={onAck}
            className="border-line text-text-faint hover:text-text-dim shrink-0 rounded-full border px-2.5 text-micro leading-[20px] tracking-wider"
          >
            ACK
          </button>
        )}
      </div>
    </motion.li>
  )
}
