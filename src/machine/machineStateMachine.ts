/**
 * MACHINE STATE MACHINE — §9 of the master spec.
 *
 * ALL status transitions go through this module. No component, and no other
 * engine, may set `machineStatus` directly. That single rule is what stops the
 * classic twin failure where the 3D scene believes the mill is rolling while
 * the status banner says STOPPED.
 *
 * Every transition returns a REASON string. §13.2 forbids a bare "NOT READY",
 * and the same principle applies to every state: the operator must always be
 * able to see why the mill is in the state it is in.
 *
 * The reason says what the MILL is doing. It deliberately never claims anything
 * about interlock health — that claim belongs to the interlock chain, which on
 * a feed without interlock tags can only report "unverified" (§7.4). A status
 * banner asserting "all interlocks healthy" beside a panel saying it cannot see
 * them is the kind of quiet contradiction §18 exists to catch.
 */

import type { MachineStatus } from '../types/machine'

export type MachineCommand =
  | 'ENABLE'
  | 'START'
  | 'STOP'
  | 'FAST_STOP'
  | 'RESET'
  | 'REQUEST_ROLL_CHANGE'

export type MachineSignal =
  | 'THREADED'
  | 'AT_SPEED'
  | 'SPEED_ZERO'
  | 'PASS_COMPLETE'
  | 'REVERSAL_COMPLETE'
  | 'SCHEDULE_COMPLETE'
  | 'INTERLOCK_LOST'
  | 'INTERLOCK_OK'
  | 'FAULT'

export type MachineEventType = MachineCommand | MachineSignal

export interface TransitionContext {
  /** MILL READY from the interlock chain (§13.2). */
  millReady: boolean
  /** Reason the interlock chain is blocking, if it is. */
  interlockReason: string | null
  /** Current mill speed, m/min. */
  speed: number
  /** True while the strip is threaded through the bite and both reels. */
  threaded: boolean
  /** True when the last scheduled pass has finished. */
  scheduleComplete: boolean
}

export interface TransitionResult {
  status: MachineStatus
  reason: string
  /** True when the status actually changed — used to emit an event (§11.4). */
  changed: boolean
}

/**
 * States from which a normal START is meaningful. FAST_STOP is deliberately
 * absent: a fast stop must be RESET before the mill will accept a start, which
 * is how the real mill behaves.
 */
const STARTABLE: ReadonlySet<MachineStatus> = new Set<MachineStatus>([
  'READY',
  'STOPPED',
  'IDLE',
])

/** States in which the mill is producing motion. */
export const MOVING_STATES: ReadonlySet<MachineStatus> = new Set<MachineStatus>([
  'THREADING',
  'ROLLING',
  'DECELERATING',
  'SKIN_PASS',
  'REWIND',
])

export function isMoving(status: MachineStatus): boolean {
  return MOVING_STATES.has(status)
}

/**
 * Whether the mill is allowed to develop rolling force. REVERSING holds the
 * strip but does not roll, so force must fall to the standstill value — a twin
 * that keeps showing rolling force through a reversal is showing a value the
 * mill is not producing.
 */
export function isRolling(status: MachineStatus): boolean {
  return status === 'ROLLING' || status === 'SKIN_PASS' || status === 'DECELERATING'
}

/**
 * The transition table.
 *
 * Structured as (event -> handler) rather than (state -> event -> state) because
 * several events (FAST_STOP, FAULT) are valid from ANY state and encoding them
 * per-state would invite a missed case.
 */
