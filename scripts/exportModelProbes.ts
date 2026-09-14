/**
 * MODEL PROBE FIXTURES — every pure physics function, swept and captured.
 *
 * The engine parity gate (exportSimTrace.ts) runs the whole simulation and compares trajectories.
 * That is the right end-to-end test and it is a terrible diagnostic: when it fails it says "tick
 * 412 of an 18,000-tick run disagrees", and the cause is one multiplication somewhere inside
 * eleven files.
 *
 * This script is the diagnostic. It sweeps each STATELESS function over hundreds of input rows —
 * including the awkward ones, zero draft and inverted gaps and negative tension — and dumps the
 * expected outputs. `ModelParityTests` replays exactly those rows through the C# port. Because
 * the functions are pure, the tolerance can be far tighter than anything downstream can afford:
 * 1e-13 relative, which is a handful of ulp.
 *
 * So a failure here reads "CalculateMeanFlowStress differs by 3 ulp at row 218 (h0=2.8, h1=2.31,
 * eps=0.42)" rather than "the engine drifted". That is the whole value of the file.
 *
 * The sweeps are DETERMINISTIC and index-driven — no RNG — so the fixture is stable across runs
 * and a diff in git review means someone changed the physics.
 *
 *   npx tsx scripts/exportModelProbes.ts [--out dotnet/tests/Crm04.Domain.Tests/golden/model-probes.json]
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { engineeringConfig } from '../src/config/engineeringConfig'
import { millConfig } from '../src/config/millConfig'
import {
  beginReversal,
  transition,
  type MachineEventType,
  type TransitionContext,
} from '../src/machine/machineStateMachine'
import {
  reversalProgress,
  startReversal,
  stepReversal,
  type ReversalPhase,
  type ReversalState,
} from '../src/machine/reversingEngine'
import type { MachineStatus, RollingDirection } from '../src/types/machine'
import { calculateDrive, hydraulicPressureFromForce } from '../src/simulation/driveModel'
import { calculateRollingForce, estimateForceFromTorque } from '../src/simulation/forceModel'
import {
  calculateContactLength,
  calculateFlattenedRadius,
  calculateMeanFlowStress,
  calculateReduction,
  calculateRollRPM,
  calculateTrueStrain,
  entrySpeedFromMassFlow,
  massFlowError,
  outputThicknessFromReduction,
  rollSurfaceSpeedFromStripSpeed,
  specificTension,
  tensionForceFromSpecific,
} from '../src/simulation/rollingModel'
import {
  coilLayers,
  coilLengthFromRadius,
  coilMass,
  coilRadiusFromLength,
  lengthAfterReduction,
  reelCurrent,
  reelRPM,
  reelTorque,
} from '../src/simulation/coilModel'
import { applyScenario, SCENARIOS, type ScenarioId } from '../src/simulation/simulationScenarios'
import {
  calculateTensionReferences,
  stepTension,
  tensionReferenceForState,
} from '../src/simulation/tensionModel'
import {
  gapPositionForTargetThickness,
  hagcStep,
  inverseGaugemeter,
  solveGaugemeter,
} from '../src/simulation/thicknessModel'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const OUT = arg('out', join('dotnet', 'tests', 'Crm04.Domain.Tests', 'golden', 'model-probes.json'))

// ---------------------------------------------------------------------------
// Sweep helpers
//
// Every sweep is a deterministic lattice over an index, never a random sample. Two reasons: the
// fixture is reproducible, and the awkward inputs (draft == 0, S0 > h0, zero width) are HIT ON
// PURPOSE rather than left to chance. Those guard branches are exactly where a port goes wrong.
// ---------------------------------------------------------------------------

/** `count` values spread from `lo` to `hi` inclusive. */
function span(lo: number, hi: number, count: number): number[] {
  if (count <= 1) return [lo]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(lo + ((hi - lo) * i) / (count - 1))
  return out
}

