# CRM04 Digital Twin — .NET port

ASP.NET Core Web API + Blazor Server, with Oracle as the source of process values.
The React app in `../src` stays as the reference implementation and is untouched.

## Status

| Milestone | State |
|---|---|
| **M0** Toolchain + solution skeleton | **done** |
| **M1** Domain port + parity gate | **done** |
| **M3** API + hubs + pipeline | **done** |
| **M2** Schema, persistence, Feeder | **written, never run** — no Oracle instance reachable yet, see below |
| **M4a** Blazor shell + ValueReadout + Dashboard | **done** — Tailwind design system wired (`App.razor` → `wwwroot/css/app.css`, built from `Styles/app.css` on every build) |
| **M5** Trends | **done** — `dashboard-trendspage` layout, browser + legend + CSV, same 8-pen cap; smooth time-based curves, time axis, hover cursor + tooltip (JS-only, no re-render) |
| **M6–M7** 3D twin | **done** — mill line, live binding, labels, camera presets; dock is SimulationControls (feed-status variant, commands disabled with reason) + full InterlockStatus + Alarms; overlay strip (status, commands, presets, zoom, labels/force, expand, trends) + equipment inspector. Verified in headless Chrome: zero console errors, WS connected, labels track live values, single WebGL context, context-loss auto-recovery |
| M8 Remaining panels | **done** — CoilDetails, EventTimeline, TagInventory, PlantConfig, FeedDiagnostics + DataIntegrity behind the MODEL / DATA dialog |
| M9 Hardening + handover | not started |

Three pages live at `/dashboard`, `/trends` and `/3d-twin` — the same routes the React app uses,
so a bookmark or a wall-display URL survives the port.

## Projects

```
Crm04.Domain          The React app's React-free core, ported. No package references at all.
                      Types, mill/engineering config, tag catalogue, MachineState projector,
                      alarm + interlock engines.
Crm04.Persistence     EF Core (migrations, low-rate entities) + ODP.NET (the 10 Hz frame path).
Crm04.Api             Web API + SignalR. Polls Oracle, projects, fans out.
Crm04.Web             Blazor Server. Does NOT reference Persistence — see below.
Crm04.Feeder          Worker service. The only process that writes into Oracle.
Crm04.Tools.Replay    Console harness. Drives the whole domain pipeline with no DB and no UI.
```

`Crm04.Web` must never reference `Crm04.Persistence`. If the web app could query Oracle it could
build a second `MachineState`, and the §4 rule that there is exactly one authoritative projection
would stop being structurally true.

## Prerequisites

- .NET 8 SDK (`dotnet --list-sdks` must show 8.0.4xx; pinned by `global.json`)
- Node 20+ for the export scripts and, from M4, the Tailwind/esbuild client build
- Oracle: connection string supplied via user-secrets or `ConnectionStrings__Crm04`. Never in
  `appsettings.json`. **Confirm the edition and whether Partitioning is licensed before M2** —
  the schema prefers index-organized tables (always available) and interval partitioning (not).

## Generated files — regenerate, never hand-edit

Three artefacts are generated from the TypeScript app. Hand-editing any of them puts the two
codebases out of step, which is precisely the failure the generators exist to prevent.

```bash
# From the repository root.
npm run export:all      # all three, in order

# Or individually:
npm run export:catalog  # 122 tags + 40 trend signals -> C# arrays + Oracle TAG_DEF seed
npm run export:replay   # ~54 MB, 30 min of mill time -> dotnet/data/replay/
npm run export:golden   # 720 parity cases -> tests/Crm04.Domain.Tests/golden/
```

`crm04-replay.jsonl` and `tag_definitions.sql` are gitignored — large and reproducible.
`TagCatalog.Generated.cs`, `SignalCatalog.Generated.cs` and `parity.jsonl` are committed, because
the build and the test gate need them without a Node toolchain present.

## Build and test

```bash
cd dotnet
dotnet build
dotnet test
```

**No internet on the build machine?** Every one of these commands restores from nuget.org first
and dies with `NU1301` if it cannot. See `offline/READ-ME-FIRST.txt`: drop the supplied
`*.nupkg` files in `dotnet/offline-packages/` and `offline/nuget.config` in `dotnet/`, and the
restore resolves locally. Node is not required either — `wwwroot/css/app.css` is committed and
the Tailwind step is `ContinueOnError` (`-p:SkipClientAssets=true` skips it outright).

`TreatWarningsAsErrors` is on solution-wide. The TypeScript app ships with zero errors under
`strict` and treats that as a release gate; the C# side keeps the same bar, and nullable reference
types are load-bearing here because `null` means "no tag on this feed" rather than zero.

## The parity gate

`tests/Crm04.Domain.Tests/ProjectionParityTests.cs` is the test that makes the port defensible.
It replays 240 captured frames × 3 operating modes through the C# pipeline and asserts, field by
field, that `TagFactory` → `MachineStateProjector` → `AlarmEngine` / `InterlockEngine` produce
exactly what the TypeScript produced — including alarm message strings character for character.

