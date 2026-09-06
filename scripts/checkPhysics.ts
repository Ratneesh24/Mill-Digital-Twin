/* Quick numeric sanity check of the pass schedule and force model. */
import {
  accumulatedStrainBeforePass,
  demoCoil,
  demoCoilLength,
  demoPassSchedule,
} from '../src/data/demoPassSchedule'
import { coilMass } from '../src/simulation/coilModel'

console.log('coil length (m):', demoCoilLength.toFixed(1))
console.log(
  'coil mass (t):',
  coilMass(demoCoil.innerDiameter / 2, demoCoil.outerDiameter / 2, demoCoil.width).toFixed(2),
)
for (const p of demoPassSchedule.passes) {
  console.log(
    `pass ${p.pass} ${p.direction.padEnd(7)} ${p.inputThickness.toFixed(3)} -> ${p.outputThickness.toFixed(3)}  red ${p.reduction.toFixed(2)}%  F ${p.predictedForce.toFixed(1)} t  eps0 ${accumulatedStrainBeforePass(p.pass).toFixed(3)}  v ${p.speedReference}`,
  )
}