/** Cartesian product, flattened into rows. */
function cross<A, B>(as: A[], bs: B[]): [A, B][] {
  const out: [A, B][] = []
  for (const a of as) for (const b of bs) out.push([a, b])
  return out
}

type Probe = { in: Record<string, unknown>; out: unknown }

const suites: Record<string, Probe[]> = {}

function suite(name: string, probes: Probe[]): void {
  suites[name] = probes
}

// Representative mill geometry, so the sweeps sit in the band the real schedule visits.
const W = millConfig.geometry.workRollDiameter
const WIDTH = 450

// ---------------------------------------------------------------------------
// rollingModel
// ---------------------------------------------------------------------------

{
  const thicknesses = span(0.28, 3.2, 12)
  const probes: Probe[] = []
  for (const [h0, h1] of cross(thicknesses, thicknesses)) {
    probes.push({ in: { inputThickness: h0, outputThickness: h1 }, out: calculateReduction(h0, h1) })
  }
  // The guard branch: non-positive entry thickness returns 0, it does not divide.
  for (const h0 of [0, -1, -0.0001]) {
    probes.push({ in: { inputThickness: h0, outputThickness: 1 }, out: calculateReduction(h0, 1) })
  }
  suite('CalculateReduction', probes)
}

suite(
  'OutputThicknessFromReduction',
  cross(span(0.3, 3.2, 12), span(-5, 45, 11)).map(([h0, r]) => ({
    in: { inputThickness: h0, reductionPct: r },
    out: outputThicknessFromReduction(h0, r),
  })),
)

{
  const thicknesses = span(0.25, 3.2, 12)
  const probes: Probe[] = cross(thicknesses, thicknesses).map(([h0, h1]) => ({
    in: { inputThickness: h0, outputThickness: h1 },
    out: calculateTrueStrain(h0, h1),
  }))
  for (const [h0, h1] of [[0, 1], [1, 0], [-1, 1], [1, -1]]) {
    probes.push({ in: { inputThickness: h0, outputThickness: h1 }, out: calculateTrueStrain(h0, h1) })
  }
  suite('CalculateTrueStrain', probes)
}

{
  // THE highest-value sweep in this file. Both branches of the function are exercised: the
  // e1-e0 < 1e-9 shortcut (h0 == h1) and the integrated form, over the accumulated-strain range
  // a full 5-pass schedule actually reaches.
  const probes: Probe[] = []
  const thicknesses = span(0.28, 3.2, 10)
  const strains = span(0, 1.6, 9)
  for (const eps of strains) {
    for (const [h0, h1] of cross(thicknesses, thicknesses)) {
      probes.push({
        in: { inputThickness: h0, outputThickness: h1, accumulatedStrain: eps },
        out: calculateMeanFlowStress(h0, h1, eps),
      })
    }
  }
  suite('CalculateMeanFlowStress', probes)
}

{
  const probes: Probe[] = []
  const radius = W / 2
  for (const f of span(0, 9000, 20)) {
    for (const draft of span(0, 0.9, 14)) {
      probes.push({
        in: { nominalRadiusMm: radius, forcePerWidthNPerMm: f, draftMm: draft },
        out: calculateFlattenedRadius(radius, f, draft),
      })
    }
  }
  // The 4x cap and the negative-force guard.
  probes.push({ in: { nominalRadiusMm: radius, forcePerWidthNPerMm: 1e7, draftMm: 0.01 }, out: calculateFlattenedRadius(radius, 1e7, 0.01) })
  probes.push({ in: { nominalRadiusMm: radius, forcePerWidthNPerMm: -50, draftMm: 0.4 }, out: calculateFlattenedRadius(radius, -50, 0.4) })
  suite('CalculateFlattenedRadius', probes)
}

suite(
  'CalculateContactLength',
  cross(span(100, 450, 10), span(-0.1, 1.2, 14)).map(([r, d]) => ({
    in: { flattenedRadiusMm: r, draftMm: d },
    out: calculateContactLength(r, d),
  })),
)

