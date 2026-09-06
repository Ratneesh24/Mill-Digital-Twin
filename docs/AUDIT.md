# Gate A — Digital Twin Consistency Audit (§18)

> Run as a senior 4HI cold rolling mill commissioning engineer. Trace every
> displayed parameter end to end:
> `DATA SOURCE → TAG → MACHINE STATE → CALCULATION → VISUALISATION`
> Verify exactly one authoritative value exists for each.

**Result: PASS.** Every parameter below has exactly one authoritative source.
Four inconsistencies were found during the audit and fixed in code; they are
listed at the end with what was wrong and what changed.

---

## How single-sourcing is enforced structurally

Rather than relying on review, three chokepoints make a second copy of a value
difficult to create by accident:

| Chokepoint | File | Guarantees |
|---|---|---|
| One `MachineState` constructor | `communication/dataAdapter.ts` | Every state field is read from a `Tag`. No physics, no fallbacks. |
| One value-printing component | `components/common/ValueReadout.tsx` | Takes a **tag name**, not a number. Value, unit, limits, status and provenance all come from the same `Tag`. |
| One state→scene bridge | `machine/twinEngine.ts` | No scene component reads a process value from the store; none computes its own rate. |

The scene's value labels (`TwinLabels.tsx`) use the same `ValueReadout` component
as the KPI bar and the detail panels. "The value beside the machine == the KPI ==
the trend chart" is therefore not a property to be checked — it is the only thing
the code can express.

---

## Audit table

