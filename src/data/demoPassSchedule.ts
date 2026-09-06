/**
 * DEMO PASS SCHEDULE.
 *
 * Stands in for the ABP / plant pass-schedule system (§2) until the twin is
 * bound to the real MMS setup tags. It is a REPRESENTATIVE narrow-complex
 * schedule, not a production schedule for any specific coil — flagged as such
 * in the UI and in docs/ASSUMPTIONS.md.
 *
 * `predictedForce` is NOT hand-entered. It is computed by the same force model
 * that drives the live value, so the REF and the actual reading agree in steady
 * state and any divergence the operator sees is real (AGC working, tension lag)
 * rather than an artefact of two different numbers.
 */

import { millConfig } from '../config/millConfig'
import { calculateRollingForce } from '../simulation/forceModel'
import { calculateReduction, calculateTrueStrain } from '../simulation/rollingModel'
import { calculateTensionReferences } from '../simulation/tensionModel'
import type { CoilData, PassSchedule, PassScheduleEntry } from '../types/coil'
import { coilLengthFromRadius } from '../simulation/coilModel'

export const demoCoil: CoilData = {
  id: 'C4-250901-0142',
  grade: 'IS 513 CR2 / low-carbon drawing quality',
  width: 620,
  entryThickness: 2.8,
  finalThickness: 0.9,
  // Filled in below from the geometry so mass and length cannot disagree.
  mass: 0,
  innerDiameter: millConfig.geometry.mandrelDiameter,
  outerDiameter: 1550,
}

/** Raw schedule: the numbers a planner would enter. Forces are derived. */
interface RawPass {
  pass: number
  direction: 'FORWARD' | 'REVERSE'
  inputThickness: number
  outputThickness: number
  speedReference: number
  entrySpecificTension: number
  exitSpecificTension: number
}

const RAW_PASSES: RawPass[] = [
  {
    pass: 1,
    direction: 'FORWARD',
    inputThickness: 2.8,
    outputThickness: 2.11,
    speedReference: 250,
    entrySpecificTension: 55,
    exitSpecificTension: 90,
  },
  {
    pass: 2,
    direction: 'REVERSE',
    inputThickness: 2.11,
    outputThickness: 1.63,
    speedReference: 300,
    entrySpecificTension: 65,
    exitSpecificTension: 95,
  },
  {
    pass: 3,
    direction: 'FORWARD',
    inputThickness: 1.63,
    outputThickness: 1.32,
    speedReference: 340,
    entrySpecificTension: 75,
    exitSpecificTension: 100,
  },
  {
    pass: 4,
    direction: 'REVERSE',
    inputThickness: 1.32,
    outputThickness: 1.08,
    speedReference: 380,
    entrySpecificTension: 85,
    exitSpecificTension: 110,
  },
  {
    pass: 5,
    direction: 'FORWARD',
    inputThickness: 1.08,
    outputThickness: 0.9,
    speedReference: 420,
    entrySpecificTension: 100,
    exitSpecificTension: 125,
  },
]

/**
 * Strain accumulated in the material BEFORE a given pass.
 *
 * Cold work carries forward: pass 5 is harder than pass 1 on the same steel
 * because the material has already been strained 0.97. The schedule builder must
 * therefore walk the passes in order rather than treating each in isolation.
 */
function accumulatedStrainBefore(passIndex: number): number {
  let strain = 0
  for (let i = 0; i < passIndex; i++) {
    const p = RAW_PASSES[i]
    strain += calculateTrueStrain(p.inputThickness, p.outputThickness)
  }
  return strain
}

export function accumulatedStrainBeforePass(passNumber: number): number {
  return accumulatedStrainBefore(Math.max(0, passNumber - 1))
}

function buildPasses(coil: CoilData): PassScheduleEntry[] {
  return RAW_PASSES.map((raw, index) => {
    const tensions = calculateTensionReferences(
      raw.entrySpecificTension,
      raw.exitSpecificTension,
      raw.inputThickness,
      raw.outputThickness,
      coil.width,
    )

    const force = calculateRollingForce({
      inputThickness: raw.inputThickness,
      outputThickness: raw.outputThickness,
      width: coil.width,
      workRollDiameter: millConfig.geometry.workRollDiameter,
      entryTension: tensions.entryKN,
      exitTension: tensions.exitKN,
      accumulatedStrain: accumulatedStrainBefore(index),
    })

    return {
      pass: raw.pass,
      direction: raw.direction,
      inputThickness: raw.inputThickness,
      outputThickness: raw.outputThickness,
      reduction: calculateReduction(raw.inputThickness, raw.outputThickness),
      speedReference: raw.speedReference,
      entrySpecificTension: raw.entrySpecificTension,
      exitSpecificTension: raw.exitSpecificTension,
      predictedForce: force.forceTonnes,
    }
  })
}

/** Strip length of the charged coil, m — derived from the coil geometry. */
export const demoCoilLength = coilLengthFromRadius(
  demoCoil.innerDiameter / 2,
  demoCoil.entryThickness,
  demoCoil.outerDiameter / 2,
)

export const demoPassSchedule: PassSchedule = {
  coil: demoCoil,
  passes: buildPasses(demoCoil),
  source: `${millConfig.passSchedule.source} (DEMO — representative schedule, not a production coil)`,
}

/** Look up a pass entry by 1-based pass number. */
export function getPass(schedule: PassSchedule, passNumber: number): PassScheduleEntry {
  const found = schedule.passes.find((p) => p.pass === passNumber)
  // Clamp rather than throw: the state machine must never crash on a pass
  // number that has run past the end of the schedule.
  return found ?? schedule.passes[schedule.passes.length - 1]
}
