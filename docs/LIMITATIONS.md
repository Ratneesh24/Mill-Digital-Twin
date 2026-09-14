# Known limitations

## 1. The live-mode reality gap (§7.4)

This is the most important limitation and the one that shapes what the twin can
honestly claim.

The available 6-month CRM04 extract is **5 s sampled, coil-linked, and carries
about 46 of the 74 tags** in the reference inventory. The twin models **108
tags** (the 74-tag inventory plus derived quantities the state model needs). On
that live feed they resolve as:

| Class | Count | Meaning |
|---|---|---|
| MEASURED | 27 | Real instrument value |
| REFERENCE | 9 | MMS / pass-schedule setpoint |
| CALCULATED | 26 | Derived from values that *are* on the feed |
| ESTIMATED | 1 | Model fill-in — roll separating force |
| **NO TAG** | **45** | Nothing to show. Rendered as `NO TAG`, never as a number. |

Switch the header to **SIM · 46-TAG** to see exactly this, live, on the real
screen. The full table is on the **TAG INVENTORY** page.

### What the extract does not contain

**Roll separating force · HAGC/LVDT position · bending force · WR RPM · roll ID ·
coolant tags.**

Consequences, built in from day one rather than retrofitted:

| Twin element | On the 46-tag feed | What the twin does |
|---|---|---|
| Rolling force | Not measured | ESTIMATED from `MILL_ACT_TRQ` + reduction model. Badged ⟡ EST, and the 3D force arrows are drawn **hollow** so the loading shown reads as inferred. |
| Roll gap actual | Not measured | CALCULATED from the gaugemeter inverse `S₀ = h − F/M`. Badged ⟡ CALC. |
| Roll gap reference (S₀) | Not measured | `NO TAG` |
| WR bending | Not measured | `NO TAG` — the bending actuators are inert and **no bend is animated**. |
| WR RPM | Not measured | CALCULATED from mill speed and roll diameter. Badged ⟡ CALC. |
| Roll gap OS/DS/tilt, force OS/DS | Not measured | Panels present, values `NO TAG`. The data model carries the split regardless (§2). |
| Hydraulics, media status, control modes, interlocks | Not measured | `NO TAG` — the whole MILL HEALTH media block and PROCESS CONTROL panel degrade. |

### Accuracy caveats on the derived values

- **The estimated force is a trend indication, not a calibrated reading.** Any
  error in the lever-arm ratio λ, in the tension-torque split, or in the assumed
  contact length propagates directly into it.
- **The calculated roll gap is bounded by the force estimate**, because the
  gaugemeter inverse consumes it. Spec §7.4 asks for it to be badged CALC; that
  badge is honoured, but the dependency is real and is noted on the tag.
- **The derived mill speed is a coarse average.** With no direct speed feedback
  tag, it comes from the rate of change of the reel length tags — at 5 s
  historian sampling that is an average over the interval, not an instantaneous
  speed.

### Promotion path

When OEM raises PLC sampling on a tag (§22 item 3), change that tag's
`liveAvailability` to `'MEASURED'` in `src/data/tagDefinitions.ts` and delete its
`liveNote`. **Nothing else changes.** No component reads an availability flag —
they all read the resolved provenance off the `Tag`.

Priority order, because without these the three most important quantities on the
screen are model output rather than measurement:

1. `ROLL.FORCE.ACTUAL`
2. `ROLL.GAP.ACTUAL`, `ROLL.GAP.OS`, `ROLL.GAP.DS`
3. `WR.TOP.BENDING`, `WR.BOTTOM.BENDING`
4. `WR.TOP.RPM`

---

## 2. Calibration

The twin is **internally consistent but not calibrated**. See
[ASSUMPTIONS.md](ASSUMPTIONS.md) for the full register. In short:

