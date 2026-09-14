/**
 * TAG CATALOGUE EXPORT — TypeScript to C# and SQL.
 *
 * `src/data/tagDefinitions.ts` is the single source of truth for the tag catalogue. The .NET
 * port needs the same 122 records in two more places: a C# array the domain compiles against,
 * and an Oracle seed script for TAG_DEF. Hand-typing either would guarantee drift, so both are
 * generated from the TypeScript definition and this script is the only writer of both files.
 *
 * ORDINALS ARE LOAD-BEARING. The compact frame DTO sent over SignalR is an array indexed by
 * ordinal rather than a map keyed by tag name — that is what takes a 10 Hz frame from ~9 KB to
 * ~1.4 KB. The ordinal is the array index here, and it is written into both outputs, so the C#
 * catalogue and the TAG_DEF table cannot disagree about which slot a tag occupies. Reordering
 * `tagDefinitions` shifts every ordinal, which is why the API asserts catalogue ordinals against
 * TAG_DEF at startup rather than trusting them.
 *
 *   npx tsx scripts/exportTagCatalog.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { tagDefinitions } from '../src/data/tagDefinitions'
import type { Provenance, LiveAvailability, TagDefinition } from '../src/types/tags'
import { SIGNALS } from '../src/store/telemetryStore'
import { TREND_WINDOWS } from '../src/types/telemetry'
import { demoPassSchedule } from '../src/data/demoPassSchedule'

const CS_OUT = join('dotnet', 'src', 'Crm04.Domain', 'Tags', 'TagCatalog.Generated.cs')
const SQL_OUT = join('dotnet', 'db', 'seed', 'tag_definitions.sql')
const SIGNALS_OUT = join('dotnet', 'src', 'Crm04.Domain', 'Telemetry', 'SignalCatalog.Generated.cs')

/** Oracle column widths from db/ddl/01_tables.sql. Exceeding one is a hard error, not a truncation. */
const WIDTH = { TAG_NAME: 64, DESCRIPTION: 256, UNIT: 16, LIVE_NOTE: 1000 } as const

// ---------------------------------------------------------------------------
// Validation. A catalogue that cannot be represented downstream is a build failure.
// ---------------------------------------------------------------------------

const problems: string[] = []
const seen = new Set<string>()

for (const [i, d] of tagDefinitions.entries()) {
  if (seen.has(d.tagName)) problems.push(`duplicate tag name at index ${i}: ${d.tagName}`)
  seen.add(d.tagName)

  if (d.tagName.length > WIDTH.TAG_NAME) {
    problems.push(`tag name exceeds VARCHAR2(${WIDTH.TAG_NAME}): ${d.tagName}`)
  }
  if (d.description.length > WIDTH.DESCRIPTION) {
    problems.push(`description exceeds VARCHAR2(${WIDTH.DESCRIPTION}) for ${d.tagName}`)
  }
  if (d.unit !== undefined && d.unit.length > WIDTH.UNIT) {
    problems.push(`unit exceeds VARCHAR2(${WIDTH.UNIT}) for ${d.tagName}: "${d.unit}"`)
  }
  if (d.liveNote !== undefined && d.liveNote.length > WIDTH.LIVE_NOTE) {
    problems.push(
      `liveNote exceeds VARCHAR2(${WIDTH.LIVE_NOTE}) for ${d.tagName} (${d.liveNote.length} chars)`,
    )
  }
}

