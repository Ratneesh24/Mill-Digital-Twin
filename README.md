# CRM04 · 4HI Reversing Cold Rolling Mill — Digital Twin

> **Single-stack decision: the delivered UI is the .NET Blazor app in `dotnet/`
> (run guide: [`dotnet/README.md`](dotnet/README.md)). The React app in `src/`
> is **frozen** — it stays untouched as the reference implementation and as the
> offline generator for the .NET build (`npm run export:all` produces the tag
> catalog, replay dataset and parity fixtures). Do not start new UI work here,
> and do not run `npm run dev` as the operator UI.

Real-time digital twin of the CRM04 / CRM06 4HI reversing cold rolling mill,
Tata Steel CRM Sahibabad, Narrow Complex.

This is **not a KPI dashboard**. The 3D twin is the primary feature and dominates
the screen; the panels exist to explain what the machine in the middle is doing.

---

## How to run

> Run the .NET stack (the delivered UI). The React commands below remain only
> for the offline generators (`export:*`) and frozen-app verification.

```bash
cd dotnet
dotnet run --project src/Crm04.Api    # http://localhost:5200
dotnet run --project src/Crm04.Web    # http://localhost:5240  <- open this
```

React (frozen — generator and reference only):

```bash
npm install        # once
npm run dev        # http://localhost:5173
```

Other commands:

Run `npm test` for the physics validation plus mocked gateway and machine-store
regressions. `npm run check:gateway` checks frame validation and socket lifecycle;
`npm run check:store` checks feed loss/recovery, source isolation, connection races,
and fast-stop animation. These checks do not require a plant connection.
With the .NET stack running (API on :5200, Web on :5240), `npm run check:smoke`
checks browser interactions and desktop, tablet, and mobile layouts, and
`npm run check:layout` asserts the layout contracts across six viewports. Both
drive the **Blazor** UI, not the frozen React app — point them elsewhere with
`SMOKE_URL`, and keep their screenshots out of the tree with `SMOKE_OUT`.

Source switches intentionally clear trend buffers and alarm history so simulation
records cannot be relabeled as LIVE. During a feed outage, the last values become
STALE, readiness is blocked, and existing process alarms remain until fresh data
confirms recovery. LIVE requires complete normalized snapshots, not raw historian
rows or partial tag updates; see [the gateway contract](docs/INTEGRATION.md).

| Command | What it does |
|---|---|
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run validate` | Run the §17 validation tests headlessly against the simulation engine |
| `npm run check:physics` | Print the pass schedule with forces computed by the force model |
| `npm run check:smoke` | Drive the Blazor UI on :5240 in Chrome/Edge and fail on any console error |
| `npm run check:layout` | Assert the layout height and legibility contracts on :5240 across six viewports |

`npm run validate` is the one to run after touching anything in `src/simulation`
or `src/machine`. It drives the engine at a fixed time step and asserts all ten
§17 behaviours plus the §18 coupling invariants — 60 checks, no browser needed.

---

## What you are looking at

The application opens in **SIMULATION** mode with a coil charged and the mill at
READY. Press **START** on the strip under the 3D view.

Five things worth doing:

1. **Watch a pass run.** Pass 1 takes about 3 minutes of mill time. The payoff
   coil shrinks, the tension reel grows, both slow down as their diameters
   change, and the thickness deviation trace shows the AGC rejecting the
   incoming hot-band variation.
2. **Let it reverse.** At the end of the pass the mill decelerates to a genuine
   standstill, the direction flips, ENTRY and EXIT swap sides in the 3D scene,
   the reel roles swap, the capsule prepositions for pass 2, and the strip
   accelerates the other way. Nothing flips instantly.
3. **Switch to SIM · 46-TAG** in the header. Same simulation, but every value is
   now shown with the provenance it will carry on the real CRM04 historian feed:
   roll force becomes ESTIMATED, roll gap becomes CALCULATED, work roll bending
   and OS/DS split become NO TAG. This is the honest preview of what the twin
   can and cannot show once it is bound to plant data.
4. **Open VALIDATION.** Twelve physical invariants are evaluated against machine
   state every frame, and the ten §17 tests can be run from the page.
5. **Try the COMMUNICATION LOSS scenario** (Pass Schedule tab → Simulation
   controls). The twin freezes, every readout stops claiming to be live, and the
   last valid timestamp is held.

---

## Architecture

```
PHYSICAL 4HI MILL
      ↓
 PLC / Drives (ABB MillPilotDrives / MillRollGap)
      ↓  OPC-UA
 Edge Gateway → Tag Normalisation
      ↓