- Geometry and ratings now come from the OEM manual (FPE CRM04 Operation &
  Maintenance Manual, reproduced in
  [CRM04_MECHANICAL_DATA_BOOK.md](CRM04_MECHANICAL_DATA_BOOK.md)). Four
  placeholders survive, of which **the mill modulus M** matters most — it sets
  how much of a gap change appears as thickness and how much as force, and
  therefore affects everything. The manual never states it.
- Every **line centre-line spacing** is a reconstruction. The manual dimensions
  them on EU 01 1 A1 but its own §14 records the scan as illegible. The line
  *order* is confirmed; the distances drive the 3D layout only.
- The material model is a generic low-carbon flow curve, not a Tata grade family.
- The force model has **never been baselined against CRM04**, and §22 item 5
  flags that baselining is blocked behind the standing −9 t AGC differential
  force reference audit. Baselining against a mill with a known differential
  issue would bake that issue into the model.

Until those close, the twin demonstrates **behaviour**, not **values**.

---

## 3. Physics model limitations

Full detail with rationale in [SIMULATION.md](SIMULATION.md) and inline in each
model file. The ones most likely to matter:

- **No inertia anywhere.** Drive current during a speed ramp is the steady-state
  value at the new speed, not the accelerating value. Reel torque during
  acceleration is understated. On a real mill the acceleration current spike is
  often the largest number an operator sees.
- **No thermal model.** No roll or strip temperature, no thermal crown, no
  friction change with temperature. Cold rolling generates real heat and the
  coolant system exists for a reason.
- **Force is uniform across the barrel.** No roll crown, no bending effect on the
  force distribution, no flatness or shape. This is why OS/DS is Phase 2 and
  flatness is Phase 4 — and it is a real gap given the standing Mill 4 BUR taper
  issue.
- **Mean-pressure force model.** The neutral point is not located and the
  pressure distribution across the arc of contact is not resolved.
- **Mill modulus is a constant**, not a measured spring curve.
- **The HAGC is a single PI on delivered thickness**, standing in for a cascaded
  100 Hz+ position/pressure loop with MFC, THFF and THFB trims and a separate
  tilt loop. The individual control-mode chips (THFB, THFF, SPFF, MFC) reflect
  whether AGC is closed; they are not independently modelled loops.
- **Constant forward slip and constant friction.**
- **No strip-break, no slip, no chatter, no threading dynamics.** THREADING is a
  speed state, not a modelled threading sequence.
- **Gauge noise is white.** Real X-ray gauges drift, standardise, and alias with
  strip flutter.

---

## 4. Scope not built in Phase 1

Deliberately out of scope per §16, listed so the boundary is explicit:

- **Phase 2**: detailed secondary pages, DTR/ETR/POR detail screens, pass
  schedule *editor*, OS/DS split and tilt visualisation in the 3D scene.
- **Phase 3**: live adapter against a real edge gateway (the client exists and is
  wired, but has never spoken to a gateway); historian replay of the 5 s CRM04
  data (`HistorianReplayDataSource` is not written — see
  [INTEGRATION.md](INTEGRATION.md)).
- **Phase 4**: thermal, bearing/motor temperatures, hydraulic pressure maps, roll
  wear, roll crown, bending profile, flatness/shape, strip tracking, energy and
  power factor, vibration, bearing health, predictive maintenance, OEE,
  production tons, coil genealogy, MES/DCVMOS integration, actual-vs-calculated
  force, actual-vs-schedule reporting, AI anomaly detection.

`rolls.*.rolledLength` is present in the state model and always `null`, rendering
`NO TAG · PHASE 4`. That is deliberate: a null field that says why is more useful
to the automation team than a missing one.

---

## 4a. The auxiliary line is geometry, not instrumentation

The 3D scene now carries the whole line the manual describes — pay-off reel with
snubber, peeler, pinch roll cum flattener, carry-over table, entry and delivery
deflector rolls, isotope gauges, air knife wipers, crop shear, three pit-mounted
coil cars with storage saddles, and the mill enclosure with its hoods.