if (problems.length > 0) {
  console.error(`\ntag catalogue cannot be exported (${problems.length} problem(s)):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * A C# double literal that round-trips the JavaScript number exactly.
 *
 * `String(n)` gives the shortest representation that parses back to the same IEEE-754 double,
 * which is precisely what C#'s "R"/shortest-round-trip parser reads back. The `d` suffix stops
 * the C# compiler treating an integral literal as an `int`, which would change
 * `millConfig.ratings.maxRollingForce * 0.8` into integer arithmetic at the limit boundaries.
 */
function csDouble(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`refusing to emit non-finite limit: ${n}`)
  return `${String(n)}d`
}

function csString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function csNullableString(s: string | undefined): string {
  return s === undefined ? 'null' : csString(s)
}

function csNullableInt(n: number | undefined): string {
  return n === undefined ? 'null' : String(n)
}

/** TypeScript screaming-snake union member to the C# enum member name. */
function csEnum(kind: 'Provenance' | 'LiveAvailability', v: Provenance | LiveAvailability): string {
  const member = v.charAt(0) + v.slice(1).toLowerCase()
  return `${kind}.${member}`
}

/** `TagLimits` positional record, or `TagLimits.None` when the TS definition had no limits. */
function csLimits(d: TagDefinition): string {
  const l = d.limits
  if (!l) return 'TagLimits.None'

  const parts: string[] = []
  if (l.low !== undefined) parts.push(`Low: ${csDouble(l.low)}`)
  if (l.high !== undefined) parts.push(`High: ${csDouble(l.high)}`)
  if (l.warningLow !== undefined) parts.push(`WarningLow: ${csDouble(l.warningLow)}`)
  if (l.warningHigh !== undefined) parts.push(`WarningHigh: ${csDouble(l.warningHigh)}`)
  if (l.alarmLow !== undefined) parts.push(`AlarmLow: ${csDouble(l.alarmLow)}`)
  if (l.alarmHigh !== undefined) parts.push(`AlarmHigh: ${csDouble(l.alarmHigh)}`)
  if (l.tripHigh !== undefined) parts.push(`TripHigh: ${csDouble(l.tripHigh)}`)

  return parts.length === 0 ? 'TagLimits.None' : `new TagLimits(${parts.join(', ')})`
}

function sqlString(s: string | undefined): string {
  return s === undefined ? 'NULL' : `'${s.replace(/'/g, "''")}'`
}

function sqlNumber(n: number | undefined): string {
  if (n === undefined) return 'NULL'
  if (!Number.isFinite(n)) throw new Error(`refusing to emit non-finite limit: ${n}`)
  return String(n)
}

// ---------------------------------------------------------------------------
// C# output
// ---------------------------------------------------------------------------

const csRecords = tagDefinitions
  .map((d, ordinal) => {
    const lines = [
      `        new TagDefinition(`,
      `            TagName: ${csString(d.tagName)},`,
      `            Description: ${csString(d.description)},`,
      `            Unit: ${csNullableString(d.unit)},`,
      `            SimulationProvenance: ${csEnum('Provenance', d.simulationProvenance)},`,
      `            LiveAvailability: ${csEnum('LiveAvailability', d.liveAvailability)},`,
      `            LiveNote: ${csNullableString(d.liveNote)},`,
      `            Limits: ${csLimits(d)},`,
      `            Decimals: ${csNullableInt(d.decimals)},`,
      `            Ordinal: ${ordinal}),`,
    ]
    return lines.join('\n')
  })
  .join('\n')

const cs = `// <auto-generated>
//     GENERATED FILE - DO NOT EDIT BY HAND.
//
//     Source:    src/data/tagDefinitions.ts
//     Generator: scripts/exportTagCatalog.ts
//     Regenerate with:  npx tsx scripts/exportTagCatalog.ts
//
//     Editing this file by hand puts the C# catalogue out of step with the TypeScript
//     definition and with db/seed/tag_definitions.sql, which is generated from the same
//     source in the same run. Change tagDefinitions.ts and regenerate instead.
// </auto-generated>

using Crm04.Domain.Types;

namespace Crm04.Domain.Tags;

/// <summary>
/// The ${tagDefinitions.length} tag definitions, in ordinal order. The array index IS the wire
/// ordinal and matches TAG_DEF.ORDINAL in Oracle.
/// </summary>
internal static class TagCatalogData
{
    internal static readonly TagDefinition[] All =
    [
${csRecords}
    ];
}
`

// ---------------------------------------------------------------------------
// SQL output
// ---------------------------------------------------------------------------

