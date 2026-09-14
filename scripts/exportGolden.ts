/**
 * GOLDEN PARITY FIXTURES — TypeScript output captured for the C# port to be tested against.
 *
 * This is the single most valuable artefact in the .NET migration. The physics is not being
 * ported, but everything between the raw tag values and the screen IS: `makeTag`,
 * `projectMachineState`, `evaluateAlarms`, `evaluateInterlocks`. Those four functions decide what
 * every number on every screen means, and a subtly wrong port of them produces an application
 * that looks completely correct and is quietly lying.
 *
 * So this script runs the real TypeScript pipeline over sampled replay frames, in all three
 * operating modes, and writes the results. `ProjectionParityTests` then runs the C# port over the
 * same inputs and asserts the same outputs.
 *
 * THE OUTPUT IS A FLAT PATH MAP, not a nested object. "tension.dtr.role" -> "PAYOFF" rather than
 * a tree. Two reasons: comparison is order-independent and trivially exact, and when a test fails
 * it names the one field that differs instead of dumping two 300-line objects side by side.
 *
 * Values round-trip as IEEE-754 doubles through JSON, so the comparison is bit-exact and the
 * tolerance in the C# test is generosity rather than necessity.
 *
 *   npx tsx scripts/exportGolden.ts [--every 75] [--in dotnet/data/replay] [--out ...]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { projectMachineState, type AdapterContext } from '../src/communication/dataAdapter'
import { evaluateAlarms } from '../src/machine/alarmEngine'
import { evaluateInterlocks } from '../src/machine/interlockEngine'
import { makeTag } from '../src/data/tagMap'
import type { OperatingMode } from '../src/types/machine'
import type { Tag, TagFrame, TagValue } from '../src/types/tags'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const EVERY = Number(arg('every', '75'))
const IN_DIR = arg('in', join('dotnet', 'data', 'replay'))
const OUT = arg('out', join('dotnet', 'tests', 'Crm04.Domain.Tests', 'golden', 'parity.jsonl'))

const MODES: OperatingMode[] = ['SIMULATION', 'SIM_46TAG', 'LIVE']

// ---------------------------------------------------------------------------
// Flattening
// ---------------------------------------------------------------------------

type Leaf = number | string | boolean | null

/**
 * Depth-first flatten to "a.b.c" -> leaf.
 *
 * `undefined` becomes null: the TypeScript uses optional properties in a couple of places where
 * the C# uses a nullable, and for the purposes of "what does the UI see" they are the same
 * statement. Arrays are indexed numerically, which only the interlock node list uses.
 */
function flatten(value: unknown, prefix: string, into: Record<string, Leaf>): void {
  if (value === null || value === undefined) {
    into[prefix] = null
    return
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    into[prefix] = value
    return
  }
  if (Array.isArray(value)) {
    into[`${prefix}.length`] = value.length
    value.forEach((v, i) => flatten(v, `${prefix}.${i}`, into))
    return
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    flatten(v, prefix ? `${prefix}.${k}` : k, into)
  }
}

function flattenRoot(value: unknown): Record<string, Leaf> {
  const out: Record<string, Leaf> = {}
  flatten(value, '', out)
  return out
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

interface ReplayRecord {
  n: number
  dt: number
  solverIterations: number
  gaugemeterResidualUm: number
  v: Record<string, TagValue>
}

const replayPath = join(IN_DIR, 'crm04-replay.jsonl')
let raw: string
try {
  raw = readFileSync(replayPath, 'utf8')
} catch {
  console.error(
    `\ncannot read ${replayPath}\n` +
      `Run the replay export first:  npx tsx scripts/exportSimFrames.ts\n`,
  )
  process.exit(1)
}

const records: ReplayRecord[] = raw
  .split('\n')
  .filter((l) => l.length > 0)
  .map((l) => JSON.parse(l) as ReplayRecord)

// ---------------------------------------------------------------------------
// Run the pipeline
// ---------------------------------------------------------------------------

const out: string[] = []
let caseCount = 0

for (const rec of records) {
  if (rec.n % EVERY !== 0) continue

  for (const mode of MODES) {
    // A deterministic comm state. The real one is owned by the frame watcher and depends on
    // wall-clock arrival times, which cannot be captured in a fixture — so the fixture pins it
    // and the test supplies exactly the same values.
    const communication = {
      connected: true,
      sourceName: 'replay',
      lastFrameTimestamp: rec.dt,
      lastValidTimestamp: rec.dt,
      ageMs: 100,
      stale: false,
      updateRateHz: 10,
      framesReceived: rec.n + 1,
    }

    const ctx: AdapterContext = {
      mode,
      communication,
      diagnostics: {
        solverIterations: rec.solverIterations,
        gaugemeterResidualUm: rec.gaugemeterResidualUm,
      },
    }

    const tags: TagFrame = {}
    for (const [name, value] of Object.entries(rec.v)) {
      tags[name] = makeTag(name, value, { timestamp: rec.dt, mode })
    }

    const state = projectMachineState(tags, ctx)
    const alarms = evaluateAlarms(state)
    const chain = evaluateInterlocks({
      driveReady: state.interlocks.drive,
      hydraulicReady: state.interlocks.hydraulic,
      tensionReady: state.interlocks.tension,
      gaugeReady: state.interlocks.gauge,
      emergencyStop: state.interlocks.emergencyStop,
      fastStop: state.machineStatus === 'FAST_STOP',
      communicationHealthy: communication.connected && !communication.stale,
    })

    // Tag-level expectations: the four fields makeTag decides. The value itself is included
    // because an UNAVAILABLE tag must have had its value discarded, and that is exactly the
    // rule most likely to be lost in translation.
    const tagExpectations: Record<string, [TagValue, string, string, string]> = {}
    for (const [name, tag] of Object.entries(tags) as Array<[string, Tag]>) {
      tagExpectations[name] = [tag.value, tag.quality, tag.status, tag.provenance]
    }

    out.push(
      JSON.stringify({
        n: rec.n,
        dt: rec.dt,
        mode,
        solverIterations: rec.solverIterations,
        gaugemeterResidualUm: rec.gaugemeterResidualUm,
        raw: rec.v,
        tags: tagExpectations,
        state: flattenRoot(state),
        alarms: alarms.map((a) => flattenRoot(a)),
        interlocks: flattenRoot(chain),
      }),
    )
    caseCount++
  }
}

mkdirSync(join(OUT, '..'), { recursive: true })
writeFileSync(OUT, out.join('\n') + '\n', 'utf8')

const frames = caseCount / MODES.length
const statePaths = Object.keys(flattenRoot(JSON.parse(out[0]).state ?? {})).length
console.log(`golden: ${caseCount} cases (${frames} frames x ${MODES.length} modes)`)
console.log(`  ${OUT}`)
console.log(`  ${statePaths} state paths per case, sampled every ${EVERY} frames of ${records.length}`)
