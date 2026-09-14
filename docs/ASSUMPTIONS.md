# Assumptions register

Most of the machine data in this twin now comes from the OEM manual — Flat
Products Equipments (I) Ltd., *CRM04 Operation & Maintenance Manual*, 231 pp.,
reproduced in [CRM04_MECHANICAL_DATA_BOOK.md](CRM04_MECHANICAL_DATA_BOOK.md).
Those values are badged `Confirmed — FPE O&M manual` on the PLANT CONFIG page
and cite a section reference in `src/config/millConfig.ts`.

What remains here is what the manual **cannot** close. There are only two kinds:

1. Values the manual does not state anywhere (mill modulus, armature currents).
2. Values its own §14 register records as **illegible in the scanned drawings** —
   every centre-line spacing on the line, and the pass-line elevation.

Both are badged `UNVERIFIED` everywhere they appear and must be replaced with
plant data before any number the twin produces is quoted.

> §2: *Do not silently present placeholders as mill technology data.*

---

## Confirmed — FPE O&M manual

| Parameter | Value | Source |
|---|---|---|
| Mill type | 4-Hi reversing cold rolling mill, single stand | §1.1 |
| Mill hand | **Right to left** | §1.1 |
| Material | Low, medium and high carbon steel, 0.05 – 1.03 % C | §1.1 |
| Max roll separating force | **360 T** | §1.1 |
| Mill speed | 0 – 170 – 450 m/min | §1.1 |
| Strip width | 250 – 500 mm | §1.2 |
| Incoming thickness | 1.6 – 4.5 mm | §1.2 |
| Outgoing thickness | 0.30 – 3.00 mm | §1.2 |
| Coil weight | 10 T, 20 kg/mm max · ID 508 · OD 1900 max | §1.2 |
| Work roll | Ø202 – Ø215 working, 600 barrel, 92–97 Shore C | §1.3 |
| Back-up roll | Ø520 – Ø550 working, 600 barrel, 65–70 Shore C | §1.3 |
| Roll neck bearings | Timken TQO 4-row taper roller, grease packed | §1.3, §10.4 |
| Roll force cylinder | Ram type, Ø420 × 45 mm stroke, one per housing, 210 / 250 kg/cm² | §1.4, §6.2 |
| Tension reel mandrel | Ø497 collapsed / Ø508 expanded, 620 face, overhung 4-segment | §7.1 |
| Pay-off reel mandrel | Ø460 collapsed / Ø530 expanded, 680 barrel | §5.2 |
| Reel tension | 6900 kg to 350 m/min · 5300 kg to 450 m/min · 690 kg minimum | §1.4 |
| Pay-off reel tension | 2500 kg | §1.4 |
| Main drive | 750 kW, 0 – 350 – 710 rpm, Kirloskar KLDC 630-L | §2.1 |
| ETR / DTR drives | 500 kW, 0 – 438 – 1350 rpm, BSSL | §2.1 |
| POR drive | 70 kW, 0 – 435 – 1640 rpm, BSSL | §2.1 |
| Gear ratios | POR 99.37:1 · ETR/DTR 4.3333:1 · mill pinion 1:1 · flattener 20:1 | §2.3 |
| **Line centre-line order** | POR → pinch roll/flattener → ETR → entry deflector → MILL → delivery deflector → DTR | §3 |
| Pinch roll cum flattener | 2 × Ø250 pinch, 3 × Ø200 leveller, 600 barrel, ~30 m/min | §5.4 |
| Deflector rolls | Ø300 × 600 alloy steel, encoders on OS **and** DS | §5.6 |
| Crop shear | Down-cut, hydraulic, delivery side | §5.7 |
| Thickness gauges | Isotope non-contact, entry and delivery | §5.8 |
| Air knife wipers | Pneumatic, 4–5 bar, 0.1–0.3 mm gap maintained | §5.9 |
| Mae-west blocks | Four, entry/delivery × OS/DS; 3 mm BUR-to-WR centre offset | §6.3 |
| Roll coolant flow | 1200 LPM, paper band filter, Bamerol Aquarol 411B | §9.1 |
| Fume exhaust | 40,000 m³/hr centrifugal, 50 HP, V-belt | §9.4 |
| Thickness tolerance target | ±5 µm | §2 (plant) |
| AGC | HAGC · servo valves 100 Hz+ · LVDT per side (OS/DS) · entry + exit gauges | §2 (plant) |
| Thickness law | Gaugemeter `h = S₀ + F/M` + mass flow | §2 (plant) |
| Pass schedule source | ABP / plant pass schedule system | §2 (plant) |

---

## ⚠ UNVERIFIED — not stated in the manual

| # | Parameter | Placeholder | Used by | Owner |
|---|---|---|---|---|
| 1 | **Mill modulus M** | 500 t/mm | **Gaugemeter anchor** — sets the whole thickness/force coupling | Mill engineering |
| 2 | Main drive rated armature current | 1400 A | Current readout and alarm | Mill engineering |
| 3 | Reel drive rated current | 1100 A | Reel current readout | Mill engineering |
| 4 | AGC differential force reference | −9 t | OS/DS split and tilt | Mill engineering — §14 item 11 |

