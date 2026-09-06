# Architecture

## The one rule everything else serves

> §4: the twin and the UI must never hold independent copies of a process value.
> There is exactly **one** authoritative `MachineState` object.

Three structural decisions make that true rather than merely intended:

1. **`communication/dataAdapter.ts` is the only constructor of `MachineState`.**
   Every field is read from a `Tag`. Nothing in the adapter recomputes physics
   and nothing invents a fallback number. Where a tag is absent, the field is
   `null` — not `0`.

2. **`components/common/ValueReadout.tsx` is the only component allowed to print
   a process value, and it takes a tag name rather than a number.** A component
   cannot render a value without also rendering where that value came from.

3. **`machine/twinEngine.ts` is the only bridge from `MachineState` to the 3D
   scene.** No scene component reads the store directly for a process value, and
   none computes its own rate. The 3D label, the KPI module and the trend chart
   read the same tag object.

The consequence: the "value beside the machine == MachineState == trend chart"
requirement of §18 is not something a reviewer has to check by inspection. There
is one path, and the VALIDATION page checks it live.

---

## Layers

```
                    ┌────────────────────────────────────────────┐
  SIMULATION        │  src/simulation                            │
  EQUATIONS         │  rollingModel · forceModel · thicknessModel│
                    │  driveModel · tensionModel · coilModel     │
                    │  simulationEngine · simulationScenarios    │
                    │  Pure physics. No React, no tags, no UI.   │
                    └───────────────────┬────────────────────────┘
                                        │ raw tag frame
                    ┌───────────────────▼────────────────────────┐
  COMMUNICATION     │  src/communication                         │
                    │  dataSource (interface)                    │
                    │  simulationDataSource · websocketClient    │
                    │  opcUaAdapter (integration plan)           │
                    │  dataAdapter  ← THE ONLY MachineState ctor │
                    └───────────────────┬────────────────────────┘
                                        │ MachineState + TagFrame
                    ┌───────────────────▼────────────────────────┐
  MACHINE STATE     │  src/machine · src/store                   │
                    │  machineStateMachine · reversingEngine     │
                    │  interlockEngine · alarmEngine             │
                    │  rollingEngine (derived KPIs)              │
                    │  twinEngine (state → visuals)              │
                    │  machineStore · alarmStore · telemetryStore│
                    └───────────────────┬────────────────────────┘
                                        │ selectors / imperative subscription
                    ┌───────────────────▼────────────────────────┐
  RENDERING         │  src/components                            │
                    │  digitalTwin · dashboard · panels · charts │
                    │  Reads state. Computes nothing.            │
                    └────────────────────────────────────────────┘
```

### Why the simulation emits a *tag frame*

The simulation engine does not produce a `MachineState`. It produces a
`Record<tagName, value>` — exactly what a PLC gateway produces. Everything
downstream of that point is identical whether the source is the simulator, a
WebSocket gateway or a historian replay. That is what makes §14.1's "the UI must
not know where data originates" true, and it is what makes the SIM · 46-TAG mode
a genuine rehearsal for the live feed rather than a different code path.

---

## Folder structure

```
src/
├── app/              App.tsx, ErrorBoundary.tsx
├── components/
│   ├── dashboard/    Dashboard, Header, KPIBar, ConnectionStatus,
│   │                 DirectionIndicator
│   ├── digitalTwin/  DigitalTwin, TwinContext, TwinOverlay, MillStand,
│   │                 WorkRoll, BackupRoll, Strip, Coiler, Gauge,
│   │                 HydraulicSystem, TensionSystem, ForceVisualization,
│   │                 TwinLabels, twinMaterials
│   ├── panels/       CoilDetails, ReelPanel, MillHealth, ControlStatus,
│   │                 InterlockStatus, AlarmPanel, PassSchedulePanel,
│   │                 EventTimeline, SystemStatus, SimulationControls,
│   │                 TagInventory, PlantConfig, ValidationPanel
│   ├── charts/       LiveChart, SignalChart (+ per-signal wrappers)
│   └── common/       Panel, ValueReadout, ProvenanceBadge, Sparkline
├── store/            machineStore, alarmStore, uiStore, telemetryStore
├── machine/          machineState, machineStateMachine, reversingEngine,
│                     rollingEngine, twinEngine, interlockEngine, alarmEngine
├── simulation/       simulationEngine, rollingModel, forceModel,
│                     thicknessModel, driveModel, tensionModel, coilModel,
│                     simulationScenarios
├── config/           millConfig, engineeringConfig, unitConversion
├── data/             tagDefinitions, tagMap, demoPassSchedule
├── communication/    dataSource, simulationDataSource, websocketClient,
│                     opcUaAdapter, dataAdapter
├── types/            machine, coil, alarms, telemetry, tags
└── utils/            ringBuffer, useTelemetry
```