~2,950 assertions, and they are not decorative: the fixtures contain 252 raised alarms across
three rule families, 19% of state paths are null, and `millReady` differs by mode because the
degraded feeds genuinely lose their interlock tags.

If you change anything in `Crm04.Domain`, this is the test that tells you whether you changed
behaviour.

## Oracle

The connection string lives in **user-secrets**, never in `appsettings.json`:

```bash
dotnet user-secrets --project src/Crm04.Feeder set "ConnectionStrings:Crm04" "<string>"
dotnet user-secrets --project src/Crm04.Api    set "ConnectionStrings:Crm04" "<string>"
```

In deployment, use the `ConnectionStrings__Crm04` environment variable instead.

### Bring the schema up

```bash
dotnet run --project src/Crm04.Feeder -- --check-db     # what is this database, what may we do
dotnet run --project src/Crm04.Feeder -- --apply-ddl    # create the schema + seed TAG_DEF
dotnet run --project src/Crm04.Feeder                   # start writing at 10 Hz
```

The API reads it with `Source:Kind` = `Oracle`, which is what `src/Crm04.Api/appsettings.json`
ships. In Development, `appsettings.Development.json` overrides that to `Replay`; set
`Source__Kind=Oracle` to develop against this database instead.

`--check-db` reports the banner, schema, whether Partitioning is licensed, the privileges the
session holds and the free space — run it first on any new environment. The schema branches on
Partitioning, and finding out after writing migrations is a slow way to learn.

Other commands: `--seed-only` (refresh TAG_DEF alone), `--drop-all --yes` (destroy everything;
the second flag is required so it cannot happen from a shell history).

### Schema shape, and why

108 tags × 10 Hz is **1,080 rows/s, ~93M rows/day, ~155 MB/hour**. Three access patterns want
three different physical structures, so there are three:

| Table | Shape | Because |
|---|---|---|
| `TAG_SAMPLE` | **index-organized**, PK `(FRAME_ID, TAG_ID)`, interval-partitioned | one frame's 108 rows are physically contiguous — reading a frame is one range scan with **zero** table lookups |
| `CURRENT_TAG` | 122 rows, IOT, MERGE'd per frame | a new client gets a full snapshot without hunting for the latest frame |
| `TREND_SAMPLE` | pre-bucketed 1 s / 5 s / 15 s, IOT | **the trend page never touches the 10 Hz table** — a 1-hour chart is ≤240 rows, not 36,000 |

The last two are derived caches maintained by the writer, not a second source of truth — the
same relationship `telemetryStore` has to `machineStore` in the React app.

**`VAL_KIND` is how the null semantics survive the database**, and it is the single easiest
thing here to get wrong:

| Situation | Encoding |
|---|---|
| numeric / boolean / string | `'N'` / `'B'` / `'S'` |
| tag is on the feed and reads **nothing** | `'X'`, both value columns NULL |
| feed has **no such tag** | **no row at all** |

Both render as a dash, but they are different statements about the mill — "instrument down"
versus "not instrumented" — and an encoding that collapsed them would break §7.4 silently.

`NUM_VALUE` is `BINARY_DOUBLE`, not `NUMBER`: IEEE-754, so a value is bit-identical to the C#
double and the JavaScript number it came from. `NUMBER` is decimal and would round.

### Retention

Partitioning is licensed on this database, so retention is a **metadata operation**: `FRAME` and
`TAG_SAMPLE` are interval-partitioned on `FRAME_ID` with identical 36,000-frame boundaries (one
hour at 10 Hz), and one cutoff drops matching partitions from both. Instant, no redo storm, never
blocks the writer.

That shared partition key is also why there is deliberately **no foreign key** between them: an
enabled FK would refuse to let the parent partition go. Both are written in one transaction, so
the relationship holds by construction.

Default window is 2 hours (`Retention:Hours`) — about 7.8M rows / 310 MB, flat.

## Running it on localhost

**The delivered twin is LIVE-only.** There is no operating-mode selector anywhere in the UI. The
source is chosen by `Source:Kind`, which is required and fails fast — an unset or unrecognised
value refuses to start. `Oracle` is the plant path. `Replay`, the simulator dataset, is **refused
outside Development**, so no configuration mistake on the plant server can put simulated values on
screen. The Feeder applies the same rule, with `OpcUa` as its plant source.

On a development machine with no plant connection, two terminals run the replay:

```bash
cd dotnet
dotnet run --project src/Crm04.Api    # http://localhost:5200   (swagger at /)   Development → Replay
dotnet run --project src/Crm04.Web    # http://localhost:5240   <- open this
```

The API logs `REPLAY SOURCE SELECTED` at Warning and every value is badged **SIM**. Until a frame
from the current connection has arrived — API down, API restarted, feed not delivering — every page
shows **NO FEED** and draws no mill, rather than placeholder or remembered values that would read as
a real, idle mill.

### What the live feed will show

A value's badge is earned by the data, never chosen: it follows the mode its source declared,
recorded in `FRAME.OP_MODE`. `Replay:Mode` must stay `SIMULATION` — `LIVE` is refused for a replay,
because it would present simulator output as plant measurements with GOOD quality.