export function transition(
  current: MachineStatus,
  event: MachineEventType,
  ctx: TransitionContext,
): TransitionResult {
  const result = (status: MachineStatus, reason: string): TransitionResult => ({
    status,
    reason,
    changed: status !== current,
  })

  // ---- Events valid from ANY state -------------------------------------
  switch (event) {
    case 'FAST_STOP':
      // §9: ANY -> (E-stop / fast stop) -> FAST_STOP -> STOPPED
      return result('FAST_STOP', 'Fast stop initiated')
    case 'FAULT':
      return result('FAULT', ctx.interlockReason ?? 'Fault detected')
    case 'RESET':
      if (current === 'FAST_STOP' || current === 'FAULT' || current === 'STOPPED') {
        return ctx.millReady
          ? result('READY', 'Mill ready')
          : result('IDLE', ctx.interlockReason ?? 'Mill not ready')
      }
      return result(current, 'Reset ignored — mill is not in a resettable state')
    default:
      break
  }

  // ---- FAST_STOP is a terminal ramp: it ends at STOPPED, nothing else ----
  if (current === 'FAST_STOP') {
    if (event === 'SPEED_ZERO') return result('STOPPED', 'Fast stop complete — mill at standstill')
    return result(current, 'Fast stop in progress')
  }

  if (current === 'FAULT') {
    return result(current, ctx.interlockReason ?? 'Fault active — reset required')
  }

  // ---- Interlock chain ---------------------------------------------------
  if (event === 'INTERLOCK_LOST') {
    if (isMoving(current)) {
      return result('DECELERATING', ctx.interlockReason ?? 'Interlock lost while running')
    }
    return result('IDLE', ctx.interlockReason ?? 'Interlock lost')
  }

  if (event === 'INTERLOCK_OK') {
    if (current === 'IDLE') return result('READY', 'Mill ready')
    return result(current, 'Mill ready')
  }

  // ---- Normal operating events ------------------------------------------
  switch (event) {
    case 'ENABLE':
      if (current === 'IDLE') {
        return ctx.millReady
          ? result('READY', 'Mill ready')
          : result('IDLE', ctx.interlockReason ?? 'Mill not ready')
      }
      return result(current, 'Enable ignored')

    case 'START':
      if (!STARTABLE.has(current)) {
        return result(current, `Start ignored — mill is ${current}`)
      }
      if (!ctx.millReady) {
        return result(current, ctx.interlockReason ?? 'Mill not ready')
      }
      // A threaded mill goes straight to rolling; an unthreaded one threads first.
      return ctx.threaded
        ? result('ROLLING', 'Rolling')
        : result('THREADING', 'Threading strip to the bite')

    case 'THREADED':
      if (current === 'THREADING') return result('ROLLING', 'Rolling')
      return result(current, 'Threaded')

    case 'AT_SPEED':
      if (current === 'ROLLING') return result(current, 'Rolling at speed reference')
      return result(current, 'At speed')

    case 'STOP':
      if (isMoving(current)) return result('DECELERATING', 'Stop requested — decelerating')
      if (current === 'REVERSING') return result('DECELERATING', 'Stop requested during reversal')
      return result(current, 'Stop ignored — mill is already stopped')

    case 'PASS_COMPLETE':
      // §9: ROLLING -> DECELERATING -> STOPPED -> REVERSING -> ROLLING.
      // A pass ending does NOT flip direction on the spot; it starts a ramp.
      if (current === 'ROLLING' || current === 'SKIN_PASS') {
        return ctx.scheduleComplete
          ? result('DECELERATING', 'Final pass complete — decelerating')
          : result('DECELERATING', 'Pass complete — decelerating for reversal')
      }
      return result(current, 'Pass complete')

    case 'SPEED_ZERO':
      if (current === 'DECELERATING') {
        if (ctx.scheduleComplete) {
          return result('STOPPED', 'Schedule complete — coil finished')
        }
        return result('STOPPED', 'Mill at standstill')
      }
      return result(current, 'Mill at standstill')

    case 'REVERSAL_COMPLETE':
      if (current === 'REVERSING') return result('ROLLING', 'Rolling')
      return result(current, 'Reversal complete')

    case 'SCHEDULE_COMPLETE':
      return result('STOPPED', 'Schedule complete — coil finished')

    case 'REQUEST_ROLL_CHANGE':
      if (current === 'STOPPED' || current === 'IDLE' || current === 'READY') {
        return result('ROLL_CHANGE', 'Roll change in progress')
      }
      return result(current, 'Roll change ignored — mill must be stopped first')

    default:
      return result(current, 'No change')
  }
}

/**
 * Begin a reversal. Kept separate from `transition` because entering REVERSING
 * is a decision made by the reversing engine once the mill has genuinely reached
 * standstill — never on the pass-complete event itself.
 */
export function beginReversal(current: MachineStatus): TransitionResult {
  if (current !== 'STOPPED') {
    return { status: current, reason: 'Reversal requires standstill first', changed: false }
  }
  return { status: 'REVERSING', reason: 'Reversing — swapping entry / exit roles', changed: true }
}

/** Human-readable status text for the status banner (§11.4). */
export const STATUS_LABEL: Record<MachineStatus, string> = {
  IDLE: 'IDLE',
  READY: 'READY',
  THREADING: 'THREADING',
  ROLLING: 'ROLLING',
  DECELERATING: 'DECELERATING',
  REVERSING: 'REVERSING',
  STOPPED: 'STOPPED',
  FAST_STOP: 'FAST STOP',
  WARMUP: 'WARM UP',
  SKIN_PASS: 'SKIN PASS',
  REWIND: 'REWIND',
  ROLL_CHANGE: 'ROLL CHANGE',
  FAULT: 'FAULT',
}
