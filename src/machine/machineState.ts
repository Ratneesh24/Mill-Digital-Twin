/**
 * MACHINE STATE HELPERS.
 *
 * Read-only derivations of LOGICAL ROLES from MachineState. Their whole reason
 * for existing is §1: "Entry/exit are logical roles derived from direction,
 * never hardcoded to left/right." Every component that needs to know which reel
 * is the entry reel, or which gauge is the exit gauge, asks here — so a
 * direction change flips all of them together, or none of them.
 */

import type { GaugeState, MachineState, ReelState, RollingDirection } from '../types/machine'
import { payoffReel, tensionReel } from './reversingEngine'

export { emptyMachineState } from '../communication/dataAdapter'

/** The reel currently paying strip INTO the mill. */
export function entryReel(state: MachineState): ReelState {
  return payoffReel(state.rollingDirection) === 'DTR' ? state.tension.dtr : state.tension.etr
}

/** The reel currently taking strip OUT of the mill. */
export function exitReel(state: MachineState): ReelState {
  return tensionReel(state.rollingDirection) === 'DTR' ? state.tension.dtr : state.tension.etr
}

/** The X-ray gauge measuring the INCOMING strip. */
export function entryGauge(state: MachineState): GaugeState {
  return state.rollingDirection === 'FORWARD' ? state.gauges.dtr : state.gauges.etr
}

/** The X-ray gauge measuring the DELIVERED strip — the one AGC listens to. */
export function exitGauge(state: MachineState): GaugeState {
  return state.rollingDirection === 'FORWARD' ? state.gauges.etr : state.gauges.dtr
}

/** Physical identity of the entry-side reel, for labelling. */
export function entryReelId(direction: RollingDirection): 'DTR' | 'ETR' {
  return payoffReel(direction)
}

export function exitReelId(direction: RollingDirection): 'DTR' | 'ETR' {
  return tensionReel(direction)
}

/** Direction arrow glyph used in the header and the scene (§11.4). */
export function directionGlyph(direction: RollingDirection): string {
  return direction === 'FORWARD' ? 'FORWARD →' : '← REVERSE'
}

/** True when the mill is charged with strip through the bite. */
export function isThreaded(state: MachineState): boolean {
  return state.tension.entry > 0 || state.tension.exit > 0
}

/**
 * Whether the twin is showing anything that could be mistaken for live plant
 * data. Drives the persistent mode banner — an operator must never have to
 * infer this from context.
 */
export function isSimulated(state: MachineState): boolean {
  return state.operatingMode !== 'LIVE'
}
