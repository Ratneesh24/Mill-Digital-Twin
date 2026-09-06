/**
 * ROLL SEPARATING FORCE MODEL — §8.2 of the master spec.
 *
 * MODEL CLASS: mean-pressure (Bland–Ford / Hill form) with Hitchcock roll
 * flattening. This is a SIMPLIFIED ENGINEERING RELATION, not the mill's
 * technology model (§19.6). It exists to make the twin internally consistent,
 * and it is written so it can be replaced wholesale without touching a single
 * component:
 *
 *     calculateRollingForce(input) -> RollingForceResult
 *
 * Required behaviour (§8.2): force rises with reduction, width, material
 * resistance and contact length; falls with increasing tension.
 */

import { engineeringConfig } from '../config/engineeringConfig'
import { newtonsToTonnes } from '../config/unitConversion'
import {
  calculateContactLength,
  calculateFlattenedRadius,
  calculateMeanFlowStress,
  specificTension,
} from './rollingModel'

export interface RollingForceInput {
  inputThickness: number
  outputThickness: number
  /** Strip width, mm. */
  width: number
  /** Nominal work roll diameter, mm. */
  workRollDiameter: number
  /** Entry (back) tension force, kN. */
  entryTension: number
  /** Exit (front) tension force, kN. */
  exitTension: number
  /** Strain already carried by the material from previous passes. */
  accumulatedStrain: number
  /**
   * Multiplier on the mean flow stress, default 1. This is the "harder or
   * softer material" lever — a different grade, a colder strip, a coil that has
   * work-hardened more than the schedule assumed. It scales the material's
   * resistance, which is the physically meaningful input; it does not scale the
   * force directly.
   */
  flowStressScale?: number
}

export interface RollingForceResult {
  /** Total roll separating force, t. */
  forceTonnes: number
  /** Total roll separating force, kN. */
  forceKN: number
  /** Projected contact length, mm. */
  contactLength: number
  /** Hitchcock flattened radius, mm. */
  flattenedRadius: number
  /** Mean flow stress used, MPa. */
  meanFlowStress: number
  /** Mean roll pressure, MPa. */
  meanPressure: number
  /** Friction-hill / inhomogeneity multiplier Q, dimensionless. */
  frictionMultiplier: number
  /** Mean applied tension stress, MPa. */
  meanTensionStress: number
}

const ZERO_RESULT: RollingForceResult = {
  forceTonnes: 0,
  forceKN: 0,
  contactLength: 0,
  flattenedRadius: 0,
  meanFlowStress: 0,
  meanPressure: 0,
  frictionMultiplier: 1,
  meanTensionStress: 0,
}

/**
 * Roll separating force.
 *
 * Equations, in order of evaluation:
 *
 *   Δh   = h0 - h1                                    draft, mm
 *   ε    = ln(h0/h1)                                  true strain
 *   kf   = kf0(1 + Cε)^n integrated over the pass     mean flow stress, MPa
 *   k    = 1.155 · kf                                 plane-strain resistance, MPa
 *   σm   = (σ_entry + σ_exit)/2                       mean tension stress, MPa
 *   R'   = Hitchcock(R, F/w, Δh)                      flattened radius, mm
 *   L    = √(R'·Δh)                                   contact length, mm
 *   hm   = (h0 + h1)/2                                mean thickness, mm
 *   Q    = 1 + µ·L/(2·hm)                             friction-hill multiplier
 *   p    = (k - σm) · Q                               mean roll pressure, MPa
 *   F    = p · L · w                                  separating force, N
 *
 * R' depends on F and F depends on R', so the pair is solved by fixed-point
 * iteration (3 passes is ample — it converges geometrically).
 *
 * The tension term enters as `(k - σm)`: applied tension does part of the work
 * of deformation, so the rolls have to supply less. This is the mechanism behind
 * the §8.6 coupling "tension ↑ → force ↓", and it is why the tension references
 * in the pass schedule matter to the force reading.
 *
 * LIMITATIONS
 *  - Mean-pressure form: no explicit friction-hill integration, so the neutral
 *    point is not located and the pressure distribution is not resolved.
 *  - No thermal softening, no roll/strip temperature.
 *  - No roll crown, bending or flatness effects — force is treated as uniform
 *    across the barrel, which is why OS/DS split is a Phase 2 item (§16).
 *  - Elastic entry/exit zones are neglected.
 */
