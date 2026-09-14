/**
 * TWIN ANIMATION GATE.
 *
 * The 3D scene's damping and integration live in browser JavaScript
 * (dotnet/src/Crm04.Web/wwwroot/js/twin/engine.js), which puts them outside both the C# test
 * suite and the TypeScript one. They are also impossible to verify by looking: rendering under
 * software WebGL runs at about 1 fps, so pixel-diffing a headless screenshot proves nothing.
 *
 * What CAN be checked deterministically is the behaviour that would actually be wrong, and this
 * is where it is checked. The module is plain ESM with no three.js import, so Node can load it
 * directly - no browser, no bundler.
 *
 *   npx tsx scripts/checkTwinEngine.ts
 */

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const ENGINE = pathToFileURL(
  resolve('dotnet/src/Crm04.Web/wwwroot/js/twin/engine.js'),
).href

const { TwinEngine } = (await import(ENGINE)) as {
  TwinEngine: new (halfLife: number) => {
    visuals: Record<string, number | string | boolean | null>
    setTargets(t: Record<string, unknown>): void
    advance(nowSeconds: number): Record<string, number | string | boolean | null>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & { TwinEngine: { zeroTargets(): Record<string, unknown> } }

const failures: string[] = []
let checks = 0

function check(label: string, condition: boolean, detail = ''): void {
  checks++
  if (!condition) failures.push(`  ${label}${detail ? ` — ${detail}` : ''}`)
}

/** Run `frames` frames at 60 fps, starting from `t`. Returns the elapsed clock. */
function run(engine: { advance(t: number): unknown }, from: number, frames: number): number {
  let t = from
  for (let i = 0; i < frames; i++) {
    t += 1 / 60
    engine.advance(t)
  }
  return t
}

const ROLLING = {
  ...(TwinEngine as unknown as { zeroTargets(): Record<string, unknown> }).zeroTargets(),
  direction: 'FORWARD',
  directionSign: 1,
  stripSpeed: 180,
  entryStripSpeed: 138,
  wrRpm: 266,
  burRpm: 104,
  payoffRpm: 40,
  winderRpm: 90,
  rollGap: 2.15,
  stripThickness: 2.15,
  entryThickness: 2.81,
  stripWidth: 450,
  forceNormalised: 0.7,
  dtrRadius: 700,
  etrRadius: 900,
  porRadius: 900,
  bendingNormalised: null,
  animate: true,
  stale: false,
}

const engine = new TwinEngine(0.12)
engine.setTargets(ROLLING)

// Two seconds of animation.
let clock = run(engine, 0, 120)
const rolling = { ...engine.visuals } as Record<string, number>

// ---- Damping converges on the target ---------------------------------------------------------
check(
  'speed damps to its target within 2 s',
  Math.abs(rolling.stripSpeed - 180) < 0.5,
  `reached ${rolling.stripSpeed.toFixed(2)} of 180`,
)

// ---- Rotation integrates from the smoothed rpm -----------------------------------------------
check('work roll turns', rolling.wrAngle > 1, `wrAngle ${rolling.wrAngle.toFixed(2)} rad`)
check(
  'backup roll turns slower than the work roll',
  rolling.burAngle < rolling.wrAngle,
  `bur ${rolling.burAngle.toFixed(2)} vs wr ${rolling.wrAngle.toFixed(2)}`,
)

// ---- Mass flow is visible on screen (§8.1) ---------------------------------------------------
// The entry side must run slower than the exit side by the reduction ratio. Drawing both at one
// speed would put a contradiction of the mass-flow relation in the middle of the picture.
const travelRatio = rolling.stripTravelEntry / rolling.stripTravel
const thicknessRatio = ROLLING.stripThickness as number / (ROLLING.entryThickness as number)
check(
  'entry strip runs slower than exit strip',
  rolling.stripTravelEntry < rolling.stripTravel,
  `entry ${rolling.stripTravelEntry.toFixed(3)} m, exit ${rolling.stripTravel.toFixed(3)} m`,
)
check(
  'travel ratio matches the thickness ratio (mass flow)',
  Math.abs(travelRatio - thicknessRatio) < 0.01,
  `travel ${travelRatio.toFixed(4)} vs thickness ${thicknessRatio.toFixed(4)}`,
)

// ---- §7.4: no bending tag means no bend ------------------------------------------------------
check(
  'bending stays null rather than easing towards a number',
  rolling.bendingNormalised === null,
  `got ${String(rolling.bendingNormalised)}`,
)

// ---- A stale feed freezes the scene ----------------------------------------------------------
const frozenAngle = rolling.wrAngle
const frozenTravel = rolling.stripTravel
engine.setTargets({ ...ROLLING, animate: false, stale: true })
clock = run(engine, clock, 120)
const stale = { ...engine.visuals } as Record<string, number>

check('stale feed stops rotation dead', stale.wrAngle === frozenAngle)
check('stale feed stops strip travel dead', stale.stripTravel === frozenTravel)

// ---- Reversal flips the whole line -----------------------------------------------------------
engine.setTargets({ ...ROLLING, direction: 'REVERSE', directionSign: -1 })
clock = run(engine, clock, 120)
const reversed = { ...engine.visuals } as Record<string, number | string> as Record<string, number>

check(
  'direction sign crosses to reverse',
  reversed.directionSign < -0.9,
  `sign ${reversed.directionSign.toFixed(3)}`,
)
check('rotation unwinds after a reversal', reversed.wrAngle < stale.wrAngle)
check('strip travel unwinds after a reversal', reversed.stripTravel < stale.stripTravel)

// ---- A backgrounded tab must not teleport the scene ------------------------------------------
// A tab that loses focus hands back a multi-second delta on the first frame after it returns.
// Unclamped, that would spin the rolls through several turns at once and jump every damped value.
const jumpy = new TwinEngine(0.12)
jumpy.setTargets(ROLLING)
jumpy.advance(0.016)
const beforeJump = (jumpy.visuals as Record<string, number>).wrAngle
jumpy.advance(30)
const afterJump = (jumpy.visuals as Record<string, number>).wrAngle
check(
  'a 30 s frame delta is clamped rather than teleporting the scene',
  afterJump - beforeJump < 5,
  `advanced ${(afterJump - beforeJump).toFixed(2)} rad on one 30 s frame`,
)

// ---------------------------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\ntwin engine: ${failures.length} of ${checks} checks FAILED\n`)
  for (const f of failures) console.error(f)
  console.error('')
  process.exit(1)
}

console.log(`twin engine: ${checks}/${checks} checks passed`)
