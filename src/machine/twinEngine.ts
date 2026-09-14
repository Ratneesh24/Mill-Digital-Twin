/**
 * TWIN ENGINE — the ONLY bridge from MachineState to the 3D scene (§10.3, §18).
 *
 * Every "value -> visual" binding in §10.3 is resolved here, once. Scene
 * components read the smoothed values this engine produces; none of them reads
 * MachineState directly and none of them computes its own version of a rate.
 * That is what makes the 3D scene and the KPI panel provably the same numbers.
 *
 * It also owns the two rules that keep the animation honest:
 *
 *   §10.4  Never `position = targetPosition`. Everything is damped with a
 *          frame-rate-independent half-life so a 20 Hz feed (or a 0.2 Hz
 *          historian replay) renders smoothly.
 *
 *   §14.5  Stale data stops the twin. Rotation angles stop integrating the
 *          moment the feed goes stale, so the mill visibly freezes instead of
 *          continuing to run on numbers nobody is sending any more.
 */

import { millConfig } from '../config/millConfig'
import { clamp, damp } from '../config/unitConversion'
import { engineeringConfig } from '../config/engineeringConfig'
import type { MachineState, RollingDirection } from '../types/machine'
import { directionSign, payoffReel, tensionReel } from './reversingEngine'
import { isMoving } from './machineStateMachine'

/** Instantaneous targets derived from MachineState. */
export interface TwinTargets {
  direction: RollingDirection
  directionSign: number
  /** Exit strip speed, m/min. */
  stripSpeed: number
  /** Entry strip speed from mass flow, m/min. */
  entryStripSpeed: number
  /** Work roll speed, rpm (magnitude; sign comes from directionSign). */
  wrRpm: number
  burRpm: number
  payoffRpm: number
  winderRpm: number
  /** Loaded roll gap, mm — the delivered thickness. */
  rollGap: number
  /** Delivered strip thickness, mm. */
  stripThickness: number
  /** Entry strip thickness, mm. */
  entryThickness: number
  /** Strip width, mm — sizes the strip and coil meshes. */
  stripWidth: number
  /** Roll force as a fraction of the mill's maximum, 0..1. */
  forceNormalised: number
  /** Entry / exit tension as a fraction of their configured maxima, 0..1. */
  entryTensionNormalised: number
  exitTensionNormalised: number
  /** Coil radii, mm. */
  dtrRadius: number
  etrRadius: number
  porRadius: number
  /**
   * Work roll bending as a fraction of a nominal maximum, or `null` when no
   * bending tag exists. `null` means DO NOT BEND THE ROLL (§7.4).
   */
  bendingNormalised: number | null
  /** True only when the mill is genuinely producing motion on fresh data. */
  animate: boolean
  stale: boolean
}

/** Smoothed values the scene actually renders. */
export interface TwinVisuals extends TwinTargets {
  /** Integrated rotation angle of the upper work roll, radians. */
  wrAngle: number
  burAngle: number
  dtrAngle: number
  etrAngle: number
  /** Distance the delivered strip has travelled, m — drives the surface markers. */
  stripTravel: number
  /**
   * Distance the ENTRY strip has travelled, m. Tracked separately because mass
   * flow makes the entry side run slower than the exit side by exactly the
   * reduction ratio — showing both at the same speed would contradict §8.1.
   */
  stripTravelEntry: number
}

const MAX_BENDING_KN = 600

function normaliseBending(bendingForce: number | null): number | null {
  if (bendingForce === null) return null
  return clamp(bendingForce / MAX_BENDING_KN, 0, 1)
}

export function deriveTargets(state: MachineState): TwinTargets {
  const sign = directionSign(state.rollingDirection)
  // Which reel is paying off comes from `reversingEngine`, the one place allowed
  // to decide it — never from a second copy of the direction test in here.
  const payoff =
    payoffReel(state.rollingDirection) === 'DTR' ? state.tension.dtr : state.tension.etr
  const winder =
    tensionReel(state.rollingDirection) === 'DTR' ? state.tension.dtr : state.tension.etr

  // The feed being stale, or the mill not being in a moving state, both stop
  // the animation. A stopped mill and a dead link look different in the banner
  // but identical in the scene: nothing moves.
  const stale = state.communication.stale || !state.communication.connected
  const animate = !stale && (isMoving(state.machineStatus) || state.machineStatus === 'FAST_STOP') && state.speed.actual > 0.01

  return {
    direction: state.rollingDirection,
    directionSign: sign,
    stripSpeed: state.speed.actual,
    // Entry speed is a state field (mass-flow derived in the engine), not a
    // recomputation here.
    entryStripSpeed:
      state.thickness.entry > 0
        ? (state.speed.actual * state.thickness.actual) / state.thickness.entry
        : state.speed.actual,
    wrRpm: Math.abs(state.rolls.upperWork.rpm),
    burRpm: Math.abs(state.rolls.upperBackup.rpm),
    payoffRpm: Math.abs(payoff.rpm),
    winderRpm: Math.abs(winder.rpm),
    rollGap: state.rollGap.actual,
    stripThickness: state.thickness.actual,
    entryThickness: state.thickness.entry,
    stripWidth: state.coil.width,
    forceNormalised: clamp(state.rollingForce.actual / millConfig.ratings.maxRollingForce, 0, 1),
    entryTensionNormalised: clamp(
      state.tension.entry / engineeringConfig.tensionLimits.entryMax,
      0,
      1,
    ),
    exitTensionNormalised: clamp(state.tension.exit / engineeringConfig.tensionLimits.exitMax, 0, 1),
    dtrRadius: state.tension.dtr.diameter / 2,
    etrRadius: state.tension.etr.diameter / 2,
    porRadius: state.tension.por.diameter / 2,
    bendingNormalised: normaliseBending(state.rolls.upperWork.bendingForce),
    animate,
    stale,
  }
}