suite(
  'RollSurfaceSpeedFromStripSpeed',
  span(0, 600, 25).map((v) => ({ in: { stripExitSpeedMpm: v }, out: rollSurfaceSpeedFromStripSpeed(v) })),
)

suite(
  'CalculateRollRpm',
  cross(span(0, 600, 15), [0, 202, 215, 300]).map(([v, d]) => ({
    in: { surfaceSpeedMpm: v, rollDiameterMm: d },
    out: calculateRollRPM(v, d),
  })),
)

suite(
  'EntrySpeedFromMassFlow',
  cross(span(0, 600, 12), cross(span(0, 3.2, 8), span(0.25, 3.2, 8))).map(([v, [h0, h1]]) => ({
    in: { exitSpeedMpm: v, inputThickness: h0, outputThickness: h1 },
    out: entrySpeedFromMassFlow(v, h0, h1),
  })),
)

{
  const probes: Probe[] = []
  for (const [h0, ve] of cross(span(0.3, 3.2, 8), span(0, 500, 8))) {
    for (const [h1, vx] of cross(span(0.25, 3.0, 6), span(0, 600, 6))) {
      probes.push({
        in: { inputThickness: h0, entrySpeedMpm: ve, outputThickness: h1, exitSpeedMpm: vx },
        out: massFlowError(h0, ve, h1, vx),
      })
    }
  }
  suite('MassFlowError', probes)
}

suite(
  'SpecificTension',
  cross(span(-20, 90, 12), cross(span(0, 3.2, 8), [0, 250, 450, 500])).map(([t, [h, w]]) => ({
    in: { tensionKn: t, thicknessMm: h, widthMm: w },
    out: specificTension(t, h, w),
  })),
)

suite(
  'TensionForceFromSpecific',
  cross(span(0, 200, 12), cross(span(0.25, 3.2, 8), [250, 450, 500])).map(([s, [h, w]]) => ({
    in: { specificTensionNPerMm2: s, thicknessMm: h, widthMm: w },
    out: tensionForceFromSpecific(s, h, w),
  })),
)

// ---------------------------------------------------------------------------
// coilModel
// ---------------------------------------------------------------------------

const MANDREL_R = millConfig.geometry.mandrelDiameter / 2

suite(
  'CoilRadiusFromLength',
  cross(span(0.25, 3.2, 10), span(-50, 3000, 14)).map(([h, l]) => ({
    in: { mandrelRadiusMm: MANDREL_R, stripThicknessMm: h, woundLengthM: l },
    out: coilRadiusFromLength(MANDREL_R, h, l),
  })),
)

suite(
  'CoilLengthFromRadius',
  cross(span(0, 3.2, 9), span(200, 1000, 12)).map(([h, r]) => ({
    in: { mandrelRadiusMm: MANDREL_R, stripThicknessMm: h, outerRadiusMm: r },
    out: coilLengthFromRadius(MANDREL_R, h, r),
  })),
)

suite(
  'CoilLayers',
  cross(span(0, 3.2, 9), span(200, 1000, 12)).map(([h, r]) => ({
    in: { mandrelRadiusMm: MANDREL_R, stripThicknessMm: h, outerRadiusMm: r },
    out: coilLayers(MANDREL_R, h, r),
  })),
)

suite(
  'ReelRpm',
  cross(span(0, 600, 14), span(0, 900, 14)).map(([v, r]) => ({
    in: { lineSpeedMpm: v, coilRadiusMm: r },
    out: reelRPM(v, r),
  })),
)

suite(
  'ReelTorque',
  cross(span(-20, 90, 12), span(254, 900, 12)).map(([t, r]) => ({
    in: { tensionKn: t, coilRadiusMm: r },
    out: reelTorque(t, r),
  })),
)

suite(
  'ReelCurrent',
  cross(span(-40, 60, 12), [0, 10.7, 20.5]).map(([g, rated]) => ({
    in: { torqueKNm: g, ratedTorqueKNm: rated, ratedCurrentA: 1400 },
    out: reelCurrent(g, rated, 1400),
  })),
)