export function calculateRollingForce(input: RollingForceInput): RollingForceResult {
  const {
    inputThickness: h0,
    outputThickness: h1,
    width: w,
    workRollDiameter,
    entryTension,
    exitTension,
    accumulatedStrain,
    flowStressScale = 1,
  } = input

  const draft = h0 - h1
  if (draft <= 1e-6 || w <= 0 || h1 <= 0) return ZERO_RESULT

  const nominalRadius = workRollDiameter / 2
  const meanFlowStress = calculateMeanFlowStress(h0, h1, accumulatedStrain) * flowStressScale
  const planeStrainResistance = engineeringConfig.planeStrainFactor * meanFlowStress

  const entryStress = specificTension(entryTension, h0, w)
  const exitStress = specificTension(exitTension, h1, w)
  const meanTensionStress = (entryStress + exitStress) / 2

  const meanThickness = (h0 + h1) / 2
  const mu = engineeringConfig.frictionFactor

  // Fixed-point iteration on (F, R'). Seed with the unflattened radius and stop
  // once the flattened radius settles — on thin strip R' can approach 2x nominal
  // and a fixed 3-pass loop stops well short of the true force.
  let flattenedRadius = nominalRadius
  let contactLength = calculateContactLength(flattenedRadius, draft)
  let forceN = 0
  let frictionMultiplier = 1
  let meanPressure = 0

  for (let i = 0; i < engineeringConfig.hitchcockIterations; i++) {
    contactLength = calculateContactLength(flattenedRadius, draft)
    frictionMultiplier = 1 + (mu * contactLength) / (2 * meanThickness)
    // Tension can never drive the required pressure below zero — floor it.
    meanPressure = Math.max((planeStrainResistance - meanTensionStress) * frictionMultiplier, 0)
    forceN = meanPressure * contactLength * w

    const nextRadius = calculateFlattenedRadius(nominalRadius, forceN / w, draft)
    const converged = Math.abs(nextRadius - flattenedRadius) < engineeringConfig.hitchcockToleranceMm
    flattenedRadius = nextRadius
    if (converged) break
  }

  return {
    forceTonnes: newtonsToTonnes(forceN),
    forceKN: forceN / 1000,
    contactLength,
    flattenedRadius,
    meanFlowStress,
    meanPressure,
    frictionMultiplier,
    meanTensionStress,
  }
}

/**
 * INVERSE MODEL — estimate roll separating force from main-drive torque.
 *
 * Used ONLY in the 46-tag CRM04 feed profile (§7.4), where roll separating force
 * is not instrumented but `MILL_ACT_TRQ` is. Rearranging the torque relation
 * (see driveModel.ts):
 *
 *   G_roll = 2 · F · a  with  a = λ·L
 *   →  F = G_roll / (2 · λ · L)
 *
 * The result is badged ESTIMATED, never MEASURED, and it is the reason the
 * §7.4 table says "Render ESTIMATED from torque + reduction model".
 *
 * LIMITATION: any error in λ, in the tension-torque split, or in the assumed
 * contact length propagates directly into the force estimate. Treat as an
 * indication of trend, not as a calibrated force reading.
 */
export function estimateForceFromTorque(
  rollTorqueKNm: number,
  contactLengthMm: number,
): number {
  const leverArmMm = engineeringConfig.leverArmRatio * contactLengthMm
  if (leverArmMm <= 1e-6) return 0
  // G[kNm] = 2·F[kN]·a[m]  ->  F[kN] = G / (2·a)
  const forceKN = (rollTorqueKNm * 1000) / (2 * leverArmMm)
  return newtonsToTonnes(forceKN * 1000)
}