/**
 * Holds the smoothed scene values. A single mutable instance is shared by every
 * scene component, mutated inside `useFrame`, and never placed in React state —
 * that is the §15 requirement that a KPI change must not re-render the 3D scene.
 */
export class TwinEngine {
  private targets: TwinTargets
  private lastElapsed = 0
  readonly visuals: TwinVisuals

  constructor(initial: MachineState) {
    this.targets = deriveTargets(initial)
    this.visuals = {
      ...this.targets,
      wrAngle: 0,
      burAngle: 0,
      dtrAngle: 0,
      etrAngle: 0,
      stripTravel: 0,
      stripTravelEntry: 0,
    }
  }

  /** Called on every store update — cheap, just swaps the target set. */
  setState(state: MachineState): void {
    this.targets = deriveTargets(state)
  }

  getTargets(): TwinTargets {
    return this.targets
  }

  /**
   * Advance at most once per rendered frame, whoever calls first.
   *
   * Scene components all call this at the top of their own `useFrame`, so the
   * smoothing is guaranteed to have run before anyone reads `visuals` — without
   * depending on R3F's callback ordering, which is an implementation detail.
   */
  advanceOnce(elapsed: number): TwinVisuals {
    if (elapsed === this.lastElapsed) return this.visuals
    // Clamp dt: a backgrounded tab can hand back a multi-second delta, which
    // would teleport every damped value on the first frame after focus.
    const dt = this.lastElapsed === 0 ? 1 / 60 : Math.min(elapsed - this.lastElapsed, 0.1)
    this.lastElapsed = elapsed
    return this.advance(dt)
  }

  /**
   * Advance the smoothed values by `dt` seconds. Prefer `advanceOnce` from
   * scene code; this is the raw step, exposed for the validation harness.
   */
  advance(dt: number): TwinVisuals {
    const t = this.targets
    const v = this.visuals
    const hl = millConfig.visual.dampingHalfLife

    // Discrete/enum values switch immediately; only continuous ones are damped.
    v.direction = t.direction
    v.animate = t.animate
    v.stale = t.stale
    v.bendingNormalised = t.bendingNormalised

    v.directionSign = damp(v.directionSign, t.directionSign, hl, dt)
    v.stripSpeed = damp(v.stripSpeed, t.stripSpeed, hl, dt)
    v.entryStripSpeed = damp(v.entryStripSpeed, t.entryStripSpeed, hl, dt)
    v.wrRpm = damp(v.wrRpm, t.wrRpm, hl, dt)
    v.burRpm = damp(v.burRpm, t.burRpm, hl, dt)
    v.payoffRpm = damp(v.payoffRpm, t.payoffRpm, hl, dt)
    v.winderRpm = damp(v.winderRpm, t.winderRpm, hl, dt)
    v.rollGap = damp(v.rollGap, t.rollGap, hl, dt)
    v.stripThickness = damp(v.stripThickness, t.stripThickness, hl, dt)
    v.entryThickness = damp(v.entryThickness, t.entryThickness, hl, dt)
    v.stripWidth = damp(v.stripWidth, t.stripWidth, hl * 4, dt)
    v.forceNormalised = damp(v.forceNormalised, t.forceNormalised, hl, dt)
    v.entryTensionNormalised = damp(v.entryTensionNormalised, t.entryTensionNormalised, hl, dt)
    v.exitTensionNormalised = damp(v.exitTensionNormalised, t.exitTensionNormalised, hl, dt)
    // Coil diameters change slowly; a longer half-life keeps them from jittering
    // on a coarse historian feed.
    v.dtrRadius = damp(v.dtrRadius, t.dtrRadius, hl * 4, dt)
    v.etrRadius = damp(v.etrRadius, t.etrRadius, hl * 4, dt)
    v.porRadius = damp(v.porRadius, t.porRadius, hl * 4, dt)

    // Rotation is integrated from the SMOOTHED rpm, so a step change in the
    // feed produces a smooth spin-up rather than a jump.
    if (t.animate) {
      const s = v.directionSign
      const radiansPerRpmSecond = (2 * Math.PI) / 60
      v.wrAngle += v.wrRpm * radiansPerRpmSecond * dt * s
      v.burAngle += v.burRpm * radiansPerRpmSecond * dt * s
      // Both reels turn the same way in space — two pulleys with the strip
      // between them. What differs is their rate, because the payoff reel runs
      // at the entry speed on a shrinking coil and the winder at the exit speed
      // on a growing one. Which reel is which comes from the direction-derived
      // role, never from their position.
      const spinning = payoffReel(t.direction)
      v.dtrAngle += (spinning === 'DTR' ? v.payoffRpm : v.winderRpm) *
        radiansPerRpmSecond * dt * s
      v.etrAngle += (spinning === 'ETR' ? v.payoffRpm : v.winderRpm) *
        radiansPerRpmSecond * dt * s
      v.stripTravel += (v.stripSpeed / 60) * dt * s
      v.stripTravelEntry += (v.entryStripSpeed / 60) * dt * s
    }

    return v
  }
}
