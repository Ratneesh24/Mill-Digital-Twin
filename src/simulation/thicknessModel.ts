/**
 * THICKNESS / GAUGEMETER MODEL — §8.1 of the master spec.
 *
 * The gaugemeter equation is the ANCHOR of the whole simulation (§19.8):
 *
 *     h = S0 + F / M
 *
 * where S0 is the unloaded roll gap position (what HAGC actually commands),
 * F is the roll separating force and M is the mill modulus. It says the stand
 * is a spring: press harder and the housing, chocks and rolls stretch, so the
 * delivered strip is thicker than the gap you set.
 *
 * Because F itself depends on h, the pair (h, F) is COUPLED and must be solved
 * simultaneously. This module owns that solve. Nothing else in the codebase is
 * allowed to compute a delivered thickness — that is what keeps the twin's
 * "one authoritative value" rule (§4) true for thickness.
 */

import { engineeringConfig, SeededRandom } from '../config/engineeringConfig'
import { calculateRollingForce, type RollingForceResult } from './forceModel'

export interface GaugemeterSolveInput {
  /** Unloaded roll gap position S0, mm. */
  gapPosition: number
  /** Entry thickness, mm. */
  inputThickness: number
  width: number
  workRollDiameter: number
  entryTension: number
  exitTension: number
  accumulatedStrain: number
  /** Multiplier on the mean flow stress — see RollingForceInput. */
  flowStressScale?: number
}

export interface GaugemeterSolveResult {
  /** Delivered (loaded) thickness, mm. */
  outputThickness: number
  force: RollingForceResult
  /** Mill stretch F/M, mm. */
  millStretch: number
  iterations: number
  /** Final |h - (S0 + F/M)| residual, µm — should be < 0.01. */
  residualUm: number
  /** True when the strip never entered plastic reduction (gap ≥ entry thickness). */
  noBite: boolean
}

/**
 * Solve the coupled gaugemeter / force problem.
 *
 *   h_{k+1} = S0 + F(h_k) / M
 *
 * under-relaxed by `solver.relaxation` for stability. This is the same
 * fixed-point relationship the real stand obeys mechanically; solving it (rather
 * than picking h and back-calculating F, or vice versa) is what makes force,
 * gap and thickness mutually consistent instead of three independent numbers.
 *
 * LIMITATION: M is treated as a constant. On a real mill the modulus is mildly
 * force- and width-dependent, and the "mill spring curve" is measured, not
 * assumed. Replacing the constant with a curve is a change to this function
 * only.
 */
export function solveGaugemeter(input: GaugemeterSolveInput): GaugemeterSolveResult {
  const { gapPosition: S0, inputThickness: h0, width, workRollDiameter } = input
  const { millModulus: M, solver } = engineeringConfig

  // Force is in tonnes and M is in t/mm, so F/M lands in mm directly.
  const emptyForce = calculateRollingForce({
    inputThickness: h0,
    outputThickness: h0,
    width,
    workRollDiameter,
    entryTension: input.entryTension,
    exitTension: input.exitTension,
    accumulatedStrain: input.accumulatedStrain,
    flowStressScale: input.flowStressScale,
  })

  // Gap wider than the incoming strip: the rolls never touch it. No reduction,
  // no force, delivered thickness = entry thickness.
  if (S0 >= h0) {
    return {
      outputThickness: h0,
      force: emptyForce,
      millStretch: 0,
      iterations: 0,
      residualUm: 0,
      noBite: true,
    }
  }

  // Seed between the commanded gap and the entry thickness.
  let h = Math.min(h0, Math.max(S0, S0 + (h0 - S0) * 0.25))
  let force = emptyForce
  let iterations = 0

  for (let i = 0; i < solver.maxIterations; i++) {
    iterations = i + 1
    force = calculateRollingForce({
      inputThickness: h0,
      outputThickness: h,
      width,
      workRollDiameter,
      entryTension: input.entryTension,
      exitTension: input.exitTension,
      accumulatedStrain: input.accumulatedStrain,
      flowStressScale: input.flowStressScale,
    })

    const stretch = force.forceTonnes / M
    // The stand cannot deliver thicker than it is fed, nor thinner than the
    // commanded gap: clamp the iterate into the physically reachable band.
    const next = Math.min(h0, Math.max(S0, S0 + stretch))
    const updated = h + (next - h) * solver.relaxation

    if (Math.abs(updated - h) < solver.toleranceMm) {
      h = updated
      break
    }
    h = updated
  }

  const millStretch = force.forceTonnes / M
  const residualUm = Math.abs(h - (S0 + millStretch)) * 1000

  return { outputThickness: h, force, millStretch, iterations, residualUm, noBite: false }
}

