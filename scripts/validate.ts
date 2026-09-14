/**
 * HEADLESS VALIDATION HARNESS — §17.
 *
 * Drives the SimulationEngine directly with a fixed time step and asserts the
 * behaviour the master spec requires. It exercises the machine layer without a
 * browser, so a regression in the physics or the state machine fails here rather
 * than being noticed as "the picture looks odd".
 *
 * Run with:  npm run validate
 */

import { engineeringConfig } from '../src/config/engineeringConfig'
import { millConfig } from '../src/config/millConfig'
import { SimulationEngine, type RawFrame } from '../src/simulation/simulationEngine'
import { calculateRollRPM, rollSurfaceSpeedFromStripSpeed } from '../src/simulation/rollingModel'
import { reelRPM } from '../src/simulation/coilModel'
import { payoffReel } from '../src/machine/reversingEngine'
import { demoCoil, demoCoilLength, demoPassSchedule } from '../src/data/demoPassSchedule'

const DT = 0.1

/**
 * Schedule facts the assertions below need. Derived, never retyped: a harness
 * that hardcodes "five passes" or "0.9 mm" starts failing for the wrong reason
 * the moment the schedule is retuned, which tells you nothing about the physics.
 */
const PASS_COUNT = demoPassSchedule.passes.length
const FINAL_PASS = demoPassSchedule.passes[PASS_COUNT - 1]
const FINAL_THICKNESS = FINAL_PASS.outputThickness
/**
 * Expected `COIL.LENGTH` during the last pass.
 *
 * That tag carries the length CHARGED INTO the current pass, so it is the length
 * at the final pass's INPUT gauge, not at delivered gauge. Mass flow gives it
 * directly: L = L_charged x h_charged / h_input.
 */
const FINAL_PASS_LENGTH =
  (demoCoilLength * demoCoil.entryThickness) / FINAL_PASS.inputThickness

let failures = 0
let checks = 0

function num(frame: RawFrame, tag: string): number {
  const v = frame[tag]
  return typeof v === 'number' ? v : NaN
}

function str(frame: RawFrame, tag: string): string {
  return String(frame[tag])
}