const sqlRows = tagDefinitions
  .map((d, ordinal) => {
    const cols = [
      sqlString(d.tagName),
      sqlString(d.description),
      sqlString(d.unit),
      sqlString(d.simulationProvenance),
      sqlString(d.liveAvailability),
      sqlString(d.liveNote),
      sqlNumber(d.decimals),
      sqlNumber(d.limits?.low),
      sqlNumber(d.limits?.high),
      sqlNumber(d.limits?.warningLow),
      sqlNumber(d.limits?.warningHigh),
      sqlNumber(d.limits?.alarmLow),
      sqlNumber(d.limits?.alarmHigh),
      sqlNumber(d.limits?.tripHigh),
      String(ordinal),
    ]
    return (
      `INSERT INTO TAG_DEF (TAG_NAME, DESCRIPTION, UNIT, SIM_PROVENANCE, LIVE_AVAILABILITY,\n` +
      `                     LIVE_NOTE, DECIMALS, LIM_LOW, LIM_HIGH, LIM_WARN_LOW, LIM_WARN_HIGH,\n` +
      `                     LIM_ALARM_LOW, LIM_ALARM_HIGH, LIM_TRIP_HIGH, ORDINAL)\n` +
      `VALUES (${cols.join(', ')});`
    )
  })
  .join('\n\n')

const sql = `-- =====================================================================
-- TAG_DEF SEED - GENERATED FILE, DO NOT EDIT BY HAND.
--
--   Source:    src/data/tagDefinitions.ts
--   Generator: scripts/exportTagCatalog.ts
--   Regenerate with:  npx tsx scripts/exportTagCatalog.ts
--
-- ${tagDefinitions.length} tags. ORDINAL is the wire position used by the compact frame DTO and
-- MUST match the C# TagCatalog, which is generated from the same source in the same run.
--
-- Idempotent: the DELETE makes a re-run replace the catalogue rather than fail on the
-- TAG_NAME unique constraint. TAG_SAMPLE has a foreign key to TAG_DEF, so run this against
-- an empty sample table or expect the delete to be refused - which is the correct outcome,
-- because renumbering ordinals under live data would misalign every stored frame.
-- =====================================================================

DELETE FROM TAG_DEF;

${sqlRows}

COMMIT;
`

// ---------------------------------------------------------------------------
// Signal catalogue — the trend series the UI offers.
//
// Generated for the same reason as the tag catalogue: 40 descriptors, each with a colour, a
// precision and an owning tag, and every one of them has to agree with the TypeScript or the
// two front ends draw different charts from the same data. The `tagName` is the load-bearing
// field — it is how a chart series inherits its provenance badge, so a signal pointing at a tag
// that does not exist would silently draw an unlabelled line.
// ---------------------------------------------------------------------------

const signalProblems = SIGNALS
  .filter((s) => !tagDefinitions.some((d) => d.tagName === s.tagName))
  .map((s) => `signal '${s.key}' names tag '${s.tagName}', which is not in the catalogue`)