| | Development replay | Plant feed |
|---|---|---|
| Badges on screen | 20 SIM, 11 CALC, 7 REF | 6 LIVE, 13 CALC, 6 REF, 1 EST, **12 NO TAG** |
| Roll force | SIM | **EST** — no force transducer; estimated from torque |
| Roll gap S0, OS, DS, tilt | SIM | **NO TAG** — no HAGC/LVDT position tag |
| Hydraulics, WR bending | SIM | **NO TAG** — not in the 6-month extract |
| Interlock chain | MILL READY | **MILL READY UNVERIFIED** |

That last row is the one to look at. The mill is held either way, but the reason line reads
*"EMERGENCY STOP STATUS — NO TAG ON THIS FEED"*, and the panel says UNVERIFIED in amber rather
than NOT READY in red. Nothing on that feed can confirm the interlocks either way, and §13.2
forbids pretending otherwise.

### Useful endpoints

```
GET  /api/diagnostics/feed     source, publish rate, frame age, pipeline p50/p99
GET  /api/state                the mill summary
GET  /api/tags                 the 122-tag catalogue with provenance resolved for the mode
GET  /api/telemetry/latest     the full envelope for one instant
GET  /api/interlocks           the chain, with the §13.2 readout
GET  /api/trends/catalog       the 40 trend signals and 5 windows
GET  /api/trends?signals=&window=   up to 8 series, <=240 points each
GET  /api/config/mill          every mill dimension - the 3D scene builds itself from this
HUB  /hubs/telemetry           10 Hz push to the Blazor server process
WS   /ws/twin                  10 Hz push to the browser's 3D scene
```

## The 3D twin

The scene is vanilla three.js in `wwwroot/js/twin/`, driven from `/ws/twin`. The two decisions
that make it work under Blazor:

**The scene does not go through Blazor.** The obvious approach — JS interop per value — would be
108 tags × 10 Hz = 1,080 marshalled calls a second, each a JSON serialise plus a circuit message.
Instead the JS module opens its own socket and receives `TwinTargets`: about 22 numbers, ~180
bytes. **There are zero interop calls on the frame path.** Blazor only calls `init`, `dispose`,
and the camera/toggle buttons.

**Damping runs in the browser, not the server.** The feed is 10 Hz and the scene renders at 60.
Damping server-side would deliver six identical frames then a step — visible stepping. So the
server sends targets and the scene chases them at render rate.

three.js is **vendored** into `wwwroot/js/vendor/` (v0.175, copied from the React app's own
`node_modules`) with an import map in `App.razor`. No CDN: this has to run on an isolated plant
network.

### What is verified

```bash
npm run check:twin      # 12 checks on the animation engine, no browser needed
```

Rendering under software WebGL runs at about 1 fps, so pixel-diffing a headless screenshot proves
nothing. What is checked instead is the behaviour that could actually be wrong: damping converges,
rotation integrates from the smoothed rpm, **the entry strip runs slower than the exit strip by
exactly the thickness ratio** (§8.1, visible on screen), a stale feed freezes everything dead, a
reversal unwinds the rotation, bending stays `null` rather than easing toward a fabricated bend,
and a 30-second frame delta from a backgrounded tab is clamped rather than teleporting the scene.

Separately verified by hand: navigating twin → dashboard → twin **20 times leaves exactly one
canvas and one live WebGL context**. That is the #1 Blazor + three.js production bug — browsers
cap contexts at about 16, so a page leaking one per visit dies silently on the sixteenth
navigation.

## Running the M1 demo

No database and no UI — the domain pipeline driven straight from the replay file:

```bash
dotnet run --project src/Crm04.Tools.Replay -- --speed 5
dotnet run --project src/Crm04.Tools.Replay -- --speed 5 --mode LIVE
```

Run both. The difference is the point of the whole provenance contract:

```
SIMULATION   gap 1.652   hyd  89   bend 320   READY
LIVE         gap     —   hyd   —   bend   —   HELD
```

In `LIVE` the roll-gap position, hydraulic pressure and roll-bending force render as `—`, because
the real CRM04 6-month extract has no HAGC/LVDT tag, no pressure tag and no bending tag (§7.4).
The mill is held not-ready — and the interlock panel will say **MILL READY UNVERIFIED**, not
*MILL NOT READY*, because nothing on that feed can confirm the interlocks either way.

Options: `--speed` (1 is real time), `--frames`, `--mode`, `--file`.

## Notes on the port

- **The physics is not ported.** `src/simulation/*` stays in TypeScript. Oracle supplies process
  values; the Feeder replays a dataset the TypeScript simulator produced. The `IFrameSource` seam
  in the Feeder is where a real OPC UA gateway replaces it.
- **`JsNumber`** reimplements JavaScript's `toFixed` and `Number::toString` exactly, using
  `BigInteger` for the former. .NET's `ToString("F0")`/`"R"` are *not* the same functions, and
  alarm message text is compared character for character by the parity gate.
- **Two panels shrink** because there is no mill to command and no solver to validate:
  `SimulationControls` becomes a read-only feed status panel, and `ValidationPanel` becomes a
  data-integrity panel.