**Item 1 is the most consequential.** The mill modulus sets how much of a gap
change appears as thickness and how much as force. A wrong `M` makes the twin
qualitatively right and quantitatively wrong everywhere at once. The FPE manual
does not give it; it has to be measured on the stand.

The manual gives kW and rpm for every drive on the line but no armature current
anywhere, which is why items 2 and 3 survive. Note that the drive **torques** are
no longer placeholders — they are derived from the confirmed nameplates
(`750 kW / 350 rpm = 20.5 kNm`, `500 kW / 438 rpm × 4.3333 = 47 kNm`).

---

## ⚠ UNVERIFIED — line centre-line spacings

The manual's §14 item 1 records these as *"dimensioned on EU 01 1 A1 but not
legible in the scan"*. **The ordering is confirmed; the magnitudes are not.**
They are a plausible reconstruction, live in `millConfig.lineLayout`, and drive
the 3D layout only — no physics depends on them.

| Station | Reconstructed distance from mill C/L |
|---|---|
| Air knife wiper | 450 mm |
| Isotope gauge | 900 mm |
| Deflector roll | 1500 mm |
| Crop shear (delivery) | 2400 mm |
| ETR / DTR | 4200 mm |
| Carry-over table | 5600 mm |
| Pinch roll cum flattener | 6700 mm |
| Peeler | 7500 mm |
| Pay-off reel | 8600 mm |
| Pass line height above floor | 900 mm (§14 item 2) |
| Housing window | 1600 × 3500 mm (§14 item 2, scene only) |

They must be measured off the original drawing before use in anything beyond
the picture.

---

## ⚠ UNVERIFIED — process limits

Pending real limits per grade family.

| Parameter | Value | Basis |
|---|---|---|
| Force warning / alarm / trip | 288 / 331 / 360 t | 80% / 92% / 100% of the **confirmed** 360 T maximum |
| Tension envelope, both reels | 6.8 – 67.7 kN | Converted from the confirmed 690 / 6900 kgf (§1.4) |
| Specific tension envelope | 10–180 N/mm² | Typical cold-rolling band |
| Acceleration / deceleration | 55 / 70 m/min/s | Plausible for a reversing mill of this size |
| Fast stop deceleration | 260 m/min/s | " |
| Hydraulic pressure at max force | ~127 bar | **Derived**, not guessed: 360 T over two Ø420 rams, inside the confirmed 210 kg/cm² working limit |
| Hydraulic low-pressure alarm | ~41 bar | Same proportion of full load as before |
| Stale-data threshold | 3000 ms | 30× the 10 Hz publish period |

---

## ⚠ UNVERIFIED — material model

| Parameter | Placeholder | Limitation |
|---|---|---|
| Base flow stress kf₀ | 450 MPa | Representative of a low-carbon CR grade. A single scalar cannot represent a grade family. |
| Hardening C, n | 8.0, 0.22 | Ludwik-type fit over 0 < ε < 1.4. Fitted shape, not a measured curve for any Tata grade. |
| Friction coefficient µ | 0.045 | Typical for an oil emulsion. Constant; real friction varies with speed, concentration and roll roughness. |
| Lever arm ratio λ | 0.45 | Within the accepted 0.4–0.5 band. Constant. |
| Forward slip f | 0.03 | Constant; depends on reduction, friction and tension. |
| Mechanical efficiency η | 0.92 | All drive-train losses in one number. |
| Gauge noise σ | 1.1 µm | Chosen so a healthy AGC stays inside ±5 µm with realistic scatter. |

---

## Contradictions inside the manual itself

These are not modelling choices — they are places where the OEM document
disagrees with itself, carried as open items rather than resolved by guessing.

| # | Item | What the twin does |
|---|---|---|
| 5 | **Crop shear quantity.** Chapter 2 lists one shear at delivery; Chapter 5's heading says two; the drawing register carries only EU 28 4 A1 (exit) — yet the §12.5 tail-transfer sequence requires an entry-side cut. | Models **one**, at delivery — the one the drawing register can prove. |
| 6 | **Mae-west 3 mm offset direction.** The manual states the offset between BUR and WR centres and how it is produced (entry/delivery block width difference), but not its sign relative to the first pass. | Draws the block-width difference and claims nothing about direction. |
| 7 | **Roll force cylinder area.** Chapter 1 gives Ø420 × 45 stroke; Table I gives Ø420 × Ø380 × 45. Ram vs annulus changes the effective area. | Uses full bore area for the pressure map. Confirm before quoting pressures. |
| 3 | Coil car **lift height** — spec line degraded in the source. Travel 3400 mm and cylinder stroke 800 mm are confirmed. | Draws a plausible lift. |
| 4 | **Incoming** coil OD — spec line garbled in the source. Outgoing OD 1900 max is confirmed. | Uses the outgoing limit for both. |