suite(
  'CoilMass',
  cross(span(254, 950, 14), [250, 450, 500]).map(([r, w]) => ({
    in: { mandrelRadiusMm: MANDREL_R, outerRadiusMm: r, widthMm: w },
    out: coilMass(MANDREL_R, r, w),
  })),
)

suite(
  'LengthAfterReduction',
  cross(span(0, 3000, 10), cross(span(0.3, 3.2, 8), span(0, 3.2, 8))).map(([l, [h0, h1]]) => ({
    in: { lengthM: l, inputThickness: h0, outputThickness: h1 },
    out: lengthAfterReduction(l, h0, h1),
  })),
)

// ---------------------------------------------------------------------------
// tensionModel
// ---------------------------------------------------------------------------

{
  const probes: Probe[] = []
  for (const [se, sx] of cross(span(0, 220, 8), span(0, 220, 8))) {
    for (const [h0, h1] of cross(span(0.3, 3.2, 5), span(0.25, 3.0, 5))) {
      probes.push({
        in: { entrySpecificTension: se, exitSpecificTension: sx, inputThickness: h0, outputThickness: h1, width: WIDTH },
        out: calculateTensionReferences(se, sx, h0, h1, WIDTH),
      })
    }
  }
  suite('CalculateTensionReferences', probes)
}

{
  // dt = 0 and dt < 0 both short-circuit to the reference. Both are swept.
  const probes: Probe[] = []
  for (const [cur, ref] of cross(span(-10, 90, 10), span(0, 90, 10))) {
    for (const dt of [-0.1, 0, 0.01, 0.1, 0.25, 1]) {
      probes.push({ in: { current: cur, reference: ref, dt }, out: stepTension(cur, ref, dt) })
    }
  }
  suite('StepTension', probes)
}

{
  const probes: Probe[] = []
  // 0.01 and the threading speed are the two branch boundaries — hit them exactly.
  const speeds = [0, 0.005, 0.01, 0.0100001, 1, 15, 29.9, 30, 30.1, 60, 170, 400]
  for (const [full, threaded] of cross(span(0, 90, 9), [true, false])) {
    for (const v of speeds) {
      probes.push({ in: { fullReferenceKn: full, speedMpm: v, threaded }, out: tensionReferenceForState(full, v, threaded) })
    }
  }
  suite('TensionReferenceForState', probes)
}

// ---------------------------------------------------------------------------
// forceModel — the solver-bearing one
// ---------------------------------------------------------------------------

{
  const probes: Probe[] = []
  // The five real schedule passes, plus deliberately awkward ones.
  //
  // ON SMALL DRAFTS. [1.0, 0.9999995] has a draft of 5e-7 mm, BELOW the model's own
  // `draft <= 1e-6` guard, so it returns ZERO_RESULT — that is the guard being tested, and it
  // compares exactly. A draft just ABOVE the guard is deliberately NOT swept: there
  // `calculateMeanFlowStress` evaluates (F(e1) - F(e0)) / (e1 - e0) with a denominator of 1e-6,
  // multiplying one ulp of Math.pow by ~1.2e5. The TypeScript would disagree with ITSELF across
  // two JavaScript engines at that input, so including it would say nothing about the port while
  // forcing a tolerance four orders looser on all 1,200 rows. 1e-3 and 1e-4 mm cover the
  // small-draft regime with arithmetic that is still conditioned.
  const pairs: [number, number][] = [
    [2.8, 2.31], [2.31, 1.85], [1.85, 1.43], [1.43, 1.05], [1.05, 0.8], [0.8, 0.6],
    [3.2, 2.0], [1.0, 0.999], [1.0, 0.9999], [1.0, 0.9999995], [1.0, 1.0], [0.9, 1.1],
    [0.5, 0.28], [2.0, 0.5],
  ]
  for (const [h0, h1] of pairs) {
    for (const eps of [0, 0.2, 0.55, 0.9, 1.4]) {
      for (const [te, tx] of [[0, 0], [20, 30], [45, 60], [67.7, 67.7], [-5, 10]] as [number, number][]) {
        for (const scale of [undefined, 1, 1.22, 0.8]) {
          probes.push({
            in: {
              inputThickness: h0, outputThickness: h1, width: WIDTH, workRollDiameter: W,
              entryTension: te, exitTension: tx, accumulatedStrain: eps, flowStressScale: scale ?? null,
            },
            out: calculateRollingForce({
              inputThickness: h0, outputThickness: h1, width: WIDTH, workRollDiameter: W,
              entryTension: te, exitTension: tx, accumulatedStrain: eps, flowStressScale: scale,
            }),
          })
        }
      }
    }
  }
  // The zero-result guards: no draft, no width, non-positive delivered thickness.
  for (const [h0, h1, w] of [[1, 1, WIDTH], [1, 1.5, WIDTH], [2, 1, 0], [2, 0, WIDTH], [2, -1, WIDTH]]) {
    probes.push({
      in: { inputThickness: h0, outputThickness: h1, width: w, workRollDiameter: W, entryTension: 30, exitTension: 40, accumulatedStrain: 0.3, flowStressScale: null },
      out: calculateRollingForce({ inputThickness: h0, outputThickness: h1, width: w, workRollDiameter: W, entryTension: 30, exitTension: 40, accumulatedStrain: 0.3 }),
    })
  }
  suite('CalculateRollingForce', probes)
}