| Parameter | Source | Tag | State field | Visualisation | Relationship | Provenance | Status |
|---|---|---|---|---|---|---|---|
| **Mill speed** | `simulationEngine` step 4 speed ramp | `MILL.SPEED.ACTUAL` | `speed.actual` | KPI module + sparkline; drives all scene motion via `twinEngine.stripSpeed` | Ramped toward the pass-schedule reference at `acceleration`/`deceleration` | SIM / CALC on live feed | ✅ one source |
| **Mill speed reference** | Pass schedule + operator trim | `MILL.SPEED.REF` | `speed.reference` | KPI footer, event timeline | `pass.speedReference + trim`, clamped to max | REF | ✅ |
| **Entry strip speed** | `entrySpeedFromMassFlow` | `MILL.SPEED.ENTRY` | — (used by `twinEngine`, `passTimeRemaining`) | Entry strip span scroll rate | `v_exit · h_exit / h_entry` | CALC | ✅ derived, not stored twice |
| **Roll RPM (WR)** | `calculateRollRPM` | `WR.TOP.RPM`, `WR.BOTTOM.RPM` | `rolls.upperWork.rpm`, `.lowerWork.rpm` | Work roll rotation angle | `v_surface/(π·D)`; lower = −upper | CALC | ✅ verified live to 1% |
| **Roll RPM (BUR)** | `calculateRollRPM` | `BUR.TOP.RPM`, `BUR.BOTTOM.RPM` | `rolls.upperBackup.rpm`, `.lowerBackup.rpm` | Backup roll rotation | Same surface speed as WR; rpm scales inversely with diameter | CALC | ✅ |
| **Strip velocity** | Same as mill speed | `MILL.SPEED.ACTUAL` | `speed.actual` | Strip surface-marker scroll (entry and exit spans at *different* rates per mass flow) | `stripVelocity = millSpeed` | SIM | ✅ same tag as mill speed, no second copy |
| **Rolling direction** | `reversingEngine` FLIP step | `MILL.DIRECTION` | `rollingDirection` | Every moving element's sign; ENTRY/EXIT label positions; direction indicator | Set once per reversal, in one place | SIM | ✅ |
| **Entry / exit role** | `reversingEngine.payoffReel()` | `DTR.ROLE`, `ETR.ROLE` | `tension.dtr.role`, `.etr.role` | Reel panel role chips, scene labels, tension chevron colours | Pure function of `rollingDirection` | CALC | ✅ never hardcoded to a side |
| **Roll gap (loaded)** | `solveGaugemeter` | `ROLL.GAP.ACTUAL` | `rollGap.actual` | Work roll separation, roll-stack label positions, scene value label | Coupled solve with force | SIM / CALC on live feed | ✅ |
| **Roll gap position S₀** | HAGC + operator trim | `ROLL.GAP.REF`, `HYD.GAP.POSITION` | `rollGap.reference`, `hydraulics.gapPosition` | KPI footer, hydraulics panel, HAGC capsule rod extension | PI on thickness error, slew limited | REF / **NO TAG** on live feed | ✅ nullable |
| **Strip thickness (delivered)** | `solveGaugemeter` + gauge noise | `STRIP.THICKNESS` | `thickness.actual` | KPI module, coil panel, trend, exit gauge | `h = S₀ + F/M` | SIM / MEASURED on live feed | ✅ |
| **Strip thickness (entry)** | Pass input + hot-band profile | `STRIP.THICKNESS.ENTRY` | `thickness.entry` | Coil panel, entry strip section | Nominal + deterministic profile | SIM / MEASURED | ✅ |
| **Thickness deviation** | `gaugeExit − pass.outputThickness` | `STRIP.THICKNESS.DEVIATION` | `thickness.deviation` | KPI module, trend with ±5 µm band, alarm rule | Difference of two published tags | CALC | ✅ |
| **Rolling force** | `calculateRollingForce` inside the coupled solve | `ROLL.FORCE.ACTUAL` | `rollingForce.actual` | KPI, force arrows at the bite, mill-health bar, trend, alarm | Bland–Ford + Hitchcock | SIM / **EST** on live feed | ✅ arrows drawn hollow when estimated |
| **Force OS / DS** | AGC differential reference | `ROLL.FORCE.OS`, `.DS`, `.DIFF_REF` | `rollingForce.os`, `.ds`, `.differentialRef` | Data model only (Phase 1); plant-config page | `F/2 ∓ diff/2` | SIM / **NO TAG** on live feed | ✅ carried from day one per §2 |
| **Entry tension** | `stepTension` | `TENSION.ENTRY` | `tension.entry` | KPI, scene value label, chevron intensity, strip droop, reel panel | First-order lag to schedule reference | SIM / MEASURED | ✅ |
| **Exit tension** | `stepTension` | `TENSION.EXIT` | `tension.exit` | KPI, scene value label, chevrons, reel panel | " | SIM / MEASURED | ✅ |
| **Specific tension** | `specificTension()` in adapter | — | `tension.entrySpecific`, `.exitSpecific` | Reel / coil context | `T/(h·w)` — unit conversion of the tension tag at its point of display | CALC | ✅ presentation of the same value, not a second source |
| **WR bending** | Scenario modifier (74-tag model) | `WR.TOP.BENDING`, `WR.BOTTOM.BENDING` | `rolls.*.bendingForce` | Bending actuator tint **only when the tag exists** | — | SIM / **NO TAG** on live feed | ✅ no fake bend animated |
| **Coil diameter (payoff)** | `coilRadiusFromLength` | `COIL.DIAMETER`, `DTR/ETR.DIAMETER` | `coil.diameter`, `tension.*.diameter` | Coil mesh radius, coil panel, reel panel | `r = √(r_m² + hL/π)` | CALC / MEASURED | ✅ |
| **Coil length** | Length bookkeeping | `COIL.LENGTH`, `DTR/ETR.LENGTH` | `coil.length`, `tension.*.length` | Coil panel, reel panel | Integrated from strip speed; `L₁ = L₀·h₀/h₁` across passes | CALC / MEASURED | ✅ |
| **Remaining length** | Payoff bookkeeping | `COIL.REMAINING_LENGTH` | `coil.remainingLength` | Coil panel, pass progress bar, pass-time-remaining | Decrements at entry speed | CALC | ✅ |
| **Motor torque** | `calculateDrive` | `DRIVE.TORQUE` | `drive.torque` | Mill-health bar + readout, trend | `2·F·a + R(T_back − T_front)`, roll term gated on rolling | SIM / MEASURED (`MILL_ACT_TRQ`) | ✅ |
| **Motor current** | `calculateDrive` | `DRIVE.CURRENT` | `drive.current` | Mill-health bar + readout, trend, alarm | `I_rated·G/G_rated` | SIM / MEASURED (`MILL_CURRENT`) | ✅ |
| **Motor power** | `calculateDrive` | `DRIVE.POWER` | `drive.power` | Mill-health readout, specific energy | `G·ω/η` | CALC | ✅ |
| **Pass number** | `applyFlip` | `PASS.NUMBER` | `pass.current` | KPI, pass schedule highlight, event timeline | Incremented once per reversal | REF | ✅ |
| **Gauge values** | `applyGaugeNoise` at the instrument | `GAUGE.DTR.THICKNESS`, `GAUGE.ETR.THICKNESS` | `gauges.dtr/etr.thickness` | Gauge frame state, reel panel | Model thickness + seeded noise | SIM / MEASURED | ✅ noise added only here |
| **DTR / ETR / POR** | Reel block writer | `{REEL}.{TENSION,DIAMETER,LENGTH,TORQUE,CURRENT,RPM,BRAKE,STATUS,…}` | `tension.dtr/etr/por` | Reel panel, coil meshes, rotation | Written by direction-derived role, not by side | CALC / MEASURED | ✅ |
| **Machine status** | `machineStateMachine.transition` | `MILL.STATUS`, `MILL.STATUS.REASON` | `machineStatus`, `statusReason` | Status banner, KPI status module, overlay, event timeline | Single transition function | SIM / CALC | ✅ no component sets status |
| **Mill interlock** | `interlockEngine.evaluateInterlocks` | `MILL.INTERLOCK` + node tags | `interlocks.*`, `interlockChain` | Interlock panel with named cause | Chain evaluated once, in the store | SIM / **NO TAG** on live feed | ✅ derived once |

---

## Physical coupling tests (§18)

Verified continuously in-app on the **VALIDATION** page (12 invariants, evaluated
against `MachineState` every frame) and headlessly by `npm run validate`.

