# What to implement next

Ordered by what most increases the twin's value, not by what is easiest.

---

## Before anything else — close the §22 open items

None of this is code. All of it changes what the twin is allowed to claim.

| # | Item | Owner | Why it blocks |
|---|---|---|---|
| 1 | WR / BUR diameters, barrel length, mill modulus M, main drive rating | Mill engineering | These drive the physics *and* the 3D geometry. Mill modulus M in particular sets how a gap change splits between thickness and force, so every downstream number depends on it. |
| 5 | Audit the −9 t AGC differential force reference | Mill engineering | Must happen **before** force-model baselining. Baselining against a mill with a known standing differential issue would bake that issue into the model. |
| 2 | Force / speed / tension limits per grade family | Process | Converts alarm thresholds from proportions of the maximum into engineering limits. |
| 3 | Which additional PLC tags OEM can expose at higher sampling | OEM + automation | Priority: roll separating force, LVDT OS/DS, WR bending, WR RPM. |
| 4 | Live edge feed, historian replay, or both for v1 | Digital | Decides whether Phase 3 builds the gateway path or the replay path first. |

The TAG INVENTORY and PLANT CONFIG pages are built to be taken into these
conversations directly — they show the gap as a countable engineering fact.

---

## Phase 2 — depth on what already works

**OS/DS split and tilt visualisation.** The data model already carries force and
gap per side and the −9 t differential reference. What is missing is the
rendering: the roll stack should tilt, and the mill-health panel should show the
side-to-side differential against its reference. Given the standing Mill 4 BUR
taper issue, this is the highest-value Phase 2 item — it is the twin earning its
place on a live plant problem rather than demonstrating a capability.

**DTR / ETR / POR detail screens.** Per-reel drive detail, torque/tension
history, brake and gauge status over the pass.

**Pass schedule editor.** Currently read-only from `demoPassSchedule.ts`. An
editor lets a process engineer explore a schedule against the force model before
it goes to the mill. The force column is already computed by the same model that
produces the live reading, so the comparison is meaningful.

**Event timeline on the overview.** It exists and is bounded; it is currently
only on the Pass Schedule page.

**Multi-coil queue.** "Charge next coil" reloads the same demo coil. A real queue
with MES lookup makes the twin usable across a shift.

---

## Phase 3 — live data

**Historian replay of the 5 s CRM04 extract.** See
[INTEGRATION.md](INTEGRATION.md) for the design. Ship it with *no* data file —
the user supplies the CSV. The interpolation layer that makes 0.2 Hz render as
continuous motion already exists and is exercised at 10 Hz.

**Exercise `WebSocketDataSource` against a real gateway.** The client validates,
rejects unknown tags, guards clock skew and reconnects with backoff, but nothing
has ever been on the other end of it. Expect the first real feed to surface tag
naming and unit mismatches; that is what `tagDefinitions.ts` is for.

**Provenance downgrade behaviour on real data.** The former SIM · 46-TAG mode
rehearsed it; it was removed for go-live, so the live feed is now the only test. The
real feed will find cases the rehearsal does not — most likely tags that exist
but are frozen, or good-quality tags with implausible values.

**Persistence.** Trends, alarms and events are in-memory and lost on reload. A
control-room deployment needs the historian behind the gateway, not browser
storage.

---

## Phase 4 — expansion

Roughly in order of value for a cold mill:

1. **Actual vs calculated force, actual vs schedule.** The comparison is already
   half-built: the schedule's predicted force comes from the same model as the
   live reading, and SYSTEM STATUS shows the divergence. Trending it per coil
   turns it into a model-quality metric.
2. **Roll wear and roll crown.** `rolls.*.rolledLength` is a null field in the
   state model waiting for this. Combined with the BUR taper issue this is
   directly useful.
3. **Flatness / shape and bending profile.** Requires the bending tags from §22
   item 3.
4. **Thermal**: roll and strip temperature, thermal crown, friction variation.
5. **Bearing and motor temperatures, vibration, bearing health** → predictive
   maintenance.
6. **Energy and power factor**, specific energy per tonne (the indicator already
   exists in `rollingEngine.specificEnergy`).
7. **OEE, production tons, coil genealogy, MES/DCVMOS integration.**
8. **AI anomaly detection** — worth doing last, once there is a calibrated model
   to detect anomalies *against*. Against an uncalibrated model it would mostly
   detect the model.

---

## Engineering debt worth paying early

**Add an inertia term to the drive model.** The absence of one means the current
shown during a speed ramp is the steady-state value at the new speed. On a real
mill the acceleration current spike is often the largest number an operator sees,
so this is the most visible physics gap.

**Make the mill modulus a curve.** Once the real mill spring curve is measured,
`solveGaugemeter` should call it instead of dividing by a constant. One function.

**Per-grade flow curves.** `calculateMeanFlowStress` takes one fitted curve.
Replacing it with a grade lookup is one function and materially improves force
accuracy across the product mix.

**A regression baseline for `npm run validate`.** It currently asserts
*relationships* (force rises when the gap closes). Once the model is calibrated,
add absolute value assertions so a coefficient change that silently shifts the
force by 10% fails the build.

**Historian-driven model validation.** The extract has torque, current, entry and
exit thickness, and tensions for six months. That is enough to check the
*inverse* force estimate against measured torque across real coils — which can be
done before any new tags arrive, and would give the first real evidence of how
good the model is.