---

## Modelling assumptions (structural, not numeric)

These are decisions about **how the mill is represented**, and they should be
reviewed by mill engineering even though they are not numbers.

| Assumption | Rationale | Consequence if wrong |
|---|---|---|
| **POR holds the next coil, parked with its brake applied; the pass cycle runs between ETR and DTR.** | On the real first pass the strip runs POR → peeler → flattener → carry-over table → over an *idle* ETR → mill → DTR, and ETR only becomes a coiler from pass 2 (§3, §12.1–12.5). The twin does not model that threading pass. | The first pass is shown paying off from ETR rather than POR. Modelling it properly needs a pass-0 threading state in the simulation engine. |
| **FORWARD means the strip travels ETR → DTR.** | Geometric convention following §3: ETR on −X with POR and the flattener outboard of it, DTR on +X. | Only the sign convention changes; all role derivation flows from `payoffReel(direction)` in `reversingEngine.ts`. |
| **The default camera stands on the −Z side of the barrel.** | So the entry end renders on screen-right and the first pass reads right-to-left, which is the mill's stated hand (§1.1). | Presentation only. One sign in `millConfig.visual.cameraSideZ` moves the camera and every scene label together. |
| **The roll stack straddles the pass line symmetrically.** | Approximates a 4HI stand with a top-mounted ram and a fixed bottom BUR. | The pass line would shift with gap rather than staying fixed; a scene-only concern. |
| **The main drive turns the work rolls at 1:1 through the spindles.** | **Now confirmed** — FLENDER SPL 260-2 pinion stand, 1:1 (§2.3). | — |
| **Reversal dwell times: 1.6 s settle, 2.2 s reposition.** | Stand-ins for brake settling, reel role handover and gap prepositioning. | Only the reversal duration changes. |
| **Both reels rotate the same way in space.** | Two pulleys with the strip running between them. | Verified; a sign error here was found and fixed (see AUDIT.md). |
| **The auxiliary line equipment is geometry only.** | Peeler, flattener, carry-over table, crop shear, snubber, coil cars, saddles and air knives have no tags on this feed. They are drawn static, in the state they hold during rolling. | Nothing is animated that cannot be measured. The equipment inspector reports NOT INSTRUMENTED rather than borrowing an adjacent tag. |
| **The deflector rolls DO rotate.** | The strip wraps them, so their surface speed is the strip speed, and §5.6 puts the AGC speed encoders on them (OS and DS). | The one animated part of the auxiliary line, and the only one with a real binding. |
| **The mill enclosure is drawn transparent.** | §6.10's shutter is closed during rolling and genuinely hides the bite. Reproducing that faithfully would defeat the twin's purpose. | Presentation only; hidden entirely in the STAND view. |
| **The AGC is fed a filtered gauge signal.** | Represented by feeding it the model thickness rather than the noisy displayed value. | Feeding the noisy value would inject instrument noise into the capsule position. |
| **Hot-band entry variation of ±28 µm, attenuating ×0.55 per pass.** | A real disturbance the AGC exists to reject; without it the twin would misrepresent how the mill behaves. | Deterministic profile, so the amplitude is the only thing to tune against real entry-gauge data. |
| **Strip section and roll gap drawn ×30 in the 3D scene.** | A 2 mm strip between 215 mm rolls is invisible at true scale. Disclosed on screen; the numbers are always true. | Presentation only. |

---

## Demo data — not plant data

| Item | Status |
|---|---|
| Pass schedule (5 passes, 2.800 → 0.900 mm, 180 → 420 m/min) | **Representative**, not a production schedule for any coil. Labelled DEMO in the UI. Sized so peak force is ~72% of the 360 T rating and every pass sits between 77% and 89% of the 750 kW drive. |
| Coil `C4-250901-0142`, 450 mm × 2.800 mm, Ø508 → Ø1800, 8.3 t | Constructed for the demo, inside every §1.2 limit. |
| Grade "IS 513 CR2 / low-carbon drawing quality" | Illustrative, within the 0.05–1.03 % C envelope. |

---

## Closing these

In priority order:

1. **Mill modulus M** — the single highest-leverage unknown left. Everything else
   the manual closed; this one it never had.
2. **The AGC differential force reference** (standing −9 t issue, with the Mill 4
   back-up roll barrel taper DS > OS). Audit it *before* any force-model
   baselining — baselining against a mill with a known standing differential
   would bake that issue into the model.
3. **The centre-line spacings**, off the original EU 01 1 A1. Cheap to close and
   it removes the last unverified geometry from the scene.
4. **The manual's own contradictions** above, resolved against the plant — the
   crop shear count in particular, since the tail-transfer sequence needs a cut
   the equipment register does not list.
5. **Real limits per grade family**, which converts the alarm thresholds from
   proportions of the maximum into engineering limits.
6. **OEM tag sampling** (see LIMITATIONS.md), then live feed vs historian replay
   for v1.