┌─────────────┐
│  MACHINE    │   ← exactly one authoritative MachineState
│   STATE     │
└──────┬──────┘
       ├──────────────┬───────────────┬────────────┐
   Digital       Engineering      Alarm &      UI State
    Twin         Calculations     Interlock     Engine
       └──────────────┴───────────────┴────────────┘
                      ↓ WebSocket API
                 React Frontend
       ┌──────────┬────────┬─────────┬────────┐
      3D         KPI     Trends    Alarms
```

Four isolated layers, and the boundary between them is enforced by the type
system rather than by convention:

| Layer | Directory | Knows about |
|---|---|---|
| Simulation equations | `src/simulation` | Physics only. No React, no tags, no UI. |
| Communication | `src/communication` | Transports and tag frames. No physics. |
| Machine state | `src/machine`, `src/store` | State, transitions, alarms, interlocks. |
| Rendering | `src/components` | Reads state through selectors. Computes nothing. |

**The non-negotiable rule (§4):** the twin and the UI never hold independent
copies of a process value. `communication/dataAdapter.ts` is the only place
`MachineState` is constructed, and `components/common/ValueReadout.tsx` is the
only component allowed to print a process value — and it takes a *tag name*,
not a number. That is what makes "the value beside the machine == MachineState
== the trend chart" structurally true rather than aspirational.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, folder structure, machine state model, performance design |
| [docs/SIMULATION.md](docs/SIMULATION.md) | Every equation and every coefficient, with its source and its limitation |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Live data integration points and the OPC-UA / edge gateway plan |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Assumptions register — every UNVERIFIED value and who owns it |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Known limitations, including the §7.4 tag gaps |
| [docs/AUDIT.md](docs/AUDIT.md) | Gate A — digital twin consistency audit table |
| [docs/PHYSICS_REVIEW.md](docs/PHYSICS_REVIEW.md) | Gate B — simulation physics consistency review |
| [docs/NEXT.md](docs/NEXT.md) | What to implement next, by phase |

---

## Status against the specification

| Gate | State |
|---|---|
| S1 Build (§1–§14, §16 Phase 1) | Complete — app runs, twin renders, sim runs, reversing works |
| S2 Twin consistency audit (§18) | Complete — [docs/AUDIT.md](docs/AUDIT.md), 12 invariants checked live in-app |
| S3 Physics consistency review (§19) | Complete — [docs/PHYSICS_REVIEW.md](docs/PHYSICS_REVIEW.md) |
| S4 Validation (§17) | Complete — 60/60 headless checks, all 10 tests runnable in-app |
| S5 Handover (§20) | Complete — deliverables listed above |

Zero TypeScript errors, zero runtime errors, clean console (verified by
`scripts/smoke.ts` in a real browser).

**Phase 1 is read-only with respect to the machine.** Every control in the UI
modifies simulated state only, and in LIVE mode they are disabled with the reason
shown. Real machine commands are out of scope and, when built, go through an
authorised `CommandService` — never from the frontend (§14.4).

---

## The most important caveat

The engineering models in `src/simulation` are **simplified textbook cold-rolling
relations** chosen so the twin is internally consistent. They are **not** the
mill's technology model, and no number this application produces should be quoted
as mill technology data.

Five parameters that drive both the physics and the 3D geometry are still
placeholders — work roll diameter, backup roll diameter, barrel length, mill
modulus M, and the main drive rating. They are badged UNVERIFIED everywhere they
appear and are listed in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md). Until they
are replaced with plant data, the twin demonstrates *behaviour*, not *values*.