`scripts/` holds the headless harnesses: `validate.ts` (§17), `smoke.ts`
(browser), `checkPhysics.ts` (pass schedule forces).

---

## Machine state model

`MachineState` (in `types/machine.ts`) is a **pure projection** of the current
tag frame. It is never mutated from a component.

### Nullability is load-bearing

Fields that can be absent on a real feed are typed `number | null`, `boolean |
null` or `Health`/`CtrlState` with a `NO_TAG` member. This is not defensive
typing — it is the §7.4 requirement expressed in the type system:

> The UI must degrade honestly: a missing tag shows `NO TAG`, never a
> plausible-looking number.

Because `rollGap.reference` is `number | null`, a component physically cannot
render `0.000 mm` for a roll gap position the plant does not measure. The
compiler forces the question.

Fields that are nullable and why:

| Field | Null when |
|---|---|
| `rollGap.reference`, `.os`, `.ds`, `.tilt` | No HAGC/LVDT position tag on the feed |
| `rollGap.deviation` | Propagated — needs the reference |
| `rollingForce.os`, `.ds`, `.differentialRef` | No per-side instrumentation |
| `rolls.*.bendingForce` | No bending force tag — and the twin must not animate a fake bend |
| `rolls.*.actualDiameter` | No roll shop / roll ID tag |
| `rolls.*.rolledLength` | Roll wear is Phase 4 — no tag, no model |
| `hydraulics.*` | No hydraulic tags in the CRM04 extract |
| `interlocks.*` | No interlock chain tags beyond LINE_START_STOP |
| `gauges.*.ready`, `.inLine` | Gauge readings exist; the status word does not |
| `coil.grade` | Would have to be joined against MES |
| `tension.*.brake`, `.layers`, `.thickness` | Per-reel; POR carries layers, DTR/ETR carry thickness |

### Two quantities that look like duplicates and are not

- `rolls.*.diameter` is the **design** diameter from `millConfig`. It drives the
  rpm model and the 3D geometry, so the twin renders correctly on a feed with no
  roll-shop data. `rolls.*.actualDiameter` is the **ground** diameter reported by
  the roll shop, and it is `null` when that tag does not exist. Different
  quantities, not two copies of one.
- `tension.entrySpecific` is `tension.entry` divided by the strip section. It is
  a unit conversion of the same value at its point of display, not a second
  source.

### Logical roles

Entry and exit are **derived from `rollingDirection`**, never hardcoded to a
side. `machine/reversingEngine.ts` owns that derivation:

```ts
payoffReel(direction)   // 'DTR' when FORWARD, 'ETR' when REVERSE
tensionReel(direction)  // the other one
```

and `machine/machineState.ts` exposes the readers every component uses
(`entryReel`, `exitReel`, `entryGauge`, `exitGauge`). A direction change flips
all of them together, or none.

---

## State machine

States: `IDLE · READY · THREADING · ROLLING · DECELERATING · REVERSING ·
STOPPED · FAST_STOP · WARMUP · SKIN_PASS · REWIND · ROLL_CHANGE · FAULT`

All transitions go through `machine/machineStateMachine.ts`. No component may
set status directly, and every transition returns a **reason string** — §13.2
forbids a bare "MILL NOT READY", and the same principle is applied to every
state, so the operator can always see *why*.

```
ROLLING → (stop request) → DECELERATING → STOPPED
ROLLING → DECELERATING → STOPPED → REVERSING → ROLLING
ANY     → (E-stop / fast stop) → FAST_STOP → STOPPED
```