function check(label: string, pass: boolean, detail: string): void {
  checks++
  if (!pass) failures++
  const mark = pass ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${label}  —  ${detail}`)
}

function within(actual: number, expected: number, tolPct: number): boolean {
  if (Math.abs(expected) < 1e-6) return Math.abs(actual) < 1e-3
  return Math.abs((actual - expected) / expected) * 100 <= tolPct
}

/** Run the engine forward `seconds` and return the last frame. */
function run(engine: SimulationEngine, seconds: number): RawFrame {
  let frame: RawFrame = {}
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) frame = engine.tick(DT)
  return frame
}

/** Run until `predicate` is true or `maxSeconds` elapses. */
function runUntil(
  engine: SimulationEngine,
  predicate: (f: RawFrame) => boolean,
  maxSeconds: number,
): { frame: RawFrame; elapsed: number; reached: boolean } {
  let frame: RawFrame = engine.tick(DT)
  let elapsed = DT
  while (elapsed < maxSeconds) {
    frame = engine.tick(DT)
    elapsed += DT
    if (predicate(frame)) return { frame, elapsed, reached: true }
  }
  return { frame, elapsed, reached: false }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------------------

console.log('4HI REVERSING MILL DIGITAL TWIN — HEADLESS VALIDATION (§17)')
console.log(`Mill ${millConfig.identity.mill} · dt = ${DT} s\n`)

// --- TEST 1: machine stopped ------------------------------------------------
section('TEST 1 — Machine stopped: rolls, strip, reels stopped; speed = 0')
{
  const engine = new SimulationEngine()
  const frame = run(engine, 2)
  check('Speed is zero', num(frame, 'MILL.SPEED.ACTUAL') < 0.01, `${num(frame, 'MILL.SPEED.ACTUAL').toFixed(3)} m/min`)
  check('Work rolls stopped', Math.abs(num(frame, 'WR.TOP.RPM')) < 0.01, `${num(frame, 'WR.TOP.RPM').toFixed(3)} rpm`)
  check('Backup rolls stopped', Math.abs(num(frame, 'BUR.TOP.RPM')) < 0.01, `${num(frame, 'BUR.TOP.RPM').toFixed(3)} rpm`)
  check('Reels stopped', Math.abs(num(frame, 'DTR.RPM')) < 0.01 && Math.abs(num(frame, 'ETR.RPM')) < 0.01, `DTR ${num(frame, 'DTR.RPM').toFixed(3)} · ETR ${num(frame, 'ETR.RPM').toFixed(3)}`)
  check('No rolling force at standstill', num(frame, 'ROLL.FORCE.ACTUAL') < engineeringConfig.forceLimits.warning * 0.35, `${num(frame, 'ROLL.FORCE.ACTUAL').toFixed(1)} t`)
}

// --- TEST 2: start rolling --------------------------------------------------
section('TEST 2 — Start rolling: rolls and strip accelerate, reels rotate, motor load changes')
let steadyFrame: RawFrame = {}
{
  const engine = new SimulationEngine()
  const before = run(engine, 1)
  engine.command({ type: 'START' })
  const after = run(engine, 8)
  steadyFrame = after

  check('Status is ROLLING', str(after, 'MILL.STATUS') === 'ROLLING', str(after, 'MILL.STATUS'))
  check('Speed increased', num(after, 'MILL.SPEED.ACTUAL') > num(before, 'MILL.SPEED.ACTUAL') + 1, `${num(before, 'MILL.SPEED.ACTUAL').toFixed(0)} → ${num(after, 'MILL.SPEED.ACTUAL').toFixed(0)} m/min`)
  check('Work roll rpm increased', Math.abs(num(after, 'WR.TOP.RPM')) > 1, `${Math.abs(num(after, 'WR.TOP.RPM')).toFixed(1)} rpm`)
  check('Reels rotating', Math.abs(num(after, 'DTR.RPM')) > 0.05 && Math.abs(num(after, 'ETR.RPM')) > 0.05, `DTR ${num(after, 'DTR.RPM').toFixed(2)} · ETR ${num(after, 'ETR.RPM').toFixed(2)} rpm`)
  check('Motor load developed', num(after, 'DRIVE.CURRENT') > num(before, 'DRIVE.CURRENT') + 1, `${num(before, 'DRIVE.CURRENT').toFixed(0)} → ${num(after, 'DRIVE.CURRENT').toFixed(0)} A`)
  check('Rolling force developed', num(after, 'ROLL.FORCE.ACTUAL') > 100, `${num(after, 'ROLL.FORCE.ACTUAL').toFixed(0)} t`)
}

// --- Invariants at steady state --------------------------------------------
section('INVARIANTS at steady rolling (§18 coupling table)')
{
  const f = steadyFrame
  const speed = num(f, 'MILL.SPEED.ACTUAL')
  const expectedWrRpm = calculateRollRPM(rollSurfaceSpeedFromStripSpeed(speed), millConfig.geometry.workRollDiameter)
  check('Work roll rpm = v / (π·D)', within(Math.abs(num(f, 'WR.TOP.RPM')), expectedWrRpm, 1), `${Math.abs(num(f, 'WR.TOP.RPM')).toFixed(2)} vs ${expectedWrRpm.toFixed(2)} rpm`)

  const expectedBurRpm = calculateRollRPM(rollSurfaceSpeedFromStripSpeed(speed), millConfig.geometry.backupRollDiameter)
  check('BUR rpm scales inversely with diameter', within(Math.abs(num(f, 'BUR.TOP.RPM')), expectedBurRpm, 1), `${Math.abs(num(f, 'BUR.TOP.RPM')).toFixed(2)} vs ${expectedBurRpm.toFixed(2)} rpm`)

  check('Work rolls counter-rotate', Math.sign(num(f, 'WR.TOP.RPM')) === -Math.sign(num(f, 'WR.BOTTOM.RPM')), `${num(f, 'WR.TOP.RPM').toFixed(1)} / ${num(f, 'WR.BOTTOM.RPM').toFixed(1)} rpm`)

  check('Mass flow closes within 1%', Math.abs(num(f, 'MILL.MASSFLOW.ERROR')) < 1, `${num(f, 'MILL.MASSFLOW.ERROR').toFixed(4)}%`)

  const entrySpeed = num(f, 'MILL.SPEED.ENTRY')
  const expectedEntry = (speed * num(f, 'ROLL.GAP.ACTUAL')) / num(f, 'STRIP.THICKNESS.ENTRY')
  check('Entry speed = v_exit · h_exit / h_entry', within(entrySpeed, expectedEntry, 1), `${entrySpeed.toFixed(1)} vs ${expectedEntry.toFixed(1)} m/min`)

  // The payoff reel runs at ENTRY speed, so the reel this is asked of has to be
  // the one currently paying off — not whichever reel happens to sit on the -X
  // side of the stand.
  const payoff = payoffReel(str(f, 'MILL.DIRECTION') as 'FORWARD' | 'REVERSE')
  const payoffRpm = Math.abs(num(f, `${payoff}.RPM`))
  const expectedPayoff = reelRPM(entrySpeed, num(f, `${payoff}.DIAMETER`) / 2)
  check('Payoff reel rpm = v / 2πr', within(payoffRpm, expectedPayoff, 1), `${payoff}: ${payoffRpm.toFixed(3)} vs ${expectedPayoff.toFixed(3)} rpm`)

  const gaugemeter = num(f, 'ROLL.GAP.REF') + num(f, 'ROLL.FORCE.ACTUAL') / engineeringConfig.millModulus
  check('Gaugemeter h = S0 + F/M holds', Math.abs(gaugemeter - num(f, 'ROLL.GAP.ACTUAL')) * 1000 < 1, `residual ${(Math.abs(gaugemeter - num(f, 'ROLL.GAP.ACTUAL')) * 1000).toFixed(4)} µm`)

  check('Delivered thickness on schedule', Math.abs(num(f, 'STRIP.THICKNESS.DEVIATION')) < 25, `${num(f, 'STRIP.THICKNESS.DEVIATION').toFixed(2)} µm deviation`)
  // A band relative to the mill's own rating, so this still means "a plausible
  // fraction of what this stand can do" after the rating changes.
  const forceFloor = millConfig.ratings.maxRollingForce * 0.35
  check('Force in a credible band', num(f, 'ROLL.FORCE.ACTUAL') > forceFloor && num(f, 'ROLL.FORCE.ACTUAL') < millConfig.ratings.maxRollingForce, `${num(f, 'ROLL.FORCE.ACTUAL').toFixed(0)} t, between ${forceFloor.toFixed(0)} t and the ${millConfig.ratings.maxRollingForce} t rating`)
}

// --- TEST 3: increase speed -------------------------------------------------
section('TEST 3 — Increase speed: roll rpm ↑, reels respond, current changes')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  const before = run(engine, 10)
  engine.command({ type: 'TRIM_SPEED_REFERENCE', value: 60 })
  const after = run(engine, 8)

  check('Speed increased', num(after, 'MILL.SPEED.ACTUAL') > num(before, 'MILL.SPEED.ACTUAL') + 5, `${num(before, 'MILL.SPEED.ACTUAL').toFixed(0)} → ${num(after, 'MILL.SPEED.ACTUAL').toFixed(0)} m/min`)
  check('Roll rpm increased', Math.abs(num(after, 'WR.TOP.RPM')) > Math.abs(num(before, 'WR.TOP.RPM')), `${Math.abs(num(before, 'WR.TOP.RPM')).toFixed(1)} → ${Math.abs(num(after, 'WR.TOP.RPM')).toFixed(1)} rpm`)
  check('Reel rpm increased', Math.abs(num(after, 'ETR.RPM')) > Math.abs(num(before, 'ETR.RPM')), `${Math.abs(num(before, 'ETR.RPM')).toFixed(2)} → ${Math.abs(num(after, 'ETR.RPM')).toFixed(2)} rpm`)
  check('Drive power increased', num(after, 'DRIVE.POWER') > num(before, 'DRIVE.POWER'), `${num(before, 'DRIVE.POWER').toFixed(0)} → ${num(after, 'DRIVE.POWER').toFixed(0)} kW`)
}

// --- TEST 4: reduce roll gap ------------------------------------------------
section('TEST 4 — Reduce roll gap: thickness ↓, force ↑, motor load ↑')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  // AGC off, otherwise the loop corrects the gap change back out and the test
  // measures the controller rather than the physics.
  engine.command({ type: 'SET_AGC', flag: false })
  const before = run(engine, 12)
  engine.command({ type: 'TRIM_ROLL_GAP', value: -0.05 })
  const after = run(engine, 4)

  check('Delivered thickness reduced', num(after, 'ROLL.GAP.ACTUAL') < num(before, 'ROLL.GAP.ACTUAL'), `${num(before, 'ROLL.GAP.ACTUAL').toFixed(4)} → ${num(after, 'ROLL.GAP.ACTUAL').toFixed(4)} mm`)
  check('Rolling force increased', num(after, 'ROLL.FORCE.ACTUAL') > num(before, 'ROLL.FORCE.ACTUAL'), `${num(before, 'ROLL.FORCE.ACTUAL').toFixed(1)} → ${num(after, 'ROLL.FORCE.ACTUAL').toFixed(1)} t`)
  check('Drive torque increased', num(after, 'DRIVE.TORQUE') > num(before, 'DRIVE.TORQUE'), `${num(before, 'DRIVE.TORQUE').toFixed(2)} → ${num(after, 'DRIVE.TORQUE').toFixed(2)} kNm`)
  check('Drive current increased', num(after, 'DRIVE.CURRENT') > num(before, 'DRIVE.CURRENT'), `${num(before, 'DRIVE.CURRENT').toFixed(0)} → ${num(after, 'DRIVE.CURRENT').toFixed(0)} A`)
}

// --- Tension coupling (§8.6) ------------------------------------------------
section('COUPLING — Tension ↑ must reduce rolling force (§8.2)')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  engine.command({ type: 'SET_AGC', flag: false })
  const before = run(engine, 12)
  engine.command({ type: 'TRIM_ENTRY_TENSION', value: 60 })
  engine.command({ type: 'TRIM_EXIT_TENSION', value: 60 })
  const after = run(engine, 6)

  check('Force fell as tension rose', num(after, 'ROLL.FORCE.ACTUAL') < num(before, 'ROLL.FORCE.ACTUAL'), `${num(before, 'ROLL.FORCE.ACTUAL').toFixed(1)} t at ${num(before, 'TENSION.ENTRY').toFixed(0)}/${num(before, 'TENSION.EXIT').toFixed(0)} kN → ${num(after, 'ROLL.FORCE.ACTUAL').toFixed(1)} t at ${num(after, 'TENSION.ENTRY').toFixed(0)}/${num(after, 'TENSION.EXIT').toFixed(0)} kN`)
}

// --- TEST 5 + 9: pass complete and reversal ---------------------------------
section('TEST 5 & 9 — Pass complete and reversal')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  const start = run(engine, 5)
  const startDirection = str(start, 'MILL.DIRECTION')
  const startPass = num(start, 'PASS.NUMBER')

  // Run to the end of pass 1.
  const decel = runUntil(engine, (f) => str(f, 'MILL.STATUS') === 'DECELERATING', 600)
  check('Pass end triggers deceleration, not an instant flip', decel.reached, `after ${decel.elapsed.toFixed(0)} s of rolling`)

  const stopped = runUntil(engine, (f) => num(f, 'MILL.SPEED.ACTUAL') < 0.01, 60)
  check('Mill reaches standstill before reversing', stopped.reached, `speed ${num(stopped.frame, 'MILL.SPEED.ACTUAL').toFixed(3)} m/min, status ${str(stopped.frame, 'MILL.STATUS')}`)
  check('All motion stopped at the flip point', Math.abs(num(stopped.frame, 'WR.TOP.RPM')) < 0.01 && Math.abs(num(stopped.frame, 'DTR.RPM')) < 0.01, `WR ${num(stopped.frame, 'WR.TOP.RPM').toFixed(3)} · DTR ${num(stopped.frame, 'DTR.RPM').toFixed(3)} rpm`)

  const flipped = runUntil(engine, (f) => str(f, 'MILL.DIRECTION') !== startDirection, 30)
  check('Direction flipped', flipped.reached, `${startDirection} → ${str(flipped.frame, 'MILL.DIRECTION')}`)
  check('Pass number incremented', num(flipped.frame, 'PASS.NUMBER') === startPass + 1, `${startPass} → ${num(flipped.frame, 'PASS.NUMBER')}`)
  check('Target thickness changed for the new pass', Math.abs(num(flipped.frame, 'STRIP.THICKNESS.REF') - num(start, 'STRIP.THICKNESS.REF')) > 1e-4, `${num(start, 'STRIP.THICKNESS.REF').toFixed(3)} → ${num(flipped.frame, 'STRIP.THICKNESS.REF').toFixed(3)} mm`)

  const newDirection = str(flipped.frame, 'MILL.DIRECTION') as 'FORWARD' | 'REVERSE'
  // Asked of the same function the engine uses, so this assertion cannot drift
  // away from the role mapping the way a second copy of the ternary would.
  const expectedPayoff = payoffReel(newDirection)
  const payoffRole = str(flipped.frame, `${expectedPayoff}.ROLE`)
  check('Entry/exit roles swapped with direction', payoffRole === 'PAYOFF', `${newDirection}: ${expectedPayoff}.ROLE = ${payoffRole}`)

  const rolling = runUntil(engine, (f) => str(f, 'MILL.STATUS') === 'ROLLING', 40)
  check('Mill returns to ROLLING after the reversal', rolling.reached, `status ${str(rolling.frame, 'MILL.STATUS')}`)

  const upToSpeed = run(engine, 12)
  check('Rolls counter-rotate in the new direction', Math.sign(num(upToSpeed, 'WR.TOP.RPM')) === -Math.sign(num(upToSpeed, 'WR.BOTTOM.RPM')), `${num(upToSpeed, 'WR.TOP.RPM').toFixed(1)} / ${num(upToSpeed, 'WR.BOTTOM.RPM').toFixed(1)} rpm`)
  check('Rotation sense reversed vs pass 1', Math.sign(num(upToSpeed, 'WR.TOP.RPM')) !== Math.sign(num(start, 'WR.TOP.RPM')), `pass 1 ${num(start, 'WR.TOP.RPM').toFixed(1)} → pass 2 ${num(upToSpeed, 'WR.TOP.RPM').toFixed(1)} rpm`)
  check('Mass flow still closes after reversal', Math.abs(num(upToSpeed, 'MILL.MASSFLOW.ERROR')) < 1, `${num(upToSpeed, 'MILL.MASSFLOW.ERROR').toFixed(4)}%`)
}

// --- TEST 6: fast stop ------------------------------------------------------
section('TEST 6 — Fast stop')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  const running = run(engine, 12)
  engine.command({ type: 'FAST_STOP' })
  const during = run(engine, 0.5)

  check('Status is FAST_STOP', str(during, 'MILL.STATUS') === 'FAST_STOP', str(during, 'MILL.STATUS'))
  check('Fast stop flag set', during['FAST.STOP'] === true, String(during['FAST.STOP']))

  const stopped = runUntil(engine, (f) => num(f, 'MILL.SPEED.ACTUAL') < 0.01, 30)
  const normalStopTime = running && num(running, 'MILL.SPEED.ACTUAL') / engineeringConfig.deceleration
  check('Decelerates faster than a normal stop', stopped.reached && stopped.elapsed < normalStopTime, `${stopped.elapsed.toFixed(2)} s vs ${normalStopTime.toFixed(2)} s normal`)
  check('All motion stopped', Math.abs(num(stopped.frame, 'WR.TOP.RPM')) < 0.01, `${num(stopped.frame, 'WR.TOP.RPM').toFixed(3)} rpm`)
  check('Start is refused until reset', (() => { engine.command({ type: 'START' }); const f = run(engine, 2); return num(f, 'MILL.SPEED.ACTUAL') < 0.01 })(), 'speed stayed at zero after START without RESET')
}

// --- TEST 7: high force -----------------------------------------------------
section('TEST 7 — High rolling force scenario')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  const normal = run(engine, 12)
  engine.command({ type: 'SET_SCENARIO', scenario: 'HIGH_FORCE' })
  const high = run(engine, 8)

  check('Force rose above the normal condition', num(high, 'ROLL.FORCE.ACTUAL') > num(normal, 'ROLL.FORCE.ACTUAL'), `${num(normal, 'ROLL.FORCE.ACTUAL').toFixed(0)} → ${num(high, 'ROLL.FORCE.ACTUAL').toFixed(0)} t`)
  check('Force crossed the warning limit', num(high, 'ROLL.FORCE.ACTUAL') >= engineeringConfig.forceLimits.warning, `${num(high, 'ROLL.FORCE.ACTUAL').toFixed(0)} t vs ${engineeringConfig.forceLimits.warning.toFixed(0)} t warning`)
  check('Force stayed below the trip limit', num(high, 'ROLL.FORCE.ACTUAL') < engineeringConfig.forceLimits.trip, `${num(high, 'ROLL.FORCE.ACTUAL').toFixed(0)} t vs ${engineeringConfig.forceLimits.trip.toFixed(0)} t trip`)
  check('Motor load followed the force', num(high, 'DRIVE.CURRENT') > num(normal, 'DRIVE.CURRENT'), `${num(normal, 'DRIVE.CURRENT').toFixed(0)} → ${num(high, 'DRIVE.CURRENT').toFixed(0)} A`)
}

// --- TEST 8: communication loss ---------------------------------------------
section('TEST 8 — Communication loss')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  run(engine, 10)
  check('Engine publishing before the fault', engine.isPublishing(), 'publishing')
  engine.command({ type: 'SET_SCENARIO', scenario: 'COMMUNICATION_LOSS' })
  run(engine, 1)
  check('Engine stops publishing frames', !engine.isPublishing(), 'no frames emitted — the store watchdog marks values STALE')
}

// --- Interlocks -------------------------------------------------------------
section('INTERLOCKS — §13.2 named cause')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'SET_SCENARIO', scenario: 'GAUGE_NOT_READY' })
  const frame = run(engine, 2)
  check('Gauge reports not ready', frame['GAUGE.READY'] === false, String(frame['GAUGE.READY']))
  check('Mill interlock is broken', frame['MILL.INTERLOCK'] === false, String(frame['MILL.INTERLOCK']))
  check('Status reason names the cause', str(frame, 'MILL.STATUS.REASON').includes('GAUGE'), str(frame, 'MILL.STATUS.REASON'))

  engine.command({ type: 'START' })
  const afterStart = run(engine, 3)
  check('Start refused while the interlock is broken', num(afterStart, 'MILL.SPEED.ACTUAL') < 0.01, `speed ${num(afterStart, 'MILL.SPEED.ACTUAL').toFixed(3)} m/min`)
}

// --- Full schedule ----------------------------------------------------------
section('FULL SCHEDULE — five passes to final gauge')
{
  const engine = new SimulationEngine()
  engine.command({ type: 'START' })
  let frame = engine.tick(DT)
  let elapsed = 0
  const seen = new Set<number>()
  const maxSeconds = 3600

  while (elapsed < maxSeconds) {
    frame = engine.tick(DT)
    elapsed += DT
    seen.add(num(frame, 'PASS.NUMBER'))
    if (num(frame, 'PASS.NUMBER') >= num(frame, 'PASS.TOTAL') && num(frame, 'COIL.REMAINING_LENGTH') <= 1) break
  }

  check(`All ${PASS_COUNT} passes ran`, seen.size === PASS_COUNT, `passes seen: ${[...seen].sort().join(', ')}`)
  check('Reached the final pass', num(frame, 'PASS.NUMBER') === num(frame, 'PASS.TOTAL'), `pass ${num(frame, 'PASS.NUMBER')} of ${num(frame, 'PASS.TOTAL')}`)
  check('Final thickness reached', Math.abs(num(frame, 'ROLL.GAP.ACTUAL') - FINAL_THICKNESS) < 0.02, `${num(frame, 'ROLL.GAP.ACTUAL').toFixed(4)} mm vs ${FINAL_THICKNESS.toFixed(3)} target`)
  check('Schedule completed in a credible time', elapsed < maxSeconds, `${(elapsed / 60).toFixed(1)} min of mill time`)
  // Two-sided, because the interesting failure is the length drifting AWAY from
  // mass flow in either direction, not just failing to grow.
  check('Coil length tracks mass flow through the schedule', within(num(frame, 'COIL.LENGTH'), FINAL_PASS_LENGTH, 12), `${num(frame, 'COIL.LENGTH').toFixed(0)} m charged into the final pass vs ${FINAL_PASS_LENGTH.toFixed(0)} m from mass flow (${demoCoilLength.toFixed(0)} m at ${demoCoil.entryThickness} mm)`)
}

// ---------------------------------------------------------------------------
console.log(`\n${'-'.repeat(70)}`)
console.log(`${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.log(`${failures} FAILED`)
  process.exit(1)
}
console.log('ALL CHECKS PASSED')