**None of it except the deflector rolls has a tag on the CRM04 feed.** So none of
it moves. Each part is drawn in the state it holds while the mill is rolling:

| Equipment | Drawn as | Why that state |
|---|---|---|
| Peeler | Retracted, knife back | §12.2 step 2 |
| Pinch roll / flattener | Top rolls raised, coupler disengaged | §12.4 steps 5–6 |
| Carry-over table | Lowered to parking | §12.5 step 3 |
| Crop shear | Open, top knife raised | §5.7 — the knife holder is locked for any work at the shear |
| Snubber | Lowered onto the coil, arm angle following the POR coil diameter | §12.1 step 7 |
| Coil cars | Retracted, elevator down | §8 — *"coil cars must be in the retracted position during rolling"* |

Selecting any of them in the equipment inspector reports **NOT INSTRUMENTED**
rather than borrowing a nearby tag. That distinction matters: an operator has to
be able to tell "this part has no sensor" from "this value is currently
unavailable".

The **deflector rolls are the exception and do rotate.** The strip wraps them, so
their surface speed is the strip speed, and §5.6 puts the AGC speed encoders on
them — on both the operator and drive side. They are the only genuinely
instrumented part of the auxiliary line, and the only part the twin animates.

**POR is modelled parked.** On the real first pass the strip runs POR → peeler →
flattener → carry-over table → over an *idle* ETR → mill → DTR, and ETR only
becomes a coiler from pass 2. The twin does not model that threading pass: it
pays off from ETR on pass 1 and keeps POR braked with the next coil. Modelling it
properly needs a pass-0 threading state in the simulation engine.

---

## 5. Application-level limitations

- **LIVE mode has never been exercised against a real gateway.** The WebSocket
  client validates payloads, rejects unknown tags, guards against clock skew and
  reconnects with exponential backoff, but no server has been on the other end.
- **No persistence.** Trends, alarms and the event log live in memory and are
  lost on reload. A control-room deployment needs a historian behind the gateway,
  not browser storage.
- **No authentication or authorisation.** Read-only monitoring of a simulation.
  Before LIVE deployment this needs to sit behind the plant's access control.
- **Single coil.** "Charge next coil" reloads the same demo coil. There is no
  coil queue and no MES lookup.
- **Trend buffers are per-session and unsynchronised.** All nine signals share a
  cadence, so the multi-series chart aligns by index; a source that publishes
  signals at genuinely different rates would need timestamp interpolation.
- **Layout is optimised for 1920×1080.** It reflows, but the three-column
  overview is tight below about 1500 px wide. Concretely: the header command bar
  fits on one row until an **alarm pill** appears, and below about 1500 px that
  conditional sixth item wraps the bar onto a second row (measured 62 px with no
  pill and 106 px with one, at the same 1280 px width). That is `flex-wrap`
  degrading as designed rather than an overflow, and `npm run check:layout`
  asserts it accordingly — one row when no alarm is active, two at most when one
  is.
- **Escape does not close the diagnostics dialog.** `DiagnosticsDialog.razor`
  wires no key handler, so the MODEL / DATA dialog closes on its ✕ or on the
  overlay but not on Escape — a gap against the React original, which closed on
  all three. A modal should close on Escape; until it does, `npm run check:smoke`
  asserts the ✕ path that works rather than a behaviour that does not exist.
- **Browser only, WebGL required.** The smoke test runs against software WebGL
  (SwiftShader), so it will render on a machine without a GPU, but slowly.

---

## 6. What would most change the picture

If only three things could be done next:

1. **Get roll separating force and LVDT position onto the feed.** That converts
   the single most important reading on the screen from ESTIMATED to MEASURED and
   removes the dependency chain under the calculated roll gap.
2. **Close the mill modulus and work roll diameter.** They set the quantitative
   behaviour of everything downstream.
3. **Audit the −9 t differential reference, then baseline the force model.**
   Without that, the force model has no anchor to reality.
