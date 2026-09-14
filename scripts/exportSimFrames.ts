/**
 * REPLAY EXPORT — simulator frames to JSONL for the .NET Feeder.
 *
 * The .NET port does not carry the physics. Oracle is the source of process values, and the
 * Feeder writes rows into it. Something has to produce those rows, and until a real OPC UA
 * gateway exists that something is this file: the existing TypeScript `SimulationEngine`, run
 * headlessly, dumped to disk, and replayed on a loop by `Crm04.Feeder`.
 *
 * WHY A SCRIPTED TIMELINE. An engine left at its defaults sits in IDLE forever. A replay of ten
 * minutes of IDLE would exercise nothing: the twin would never move, the alarm engine would never
 * fire, and the pass/reversal logic would never be reached. The timeline below therefore drives
 * the mill through start, acceleration, a scenario excursion, an operator trim and a stop, so the
 * captured frames contain genuine state transitions and at least one direction reversal.
 *
 * WHY RELATIVE TIME. Each record carries `dt`, milliseconds since the start of the replay, never
 * an absolute timestamp. The Feeder re-stamps with wall-clock time on every loop. Absolute
 * timestamps baked into the file would be wrong the moment it is replayed tomorrow, and the API's
 * staleness watchdog would reject every frame.
 *
 *   npx tsx scripts/exportSimFrames.ts [--minutes 30] [--out dotnet/data/replay]
 */

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SimulationEngine, type RawFrame, type SimulationCommand } from '../src/simulation/simulationEngine'
import { engineeringConfig } from '../src/config/engineeringConfig'

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const MINUTES = Number(arg('minutes', '30'))
const OUT_DIR = arg('out', join('dotnet', 'data', 'replay'))

if (!Number.isFinite(MINUTES) || MINUTES <= 0) {
  console.error(`--minutes must be a positive number, got "${arg('minutes', '')}"`)
  process.exit(1)
}

/** 100 ms. The same period the Feeder writes at and the API publishes at. */
const PERIOD_MS = engineeringConfig.simulationTickMs
const DT = PERIOD_MS / 1000
const FRAME_COUNT = Math.round((MINUTES * 60 * 1000) / PERIOD_MS)

// ---------------------------------------------------------------------------
// The command timeline
// ---------------------------------------------------------------------------

/**
 * [second, command]. Times are seconds from the start of the replay and are applied on the first
 * tick at or after that time.
 *
 * The shape of this timeline is what the replay actually demonstrates, so it is worth reading as
 * a script rather than as configuration:
 *
 *   0:02  START           — IDLE -> THREADING -> ROLLING, the mill accelerates to schedule speed
 *   2:00  speed trim      — an operator nudge, so MILL.SPEED.REF and ACTUAL diverge and re-converge
 *   4:00  THICKNESS_EXCURSION — pushes STRIP.THICKNESS.DEVIATION past tolerance and raises a
 *                            THICKNESS_DEVIATION alarm, then clears it. The alarm latching path
 *                            in the API has something real to latch.
 *   5:30  back to NORMAL
 *   7:00  roll gap trim   — moves the gap and therefore the force, exercising the force limits
 *   9:00  HIGH_FORCE      — drives ROLL.FORCE.ACTUAL into the warning band
 *  10:30  back to NORMAL
 *  12:00  STOP            — DECELERATING -> STOPPED, then the pass sequencer reverses and the
 *                            next pass starts on its own, which is the reversal the twin needs
 *  12:30  START           — resume for the remainder of the schedule
 *
 * Passes complete and reverse on their own between these points; the engine sequences that
 * internally once the payoff length runs out.
 */
const TIMELINE: Array<[number, SimulationCommand]> = [
  [2, { type: 'START' }],
  [120, { type: 'TRIM_SPEED_REFERENCE', value: 40 }],
  [240, { type: 'SET_SCENARIO', scenario: 'THICKNESS_EXCURSION' }],
  [330, { type: 'SET_SCENARIO', scenario: 'NORMAL' }],
  [420, { type: 'TRIM_ROLL_GAP', value: -0.05 }],
  [540, { type: 'SET_SCENARIO', scenario: 'HIGH_FORCE' }],
  [630, { type: 'SET_SCENARIO', scenario: 'NORMAL' }],
  [720, { type: 'STOP' }],
  [750, { type: 'START' }],
]

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const engine = new SimulationEngine()
const lines: string[] = []
const tagNames = new Set<string>()
const statusCounts = new Map<string, number>()

let nextCommand = 0

for (let n = 0; n < FRAME_COUNT; n++) {
  const elapsedS = (n * PERIOD_MS) / 1000

  while (nextCommand < TIMELINE.length && TIMELINE[nextCommand][0] <= elapsedS) {
    engine.command(TIMELINE[nextCommand][1])
    nextCommand++
  }

  const frame: RawFrame = engine.tick(DT)

  // COMMUNICATION_LOSS makes the simulated PLC stop publishing. A frame that the source would
  // not have produced must not appear in the file — the API's staleness watchdog is what should
  // notice the gap, exactly as it would with a real gateway that went quiet.
  if (!engine.isPublishing()) continue

  for (const key of Object.keys(frame)) tagNames.add(key)

  const status = String(frame['MILL.STATUS'] ?? 'UNKNOWN')
  statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)

  const diagnostics = engine.getDiagnostics()

  lines.push(
    JSON.stringify({
      n,
      dt: n * PERIOD_MS,
      solverIterations: diagnostics.solverIterations,
      gaugemeterResidualUm: diagnostics.gaugemeterResidualUm,
      v: frame,
    }),
  )
}

const jsonl = lines.join('\n') + '\n'
const sha256 = createHash('sha256').update(jsonl).digest('hex')

const manifest = {
  generatedAt: new Date().toISOString(),
  frameCount: lines.length,
  periodMs: PERIOD_MS,
  durationMs: lines.length * PERIOD_MS,
  tagCount: tagNames.size,
  tags: [...tagNames].sort(),
  timeline: TIMELINE.map(([at, cmd]) => ({ atSeconds: at, ...cmd })),
  statusHistogram: Object.fromEntries([...statusCounts.entries()].sort((a, b) => b[1] - a[1])),
  sha256,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'crm04-replay.jsonl'), jsonl, 'utf8')
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')

const mb = (jsonl.length / 1024 / 1024).toFixed(1)
console.log(`replay: ${lines.length} frames (${MINUTES} min at ${PERIOD_MS} ms), ${manifest.tagCount} tags, ${mb} MB`)
console.log(`  ${join(OUT_DIR, 'crm04-replay.jsonl')}`)
console.log(`  ${join(OUT_DIR, 'manifest.json')}`)
console.log(
  `  statuses: ` +
    [...statusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  '),
)

if (statusCounts.size < 3) {
  console.error(
    `\nWARNING: the replay only reached ${statusCounts.size} distinct mill status(es).\n` +
      `A replay that never changes state exercises almost nothing downstream — check the timeline.\n`,
  )
}