suite(
  'EstimateForceFromTorque',
  cross(span(-5, 40, 14), span(0, 20, 14)).map(([g, l]) => ({
    in: { rollTorqueKNm: g, contactLengthMm: l },
    out: estimateForceFromTorque(g, l),
  })),
)

// ---------------------------------------------------------------------------
// driveModel
// ---------------------------------------------------------------------------

{
  const probes: Probe[] = []
  for (const f of span(0, 400, 7)) {
    for (const l of span(0, 18, 5)) {
      for (const rpm of [0, 50, 240, 600]) {
        for (const [te, tx] of [[0, 0], [45, 60], [60, 45]] as [number, number][]) {
          for (const rolling of [true, false]) {
            const input = { forceTonnes: f, contactLengthMm: l, rollRPM: rpm, workRollDiameter: W, entryTensionKN: te, exitTensionKN: tx, rolling }
            probes.push({ in: input, out: calculateDrive(input) })
          }
        }
      }
    }
  }
  suite('CalculateDrive', probes)
}

suite(
  'HydraulicPressureFromForce',
  span(-20, 500, 30).map((f) => ({ in: { forceTonnes: f }, out: hydraulicPressureFromForce(f) })),
)

// ---------------------------------------------------------------------------
// thicknessModel — the coupled solve. `iterations` is captured on purpose: see the C# remarks.
// ---------------------------------------------------------------------------

{
  const probes: Probe[] = []
  for (const h0 of [2.8, 2.31, 1.85, 1.43, 1.05, 0.8, 0.6]) {
    for (const s0 of span(0.1, 3.2, 14)) {
      for (const eps of [0, 0.4, 0.9, 1.4]) {
        for (const scale of [undefined, 1.22]) {
          const input = {
            gapPosition: s0, inputThickness: h0, width: WIDTH, workRollDiameter: W,
            entryTension: 45, exitTension: 60, accumulatedStrain: eps, flowStressScale: scale,
          }
          probes.push({ in: { ...input, flowStressScale: scale ?? null }, out: solveGaugemeter(input) })
        }
      }
    }
  }
  suite('SolveGaugemeter', probes)
}

suite(
  'InverseGaugemeter',
  cross(span(0.25, 3.2, 14), span(0, 400, 14)).map(([h, f]) => ({
    in: { deliveredThicknessMm: h, forceTonnes: f },
    out: inverseGaugemeter(h, f),
  })),
)