/**
 * INVERSE GAUGEMETER — unloaded gap position from measured thickness and force.
 *
 *   S0 = h - F / M
 *
 * Used in the 46-tag CRM04 profile (§7.4) where no LVDT position tag exists but
 * an X-ray thickness gauge does. The result is badged CALCULATED, never
 * MEASURED.
 */
export function inverseGaugemeter(deliveredThicknessMm: number, forceTonnes: number): number {
  return deliveredThicknessMm - forceTonnes / engineeringConfig.millModulus
}

/**
 * Roll gap position S0 required to deliver a target thickness.
 *
 *   S0 = h_target - F / M
 *
 * Solved by iterating the forward problem, because the force that produces the
 * stretch depends on the thickness you are trying to hit. This is what the AGC
 * position pre-set does before a pass starts, and what `simulationEngine` uses
 * to preposition the capsule at pass change.
 */
export function gapPositionForTargetThickness(
  targetThickness: number,
  inputThickness: number,
  width: number,
  workRollDiameter: number,
  entryTension: number,
  exitTension: number,
  accumulatedStrain: number,
): number {
  const force = calculateRollingForce({
    inputThickness,
    outputThickness: targetThickness,
    width,
    workRollDiameter,
    entryTension,
    exitTension,
    accumulatedStrain,
  })
  return targetThickness - force.forceTonnes / engineeringConfig.millModulus
}

/**
 * X-ray gauge signal from the true delivered thickness.
 *
 * Noise is added HERE and only here — at the instrument, exactly where a real
 * measurement chain adds it. No process value that other values depend on ever
 * receives noise (§19.2), so the physics stays deterministic while the displayed
 * gauge trace looks like a real gauge trace.
 *
 * LIMITATION: white Gaussian noise only. Real X-ray gauges also show drift,
 * standardisation steps, and aliasing against strip flutter.
 */
export function applyGaugeNoise(trueThicknessMm: number, rng: SeededRandom): number {
  const sigmaMm = engineeringConfig.gaugeNoise.sigma / 1000
  return trueThicknessMm + rng.normal() * sigmaMm
}

/**
 * HAGC thickness controller — PI on thickness error, output is the unloaded gap
 * position S0.
 *
 *   e     = h_measured - h_reference        [mm]
 *   S0    ← S0 - (Kp·e + Ki·∫e dt)
 *
 * Deliberately a "gaugemeter-style" correction: to make the strip thinner the
 * loop closes the gap. Slew-rate limited to the servo capsule's capability.
 *
 * LIMITATION: the real HAGC is a cascaded position/pressure loop running at
 * 100 Hz+ with mass-flow (MFC), feed-forward (THFF) and feedback (THFB) trims
 * and a separate tilt loop. This is a single PI on delivered thickness and
 * should be read as "AGC is closing the loop", not as the mill's control law.
 */
export interface HagcState {
  integral: number
}

export function hagcStep(
  state: HagcState,
  gapPosition: number,
  measuredThickness: number,
  referenceThickness: number,
  dt: number,
  enabled: boolean,
): { gapPosition: number; state: HagcState } {
  if (!enabled || dt <= 0) return { gapPosition, state }

  const { hagcGainP, hagcGainI, hagcSlewRate } = engineeringConfig
  const error = measuredThickness - referenceThickness

  // Anti-windup: clamp the integrator to ±0.5 mm of authority.
  const integral = Math.max(-0.5, Math.min(0.5, state.integral + error * dt))
  const correction = hagcGainP * error + hagcGainI * integral

  const maxStep = hagcSlewRate * dt
  const step = Math.max(-maxStep, Math.min(maxStep, -correction))

  return { gapPosition: gapPosition + step, state: { integral } }
}
