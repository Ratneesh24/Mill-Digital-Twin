/**
 * DIRECTION INDICATOR — §11.4.
 *
 * "`FORWARD →` / `← REVERSE`, animated, driven by the same MachineState as the
 *  twin."
 *
 * Same store, same field, same frame as the 3D scene. During a reversal it shows
 * the sequence explicitly, because the most confusing moment on a reversing mill
 * is the one where the direction has been decided but the strip has not moved
 * yet (§9: no instant flip).
 */

import { motion } from 'framer-motion'
import { useMachineStore } from '../../store/machineStore'
import { entryReelId, exitReelId } from '../../machine/machineState'

export function DirectionIndicator() {
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const status = useMachineStore((s) => s.state.machineStatus)
  const moving = useMachineStore((s) => s.state.speed.actual > 0.05)

  const reversing = status === 'REVERSING'
  const forward = direction === 'FORWARD'

  return (
    <div className="border-line bg-base-950 flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm">
      <span className="label">DIRECTION</span>

      <div className="relative flex h-4 w-16 items-center overflow-hidden">
        {/* The travelling marks run the way the strip runs, and stop when it
            stops — the same rule the 3D strip follows. */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`absolute h-[2px] w-3 ${reversing ? 'bg-warning' : 'bg-normal'}`}
            animate={
              moving
                ? { x: forward ? [0, 56] : [56, 0], opacity: [0, 1, 1, 0] }
                : { x: forward ? 20 + i * 14 : 36 - i * 14, opacity: 0.3 }
            }
            transition={
              moving
                ? { duration: 1.1, repeat: Infinity, delay: i * 0.36, ease: 'linear' }
                : { duration: 0.3 }
            }
          />
        ))}
      </div>

      <span
        className={`num text-[12px] font-semibold tracking-[0.1em] ${
          reversing ? 'text-warning' : 'text-text'
        }`}
      >
        {forward ? 'FORWARD →' : '← REVERSE'}
      </span>

      <span className="text-text-faint border-line border-l pl-2 text-[9px] tracking-wider">
        {entryReelId(direction)} → {exitReelId(direction)}
      </span>
    </div>
  )
}