{
  const probes: Probe[] = []
  for (const [h0, target] of [[2.8, 2.31], [2.31, 1.85], [1.85, 1.43], [1.43, 1.05], [1.05, 0.8], [0.8, 0.6], [3.2, 3.2]] as [number, number][]) {
    for (const eps of [0, 0.4, 0.9, 1.4]) {
      for (const [te, tx] of [[0, 0], [45, 60]] as [number, number][]) {
        probes.push({
          in: { targetThickness: target, inputThickness: h0, width: WIDTH, workRollDiameter: W, entryTension: te, exitTension: tx, accumulatedStrain: eps },
          out: gapPositionForTargetThickness(target, h0, WIDTH, W, te, tx, eps),
        })
      }
    }
  }
  suite('GapPositionForTargetThickness', probes)
}

{
  // Sweeps the integrator clamp (±0.5), the slew clamp, and both short-circuits.
  const probes: Probe[] = []
  for (const integral of [-0.6, -0.5, -0.2, 0, 0.2, 0.5, 0.6]) {
    for (const err of span(-0.4, 0.4, 9)) {
      for (const dt of [0, 0.1]) {
        for (const enabled of [true, false]) {
          const measured = 1.2 + err
          probes.push({
            in: { integral, gapPosition: 1.15, measuredThickness: measured, referenceThickness: 1.2, dt, enabled },
            out: hagcStep({ integral }, 1.15, measured, 1.2, dt, enabled),
          })
        }
      }
    }
  }
  suite('HagcStep', probes)
}

// ---------------------------------------------------------------------------
// simulationScenarios — every field of every scenario, so a dropped `with` clause is caught
// ---------------------------------------------------------------------------

suite(
  'ApplyScenario',
  SCENARIOS.map((s) => ({ in: { id: s.id }, out: applyScenario(s.id) })).concat(
    // The default branch, reached by an id outside the union.
    [{ in: { id: 'NOT_A_SCENARIO' }, out: applyScenario('NOT_A_SCENARIO' as ScenarioId) }],
  ),
)

// ---------------------------------------------------------------------------
// machineStateMachine — the full transition table, exhaustively
//
// 13 statuses x 15 events x 16 contexts = 3,120 rows. Small, discrete and total, so there is no
// reason to sample: sweep the whole space and compare EXACTLY. The reason strings are compared
// too, character for character — they reach the operator's screen, and "Start ignored — mill is
// FAST_STOP" vs "... FAST STOP" is the kind of difference that only a total sweep catches.
// ---------------------------------------------------------------------------

const ALL_STATUSES: MachineStatus[] = [
  'IDLE', 'READY', 'THREADING', 'ROLLING', 'DECELERATING', 'REVERSING', 'STOPPED',
  'FAST_STOP', 'WARMUP', 'SKIN_PASS', 'REWIND', 'ROLL_CHANGE', 'FAULT',
]

const ALL_EVENTS: MachineEventType[] = [
  'ENABLE', 'START', 'STOP', 'FAST_STOP', 'RESET', 'REQUEST_ROLL_CHANGE',
  'THREADED', 'AT_SPEED', 'SPEED_ZERO', 'PASS_COMPLETE', 'REVERSAL_COMPLETE',
  'SCHEDULE_COMPLETE', 'INTERLOCK_LOST', 'INTERLOCK_OK', 'FAULT',
]

{
  const contexts: TransitionContext[] = []
  for (const millReady of [true, false]) {
    // interlockReason null vs set is the ?? fallback in eight separate branches — both must be
    // swept or half the reason strings in the module go untested.
    for (const interlockReason of [null, 'ETR gauge not ready']) {
      for (const threaded of [true, false]) {
        for (const scheduleComplete of [true, false]) {
          contexts.push({ millReady, interlockReason, speed: threaded ? 120 : 0, threaded, scheduleComplete })
        }
      }
    }
  }

  const probes: Probe[] = []
  for (const status of ALL_STATUSES) {
    for (const event of ALL_EVENTS) {
      for (const ctx of contexts) {
        probes.push({ in: { current: status, event, ...ctx }, out: transition(status, event, ctx) })
      }
    }
  }
  suite('Transition', probes)
}

