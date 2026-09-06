/**
 * STRIP TENSION MODEL — §8 of the master spec.
 *
 * Entry (back) and exit (front) tension are the two levers that, together with
 * the roll gap, set the rolling force. They are LOGICAL roles: which physical
 * reel supplies which tension is decided by the rolling direction, never by a
 * hardcoded side (§1).
 *
 * The tension reference comes from the pass schedule as a SPECIFIC tension
 * (N/mm²), because that is the quantity that stays meaningful as the strip gets
 * thinner. The tension FORCE that the reel must pull is derived from it.
 */

import { engineeringConfig } from '../config/engineeringConfig'
import { tensionForceFromSpecific } from './rollingModel'

export interface TensionReferences {
  /** Entry tension force reference, kN. */
  entryKN: number
  /** Exit tension force reference, kN. */
  exitKN: number
  /** Entry specific tension, N/mm². */
  entrySpecific: number
  /** Exit specific tension, N/mm². */
  exitSpecific: number
}

/**
 * Tension force references for a pass.
 *
 *   T_entry = σ_entry · h_entry · w        (kN)
 *   T_exit  = σ_exit  · h_exit  · w        (kN)
 *
 * Entry tension acts on the INCOMING thickness and exit tension on the
 * DELIVERED thickness — using the same thickness for both is a common modelling
 * error that makes the tension torque split wrong.
 *
 * References are clamped to the configured envelope so a badly formed pass
 * schedule cannot drive the force model into nonsense.
 */
export function calculateTensionReferences(
  entrySpecificTension: number,
  exitSpecificTension: number,
  inputThickness: number,
  outputThickness: number,
  width: number,
): TensionReferences {
  const { tensionLimits } = engineeringConfig

  const entryRaw = tensionForceFromSpecific(entrySpecificTension, inputThickness, width)
  const exitRaw = tensionForceFromSpecific(exitSpecificTension, outputThickness, width)

  return {
    entryKN: clampRange(entryRaw, tensionLimits.entryMin, tensionLimits.entryMax),
    exitKN: clampRange(exitRaw, tensionLimits.exitMin, tensionLimits.exitMax),
    entrySpecific: entrySpecificTension,
    exitSpecific: exitSpecificTension,
  }
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * First-order tension loop response.
 *
 *   dT/dt = (T_ref − T) / τ
 *
 * Discretised exactly (not by Euler) so the response is identical at any tick
 * rate:  T ← T_ref + (T − T_ref)·e^(−dt/τ)
 *
 * Tension therefore lags a setpoint change instead of snapping to it, which is
 * what makes the force reading move the way it does on a real tension step.
 *
 * LIMITATION: a single time constant stands in for the reel drive's speed/
 * current cascade and the strip's elastic storage between reel and bite.
 */
export function stepTension(current: number, reference: number, dt: number): number {
  const tau = engineeringConfig.tensionTimeConstant
  if (tau <= 0 || dt <= 0) return reference
  return reference + (current - reference) * Math.exp(-dt / tau)
}

/**
 * Tension is only real while the strip is moving and threaded. A stopped mill
 * holds a residual "hold" tension from the reel brakes/drives, not the full
 * rolling reference — showing full tension on a stopped mill is one of the
 * classic twin inconsistencies (§18).
 */
export function tensionReferenceForState(
  fullReferenceKN: number,
  speedMpm: number,
  threaded: boolean,
): number {
  if (!threaded) return 0
  const threading = engineeringConfig.speedLimits.threadingSpeed
  if (speedMpm <= 0.01) {
    // Reels hold the strip taut at a reduced standstill tension.
    return fullReferenceKN * 0.25
  }
  if (speedMpm < threading) {
    // Ramp in over the threading band.
    const k = 0.25 + 0.75 * (speedMpm / threading)
    return fullReferenceKN * k
  }
  return fullReferenceKN
}
