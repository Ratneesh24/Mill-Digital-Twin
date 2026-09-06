# Assumptions register

Every value here is a **placeholder**. It is badged `UNVERIFIED` everywhere it
appears in the application (PLANT CONFIG page) and must be replaced with plant
data before any number the twin produces is quoted.

> §2: *Do not silently present placeholders as mill technology data.*

---

## Confirmed — no action needed

| Parameter | Value |
|---|---|
| Mill type | 4HI reversing, single stand |
| Max rolling force | ~700 t |
| Max mill speed | ~500 m/min |
| Thickness tolerance target | ±5 µm |
| AGC | HAGC · servo valves 100 Hz+ · LVDT per side (OS/DS) · entry + exit X-ray gauges |
| Thickness law | Gaugemeter `h = S₀ + F/M` + mass flow |
| Reels | DTR (entry / decoiler), ETR (exit / tension reel), POR (payoff reel) |
| CRM04 coolant | Bamerol Aquarol 411B |
| CRM06 coolant | Servosteeroll C105 |
| Pass schedule source | ABP / plant pass schedule system |

---

## ⚠ UNVERIFIED — geometry and ratings

These drive **both the physics and the 3D geometry**. Replacing one in
`src/config/millConfig.ts` updates the model and the scene together.

| # | Parameter | Placeholder | Used by | Owner |
|---|---|---|---|---|
| 1 | Work roll diameter | 400 mm | Contact length, roll rpm, roll mesh, torque lever arm | Mill engineering |
| 2 | Backup roll diameter | 1150 mm | BUR rpm, roll mesh, housing sizing | Mill engineering |
| 3 | Roll barrel length | 1300 mm | Roll mesh, housing depth, chock placement | Mill engineering |
| 4 | Mill modulus M | 500 t/mm | **Gaugemeter anchor** — sets the whole thickness/force coupling | Mill engineering |
| 5 | Main drive rating | 2000 kW | Power utilisation, alarm thresholds | Mill engineering |
| 6 | Main drive rated torque | 80 kNm | Torque utilisation, current map | Mill engineering |
| 7 | Main drive rated current | 2600 A | Current readout and alarm | Mill engineering |
| 8 | Main drive base speed | 240 rpm | Consistency of the four drive figures | Mill engineering |
| 9 | Reel mandrel diameter | 508 mm | Coil radius from length, reel meshes | Mill engineering |
| 10 | AGC differential force reference | −9 t | OS/DS split and tilt | Mill engineering — §22 item 5 |

**Items 5–8 must be replaced together.** They are mutually consistent as
configured (`P_rated = T_rated × ω_base`: 2000 kW = 80 kNm × 25 rad/s). Changing
one alone breaks that relation and the utilisation bars become misleading.

**Item 4 is the most consequential.** The mill modulus sets how much of a gap
change appears as thickness and how much as force. A wrong `M` makes the twin
qualitatively right and quantitatively wrong everywhere at once.

---

## ⚠ UNVERIFIED — process limits

Pending §22 item 2: *actual force / speed / tension limits per grade family.*

| Parameter | Placeholder | Basis |
|---|---|---|
| Force warning / alarm / trip | 560 / 644 / 700 t | 80% / 92% / 100% of the confirmed 700 t maximum |
| Entry tension envelope | 3–220 kN | Sized for the demo section at 55–125 N/mm² specific tension |
| Exit tension envelope | 5–280 kN | " |
| Specific tension envelope | 10–180 N/mm² | Typical cold-rolling band |
| Acceleration / deceleration | 55 / 70 m/min/s | Plausible for a reversing mill of this size |
| Fast stop deceleration | 260 m/min/s | " |
| Hydraulic pressure at max force | 280 bar | Proportional map, capsule area constant |
| Hydraulic low-pressure alarm | 90 bar | |
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

## Modelling assumptions (structural, not numeric)

These are decisions about **how the mill is represented**, and they should be
reviewed by mill engineering even though they are not numbers.

| Assumption | Rationale | Consequence if wrong |
|---|---|---|
| **DTR and ETR are the two reversing reels; POR holds the next coil, parked with its brake applied.** | §2 names DTR as entry/decoiler, ETR as exit/tension reel, POR as payoff reel. On a reversing mill the two mill reels must swap roles each pass. | If POR actually participates in the pass cycle, the reel role model needs a third state. |
| **FORWARD means the strip travels DTR → ETR.** | Geometric convention: DTR on −X, ETR on +X. | Only the sign convention changes; all role derivation flows from `payoffReel(direction)`. |
| **The roll stack straddles the pass line symmetrically.** | Approximates a 4HI stand with a top-mounted capsule and a fixed bottom BUR. | The pass line would shift with gap rather than staying fixed; a scene-only concern. |
| **The main drive turns the work rolls at 1:1 through the spindles.** | No gearbox data available. | Drive rpm readout would be wrong by the gear ratio; torque and power unaffected. |
| **Reversal dwell times: 1.6 s settle, 2.2 s reposition.** | Stand-ins for brake settling, reel role handover and gap prepositioning. | Only the reversal duration changes. |
| **Both reels rotate the same way in space.** | Two pulleys with the strip running between them. | Verified; a sign error here was found and fixed (see AUDIT.md). |
| **The AGC is fed a filtered gauge signal.** | Represented by feeding it the model thickness rather than the noisy displayed value. | Feeding the noisy value would inject instrument noise into the capsule position. |
| **Hot-band entry variation of ±28 µm, attenuating ×0.55 per pass.** | A real disturbance the AGC exists to reject; without it the twin would misrepresent how the mill behaves. | Deterministic profile, so the amplitude is the only thing to tune against real entry-gauge data. |
| **Strip section and roll gap drawn ×30 in the 3D scene.** | A 2 mm strip between 400 mm rolls is invisible at true scale. Disclosed on screen; the numbers are always true. | Presentation only. |

---

## Demo data — not plant data

| Item | Status |
|---|---|
| Pass schedule (5 passes, 2.800 → 0.900 mm) | **Representative**, not a production schedule for any coil. Labelled DEMO in the UI. |
| Coil `C4-250901-0142`, 620 mm × 2.800 mm, Ø1550 mm, 8.2 t | Constructed for the demo. |
| Grade "IS 513 CR2 / low-carbon drawing quality" | Illustrative. |

---

## Closing these

The register maps directly to §22. In priority order:

1. **§22 item 1** — the ten geometry and rating placeholders above. Highest
   leverage: mill modulus M and work roll diameter.
2. **§22 item 5** — audit the −9 t AGC differential force reference *before* any
   force-model baselining, since baselining against a mill with a known standing
   differential issue would bake that issue into the model.
3. **§22 item 2** — real limits per grade family, which converts the alarm
   thresholds from proportions of the maximum into engineering limits.
4. **§22 item 3** — OEM tag sampling (see LIMITATIONS.md).
5. **§22 item 4** — decide live feed vs historian replay vs both for v1.