suite(
  'BeginReversal',
  ALL_STATUSES.map((s) => ({ in: { current: s }, out: beginReversal(s) })),
)

// ---------------------------------------------------------------------------
// reversingEngine
// ---------------------------------------------------------------------------

{
  const phases: ReversalPhase[] = ['NONE', 'SETTLE', 'FLIP', 'REPOSITION', 'COMPLETE']
  const probes: Probe[] = []
  for (const phase of phases) {
    // Elapsed values straddle both dwell boundaries exactly (1.6 s and 2.2 s), because `>=` is
    // the comparison and an off-by-one-tick reversal is the whole class of bug this catches.
    for (const elapsed of [0, 0.1, 1.5, 1.5999999, 1.6, 1.7, 2.1, 2.2, 2.3, 5]) {
      for (const speed of [0, 0.05, 0.0500001, 0.5, -0.5, 120]) {
        for (const pending of ['FORWARD', 'REVERSE', null] as (RollingDirection | null)[]) {
          const state: ReversalState = { phase, elapsed, pendingDirection: pending }
          probes.push({
            in: { phase, elapsed, pendingDirection: pending, dt: 0.1, speed },
            out: stepReversal(state, 0.1, speed),
          })
        }
      }
    }
  }
  suite('StepReversal', probes)
}

{
  const probes: Probe[] = []
  for (const phase of ['NONE', 'SETTLE', 'FLIP', 'REPOSITION', 'COMPLETE'] as ReversalPhase[]) {
    for (const elapsed of span(0, 5, 21)) {
      probes.push({
        in: { phase, elapsed },
        out: reversalProgress({ phase, elapsed, pendingDirection: null }),
      })
    }
  }
  suite('ReversalProgress', probes)
}

suite(
  'StartReversal',
  (['FORWARD', 'REVERSE'] as RollingDirection[]).flatMap((current) =>
    ([undefined, 'FORWARD', 'REVERSE'] as (RollingDirection | undefined)[]).map((next) => ({
      in: { currentDirection: current, nextDirection: next ?? null },
      out: startReversal(current, next),
    })),
  ),
)

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Fingerprint of the TypeScript the fixture was generated from.
 *
 * Without this a fixture regenerated from a CHANGED engine, against an UNCHANGED C# port, makes
 * the gate go green while comparing nothing meaningful. The C# loader prints this hash in every
 * failure message so a stale fixture is visible at the moment it matters.
 */
const SOURCES = [
  'src/config/engineeringConfig.ts',
  'src/config/millConfig.ts',
  'src/config/unitConversion.ts',
  'src/simulation/rollingModel.ts',
  'src/simulation/forceModel.ts',
  'src/simulation/thicknessModel.ts',
  'src/simulation/driveModel.ts',
  'src/simulation/coilModel.ts',
  'src/simulation/tensionModel.ts',
  'src/simulation/simulationScenarios.ts',
  'src/machine/machineStateMachine.ts',
  'src/machine/reversingEngine.ts',
]

const hash = createHash('sha256')
for (const f of SOURCES) hash.update(readFileSync(f))
const sourceHash = hash.digest('hex')

const total = Object.values(suites).reduce((n, p) => n + p.length, 0)

const payload = {
  generatedBy: 'scripts/exportModelProbes.ts',
  regenerateWith: 'npx tsx scripts/exportModelProbes.ts',
  sourceHash,
  sources: SOURCES,
  engineering: {
    millModulus: engineeringConfig.millModulus,
    hitchcockIterations: engineeringConfig.hitchcockIterations,
    solver: engineeringConfig.solver,
  },
  suiteCount: Object.keys(suites).length,
  probeCount: total,
  suites,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 1), 'utf8')

console.log(`wrote ${OUT}`)
console.log(`  ${Object.keys(suites).length} suites, ${total} probes`)
console.log(`  source sha256 ${sourceHash}`)
for (const [name, probes] of Object.entries(suites)) {
  console.log(`    ${name.padEnd(32)} ${String(probes.length).padStart(5)}`)
}