| Stimulus | Must verify | Result |
|---|---|---|
| Speed changes | Strip speed, roll rpm, reel response, motor load all move | ✅ 250→310 m/min: rpm 193→240, ETR 135→146 rpm, power 1205→1484 kW |
| Roll gap decreases | Reduction, predicted thickness, force, motor load all move | ✅ −0.05 mm: h 2.1155→2.0848, F 502→512 t, I 1985→2053 A |
| Tension increases | Rolling force falls | ✅ +60 kN both sides: F 502→478 t |
| Direction changes | Every moving element reverses; entry/exit roles swap; UI stays correct | ✅ FWD→REV, ETR.ROLE=PAYOFF, WR +193→−232 rpm, rolls still counter-rotate |
| Force increases | Central mill visual indicates greater loading | ✅ Force arrows scale and cross to warning/alarm colour at the same thresholds the alarm engine uses |
| Thickness changes | Value beside the machine == MachineState == trend chart | ✅ Structurally guaranteed — one `ValueReadout`, one tag |
| Machine stops | All animations eventually stop | ✅ speed 0 → rpm 0, reels 0, `twinEngine.animate` false |
| Data goes stale | System stops representing values as LIVE | ✅ Watchdog re-stamps every tag `STALE`, twin freezes, curtain shown with last valid timestamp |

---

## Inconsistencies found and fixed

These were found by tracing and by the headless harness, and corrected in code.

### 1. Frame published mid-flip carried two different passes

**Symptom:** on the tick where the direction flipped, `PASS.NUMBER` had already
incremented but `STRIP.THICKNESS.REF` still held the previous pass's target
(2.110 → 2.110 rather than 2.110 → 1.630).

**Cause:** the pass entry was read at the top of the tick; `applyFlip()` ran near
the bottom. One frame therefore described two different passes.

**Fix:** pass-change and reversal sequencing moved to step 3, *before* the pass
entry is read (`simulationEngine.stepPassAndReversal`). Safe because a flip only
ever happens during REVERSING, when the strip is already at a standstill, so it
acts on the previous tick's settled state.

### 2. A stopped mill drew 231 A

**Symptom:** at standstill with the capsule loaded, the drive reported 231 A.

**Cause:** the deformation torque `2·F·a` was computed from the standstill
capsule load. A parked stand carries a separating force but does no deformation
work, so there is no rolling torque.

**Fix:** `calculateDrive` now takes a `rolling` flag and gates the roll-torque
term on it. The tension-differential term is deliberately *not* gated — the reels
do hold the strip taut at standstill and the mill motor holds against the
difference, which now reads as −34 A rather than a fictitious 231 A.

### 3. Stale data still badged LIVE

**Symptom:** when the feed went stale the connection banner said STALE, but every
individual readout still showed its normal green/violet provenance badge.

**Cause:** the staleness watchdog updated `communication` but not the tags.

**Fix:** on the stale transition the watchdog re-stamps every tag's quality to
`STALE`. §14.5 says "stale values must visibly stop being LIVE" — the banner is
not enough; each readout has to stop claiming freshness. Now checked by the
`Stale feed marks every readout STALE` invariant.

### 4. A READY mill with a dead gauge said "all interlocks healthy"

**Symptom:** with the ETR gauge not ready, the interlock chain correctly reported
broken, but the status reason still read "Mill ready — all interlocks healthy".

**Cause:** `INTERLOCK_LOST` was only raised when the mill was *rolling*.

**Fix:** a broken interlock now takes the mill out of READY as well as out of
ROLLING, and the reason names the cause (`ETR GAUGE NOT READY`). This is the §13.2
requirement applied to the status line, not just the interlock panel.

### 5. The two reels counter-rotated

**Symptom:** DTR reported −39 rpm while ETR reported +140 rpm.

**Cause:** a sign inversion on the payoff reel.

**Fix:** both reels turn the same way in space — they are two pulleys with the
strip running between them. Only their *rate* differs, because the payoff runs at
the entry speed on a shrinking coil and the winder at the exit speed on a growing
one.

### 6. False MAIN DRIVE CURRENT HIGH alarm on a normal pass

**Symptom:** normal pass-1 rolling raised a drive-current alarm at 91% of rating.

**Cause:** the four main-drive placeholders were not mutually consistent, and the
rated torque was too small for the demo schedule.

**Fix:** the four placeholders are now internally consistent
(`P_rated = T_rated × ω_base`: 2000 kW = 80 kNm × 25 rad/s) and sized so the
schedule peaks near 75% of rating. They remain UNVERIFIED and must be replaced
together — changing one alone breaks the relation, which is now stated in the
config.

---

## Conclusion

The application behaves as **one coherent machine**. There is one authoritative
value for every parameter in the §18 list, the physical couplings hold
continuously and are checked live, and the twin degrades honestly when a value is
not available on the active feed.

The remaining gap is not consistency but **calibration**: five parameters that
drive both the physics and the geometry are still placeholders, and the force
model has never been baselined against CRM04. Those are §22 items 1 and 5, and
they are the difference between a twin that behaves correctly and a twin whose
numbers can be quoted.