if (signalProblems.length > 0) {
  console.error(`\nsignal catalogue cannot be exported (${signalProblems.length} problem(s)):\n`)
  for (const p of signalProblems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

const signalRecords = SIGNALS
  .map((s, ordinal) =>
    [
      `        new SignalDescriptor(`,
      `            Key: ${csString(s.key)},`,
      `            Label: ${csString(s.label)},`,
      `            Unit: ${csString(s.unit)},`,
      `            Color: ${csString(s.color)},`,
      `            Decimals: ${s.decimals},`,
      `            Group: ${csString(s.group)},`,
      `            TagName: ${csString(s.tagName)},`,
      `            IsReference: ${s.isReference === true ? 'true' : 'false'},`,
      `            Ordinal: ${ordinal}),`,
    ].join('\n'),
  )
  .join('\n')

const windowRecords = Object.entries(TREND_WINDOWS)
  .map(([key, ms]) => `        new TrendWindow(${csString(key)}, ${ms}),`)
  .join('\n')

const signalsCs = `// <auto-generated>
//     GENERATED FILE - DO NOT EDIT BY HAND.
//
//     Source:    src/store/telemetryStore.ts (SIGNALS), src/types/telemetry.ts (TREND_WINDOWS)
//     Generator: scripts/exportTagCatalog.ts
//     Regenerate with:  npx tsx scripts/exportTagCatalog.ts
// </auto-generated>

namespace Crm04.Domain.Telemetry;

/// <summary>
/// The ${SIGNALS.length} trend signals and the ${Object.keys(TREND_WINDOWS).length} windows the UI offers.
/// </summary>
internal static class SignalCatalogData
{
    internal static readonly SignalDescriptor[] Signals =
    [
${signalRecords}
    ];

    internal static readonly TrendWindow[] Windows =
    [
${windowRecords}
    ];
}
`

// ---------------------------------------------------------------------------
// Pass schedule.
//
// Static demo data, but generated rather than transcribed for the same reason as the catalogues:
// the forces and reductions in it are DERIVED in demoPassSchedule.ts from the raw thicknesses, so
// hand-copying the numbers would freeze a computation and let it drift the moment the derivation
// changed. The panel labels it a representative schedule, not a production coil.
// ---------------------------------------------------------------------------

const SCHEDULE_OUT = join('dotnet', 'src', 'Crm04.Domain', 'Coils', 'PassSchedule.Generated.cs')

const c = demoPassSchedule.coil
const passRecords = demoPassSchedule.passes
  .map(
    (p) =>
      `        new PassScheduleEntry(${p.pass}, RollingDirection.${p.direction === 'FORWARD' ? 'Forward' : 'Reverse'}, ` +
      `${csDouble(p.inputThickness)}, ${csDouble(p.outputThickness)}, ${csDouble(p.reduction)}, ` +
      `${csDouble(p.speedReference)}, ${csDouble(p.entrySpecificTension)}, ${csDouble(p.exitSpecificTension)}, ` +
      `${csDouble(p.predictedForce)}),`,
  )
  .join('\n')

const scheduleCs = `// <auto-generated>
//     GENERATED FILE - DO NOT EDIT BY HAND.
//
//     Source:    src/data/demoPassSchedule.ts
//     Generator: scripts/exportTagCatalog.ts
//     Regenerate with:  npx tsx scripts/exportTagCatalog.ts
// </auto-generated>

using Crm04.Domain.Types;

namespace Crm04.Domain.Coils;

/// <summary>
/// The demo coil and its ${demoPassSchedule.passes.length}-pass schedule, ${csString(demoPassSchedule.source)}.
///
/// A REPRESENTATIVE schedule, not a production coil - the panel says so. Reductions and predicted
/// forces are derived in the TypeScript from the raw thicknesses, so they are generated here
/// rather than copied.
/// </summary>
internal static class PassScheduleData
{
    internal static readonly CoilData Coil = new(
        Id: ${csString(c.id)},
        Grade: ${csString(c.grade ?? '')},
        Width: ${csDouble(c.width)},
        EntryThickness: ${csDouble(c.entryThickness)},
        FinalThickness: ${csDouble(c.finalThickness)},
        Mass: ${csDouble(c.mass)},
        InnerDiameter: ${csDouble(c.innerDiameter)},
        OuterDiameter: ${csDouble(c.outerDiameter)});

    internal const string Source = ${csString(demoPassSchedule.source)};

    internal static readonly PassScheduleEntry[] Passes =
    [
${passRecords}
    ];
}
`

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

for (const [path, contents] of [
  [CS_OUT, cs],
  [SQL_OUT, sql],
  [SIGNALS_OUT, signalsCs],
  [SCHEDULE_OUT, scheduleCs],
] as const) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
}

const byAvailability = new Map<string, number>()
for (const d of tagDefinitions) {
  byAvailability.set(d.liveAvailability, (byAvailability.get(d.liveAvailability) ?? 0) + 1)
}

console.log(`tag catalogue: ${tagDefinitions.length} tags exported`)
console.log(`  ${CS_OUT}`)
console.log(`  ${SQL_OUT}`)
console.log(`signal catalogue: ${SIGNALS.length} signals, ${Object.keys(TREND_WINDOWS).length} windows`)
console.log(`  ${SIGNALS_OUT}`)
console.log(
  `  live availability: ` +
    [...byAvailability.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  '),
)