### The reversal sequence

`machine/reversingEngine.ts` is a pure sequencer with phases
`SETTLE → FLIP → REPOSITION → COMPLETE`. Two independent guards enforce §9's
"no instant flip":

1. `stepReversal` refuses to advance any phase while `|speed| > 0.05 m/min`.
2. `beginReversal` refuses to start unless the status is already `STOPPED`.

The FLIP step is processed at the **top** of a simulation tick, before the pass
entry is read. Running it at the end instead would publish one frame carrying
the new pass number alongside the old pass's thickness reference — an internally
inconsistent frame, which is precisely what §18 exists to catch. (This was a real
bug caught by `npm run validate`, not a hypothetical.)

---

## Interlocks and alarms

`machine/interlockEngine.ts` evaluates the chain **in order** and reports the
*first* failing link as the blocking reason, because on a real mill that is the
one the operator has to go and fix — the downstream links are usually failing
because of it.

```
ESTOP → FAST STOP → DATA FEED → DRIVE → HYDRAULIC → TENSION → GAUGE → MILL READY
```

`machine/alarmEngine.ts` is **pure**: it reports which conditions are currently
true. Latching, acknowledgement, timestamps and history are `store/alarmStore.ts`'s
job. Keeping them apart is what lets the rules be re-evaluated every frame
without churning the alarm list.

A rule never fires on a `null` value. On the 46-tag feed the hydraulic pressure
tag does not exist, and an alarm engine that treated "no tag" as "zero" would
raise a permanent, meaningless HYDRAULIC PRESSURE LOW.

---

## Performance (§15)

24/7 control room operation, so:

- **The 3D scene never re-renders React.** `TwinContext` subscribes to the store
  imperatively; `twinEngine.advanceOnce()` damps the values; scene components
  mutate `Object3D` transforms inside `useFrame`. A KPI change cannot re-render
  the 3D scene because the 3D scene is not subscribed to React state at all.
- **Feed rate is 10 Hz**, one of the rates §14.2 asks the twin to work at. The
  scene stays continuous because every visual value is damped with a
  frame-rate-independent half-life (§10.4) — the same mechanism that will carry
  the 0.2 Hz historian replay case.
- **Telemetry buffers are fixed-capacity ring buffers** backed by typed arrays,
  240 points per window, **downsampled on write**. The 1-hour window stores one
  averaged point every 15 s rather than 14 400 raw points a chart would then
  have to decimate on every repaint. Memory is allocated once and never grows.
- **Charts repaint on their own 2 Hz interval**, decoupled from both the feed
  and the 3D frame loop.
- **The event log and alarm history are bounded** (`BoundedLog`, 400 / 300
  entries).
- **Pixel ratio is capped at 1.75** so a 4K control-room monitor does not render
  4× the fragments for no visible benefit.
- **Instanced meshes** for the tension chevrons — seven markers, one draw call.

---

## Deliberate non-obvious choices

**The environment map is not decoration.** A material at `metalness: 1` has no
diffuse response — it renders purely as what it reflects. In a dark industrial
palette that makes a "polished steel" work roll come out almost black, which is
the classic way a PBR mill scene ends up an unreadable slab. The scene therefore
builds a small procedural environment from drei `Lightformer`s (rendered once,
no external asset, works on an isolated plant network) and keeps roll metalness
around 0.7 so the geometry still reads.

**Strip section and roll gap are drawn ×30.** A 2 mm strip between 400 mm rolls
is 0.5% of the roll diameter and is invisible at engineering scale. The
exaggeration factor is in `millConfig.visual`, is applied only in
`unitConversion.ts`, and is disclosed on screen. The *numbers* are always true;
only the pixels are scaled.

**Noise is added at the instrument and nowhere else.** §19.2 forbids random
independent values, but instrument scatter is physically real. The X-ray gauge
signal gets Gaussian noise from a *seeded* generator at the point a real
measurement chain would add it. No process value that other values depend on is
ever randomised, so the simulation is reproducible run to run.

**The AGC is fed the model thickness, not the noisy gauge signal.** It stands in
for the real filtered gauge. Feeding the displayed value back would inject
instrument noise straight into the capsule position, which is not what the mill
does.
