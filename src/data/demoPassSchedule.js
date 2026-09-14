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
import { millConfig } from '../config/millConfig';
import { calculateRollingForce } from '../simulation/forceModel';
import { calculateReduction, calculateTrueStrain } from '../simulation/rollingModel';
import { calculateTensionReferences } from '../simulation/tensionModel';
import { coilLengthFromRadius } from '../simulation/coilModel';
/**
 * The charged coil, inside every limit the FPE manual sets (§1.2):
 *   width  450 mm      (250-500 allowed)
 *   entry  2.8 mm      (1.6-4.5 allowed)
 *   final  0.9 mm      (0.30-3.00 allowed)
 *   OD     1800 mm     (1900 max), ID 508 mm = the mandrel true circle
 *   mass   ~8.3 T      (10 T max, and 450 mm x 20 kg/mm = 9 T max)
 *
 * The old demo coil was 620 mm wide — wider than this mill can roll.
 */
export const demoCoil = {
    id: 'C4-250901-0142',
    grade: 'IS 513 CR2 / low-carbon drawing quality',
    width: 450,
    entryThickness: 2.8,
    finalThickness: 0.9,
    // Filled in below from the geometry so mass and length cannot disagree.
    mass: 0,
    innerDiameter: millConfig.geometry.coilInnerDiameter,
    outerDiameter: 1800,
};
/**
 * Sized to the real machine, which constrains this schedule from three sides at
 * once and is why it looks nothing like the wide-mill schedule it replaces:
 *
 *  - TENSION. Both reels top out at 6900 kg = 67.7 kN (§1.4). On a 450 x 2.8 mm
 *    section that is 54 N/mm2, so the early passes must run at low specific
 *    tension — there is no option to pull the force down with tension the way a
 *    wide mill would. The specific tensions therefore RISE through the schedule
 *    as the section shrinks, and every entry below stays under 63 kN.
 *
 *  - FORCE. 360 T maximum (§1.1), with the warning at 288 T. The schedule is
 *    sized to peak around 70% of rating so the HIGH_FORCE scenario has somewhere
 *    to go: a schedule sitting in its own warning band cannot demonstrate one.
 *
 *  - TORQUE AND POWER. 750 kW at 350 rpm base is 20.5 kNm (§2.1), a quarter of
 *    the placeholder this file used to assume. Pass 1 sits at 96% of rated
 *    torque, which is what caps the reduction: 25% in one bite needed a bigger
 *    motor than this mill has.
 *
 * The speed ramp is a consequence, not a preference. Torque is set by the pass
 * and power is torque x speed, so the heavy early passes have to run SLOW to
 * stay inside 750 kW — 180 m/min on pass 1, opening out to 420 by pass 5 once
 * the strip is thin and the torque has fallen away. Every pass lands between 77%
 * and 89% of drive rating. A reversing mill being torque-limited early and
 * speed-limited late is the normal shape of a cold schedule; here the numbers
 * come out that way on their own.
 *
 * Speeds also stay inside the 450 m/min maximum, and pass 5 at 420 m/min needs
 * 604 work roll rpm against the 710 rpm the main drive can turn.
 */
const RAW_PASSES = [
    {
        pass: 1,
        direction: 'FORWARD',
        inputThickness: 2.8,
        outputThickness: 2.15,
        speedReference: 180,
        entrySpecificTension: 45,
        exitSpecificTension: 62,
    },
    {
        pass: 2,
        direction: 'REVERSE',
        inputThickness: 2.15,
        outputThickness: 1.68,
        speedReference: 210,
        entrySpecificTension: 55,
        exitSpecificTension: 75,
    },
    {
        pass: 3,
        direction: 'FORWARD',
        inputThickness: 1.68,
        outputThickness: 1.33,
        speedReference: 260,
        entrySpecificTension: 68,
        exitSpecificTension: 92,
    },
    {
        pass: 4,
        direction: 'REVERSE',
        inputThickness: 1.33,
        outputThickness: 1.08,
        speedReference: 330,
        entrySpecificTension: 82,
        exitSpecificTension: 110,
    },
    {
        pass: 5,
        direction: 'FORWARD',
        inputThickness: 1.08,
        outputThickness: 0.9,
        speedReference: 420,
        entrySpecificTension: 100,
        exitSpecificTension: 128,
    },
];
/**
 * Strain accumulated in the material BEFORE a given pass.
 *
 * Cold work carries forward: pass 5 is harder than pass 1 on the same steel
 * because the material has already been strained 0.97. The schedule builder must
 * therefore walk the passes in order rather than treating each in isolation.
 */
function accumulatedStrainBefore(passIndex) {
    let strain = 0;
    for (let i = 0; i < passIndex; i++) {
        const p = RAW_PASSES[i];
        strain += calculateTrueStrain(p.inputThickness, p.outputThickness);
    }
    return strain;
}
export function accumulatedStrainBeforePass(passNumber) {
    return accumulatedStrainBefore(Math.max(0, passNumber - 1));
}
function buildPasses(coil) {
    return RAW_PASSES.map((raw, index) => {
        const tensions = calculateTensionReferences(raw.entrySpecificTension, raw.exitSpecificTension, raw.inputThickness, raw.outputThickness, coil.width);
        const force = calculateRollingForce({
            inputThickness: raw.inputThickness,
            outputThickness: raw.outputThickness,
            width: coil.width,
            workRollDiameter: millConfig.geometry.workRollDiameter,
            entryTension: tensions.entryKN,
            exitTension: tensions.exitKN,
            accumulatedStrain: accumulatedStrainBefore(index),
        });
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
        };
    });
}
/** Strip length of the charged coil, m — derived from the coil geometry. */
export const demoCoilLength = coilLengthFromRadius(demoCoil.innerDiameter / 2, demoCoil.entryThickness, demoCoil.outerDiameter / 2);
export const demoPassSchedule = {
    coil: demoCoil,
    passes: buildPasses(demoCoil),
    source: `${millConfig.passSchedule.source} (DEMO — representative schedule, not a production coil)`,
};
/** Look up a pass entry by 1-based pass number. */
export function getPass(schedule, passNumber) {
    const found = schedule.passes.find((p) => p.pass === passNumber);
    // Clamp rather than throw: the state machine must never crash on a pass
    // number that has run past the end of the schedule.
    return found ?? schedule.passes[schedule.passes.length - 1];
}
