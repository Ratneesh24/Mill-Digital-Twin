# How the simulation works

> **Model class.** These are simplified textbook cold-rolling relations chosen so
> the twin is *internally consistent*. They are **not** the mill's technology
> model (§19.6). Every coefficient lives in `config/engineeringConfig.ts`; there
> are no magic numbers in the model files. The whole point of the layering is
> that the real ABP / mill-technology model can replace `src/simulation/*`
> without the frontend noticing.

---

## The tick

`simulation/simulationEngine.ts` evaluates in this order every 100 ms. Each step
consumes only the outputs of the steps above it, which is how the §8.6 dependency
matrix is honoured **by construction** rather than by convention.

| # | Step | Produces |
|---|---|---|
| 1 | Interlocks | mill ready, blocking reason |
| 2 | State machine | status, status reason |
| 3 | Pass change / reversal sequencing | pass number, direction, reel roles, gap preposition |
| 4 | Speed ramp | mill speed |
| 5 | Tension loops | entry / exit tension |
| 6 | **Gaugemeter solve** | delivered thickness **and** roll force, coupled |
| 7 | Kinematics | entry speed, roll rpm, reel rpm |
| 8 | Drive | torque, power, current |
| 9 | Coil geometry | diameters, lengths, remaining length |

Step 3 runs *before* the pass entry is read so that every value in the emitted
frame belongs to the same pass.

---

## 1. Thickness — the gaugemeter, and why it is the anchor

```
h = S₀ + F / M
```

`S₀` is the unloaded roll gap position (what HAGC commands), `F` the roll
separating force, `M` the mill modulus. It says the stand is a spring: press
harder and the housing, chocks and rolls stretch, so the delivered strip is
thicker than the gap you set.

**F depends on h and h depends on F**, so the pair is coupled and must be solved
simultaneously. `thicknessModel.solveGaugemeter` does this by under-relaxed fixed
point iteration:

```
h_{k+1} = S₀ + F(h_k) / M          relaxation 0.6, up to 12 iterations
```

This is the same relationship the real stand obeys mechanically. Solving it —
rather than picking `h` and back-calculating `F`, or vice versa — is what makes
force, gap and thickness *mutually* consistent instead of three independent
numbers. The residual `|h − (S₀ + F/M)|` is published as a diagnostic and shown
on the SYSTEM STATUS panel; it runs at about **0.006 µm**.

**Limitation:** `M` is a constant. On a real mill the modulus is mildly force-
and width-dependent and the mill spring curve is *measured*, not assumed.
Replacing the constant with a curve is a change to this one function.

### Inverse forms

```
S₀ = h − F/M                              inverseGaugemeter()
S₀ for a target h                          gapPositionForTargetThickness()
```

The first is what the twin uses on the 46-tag feed to produce a CALCULATED roll
gap where no LVDT tag exists. The second is the AGC position pre-set, used to
preposition the capsule before each pass so the mill starts on gauge rather than
hunting for it.

### HAGC

PI on thickness error, output is `S₀`, slew-rate limited:

```
e  = h_measured − h_reference
S₀ ← S₀ − (Kp·e + Ki·∫e dt)          Kp = 0.55, Ki = 0.9, slew 4.0 mm/s
```

Integrator clamped to ±0.5 mm for anti-windup. To make the strip thinner the loop
closes the gap.

**Limitation:** the real HAGC is a cascaded position/pressure loop at 100 Hz+
with mass-flow (MFC), feed-forward (THFF) and feedback (THFB) trims and a
separate tilt loop. This is a single PI on delivered thickness and should be read
as "AGC is closing the loop", not as the mill's control law.

### The disturbance the AGC exists to reject

An as-rolled hot band carries longitudinal gauge variation of roughly ±1%.
Without it the thickness trend would be pure instrument noise and the AGC would
have nothing to do, which would make the twin misleading about how the mill
actually behaves. It is modelled as a fixed three-harmonic profile in coil
position — deterministic, so the simulation stays reproducible — with amplitude
±28 µm on pass 1, attenuating ×0.55 per pass because successive passes
progressively iron the variation out.

---

## 2. Roll separating force

Mean-pressure form (Bland–Ford / Hill) with Hitchcock roll flattening.
`simulation/forceModel.ts`.

```
Δh   = h₀ − h₁                              draft, mm
ε    = ln(h₀/h₁)                            true strain
kf   = kf₀(1 + Cε)ⁿ integrated over the pass  mean flow stress, MPa
k    = 1.1547 · kf                          plane-strain resistance (2/√3)
σm   = (σ_entry + σ_exit)/2                 mean tension stress, MPa
R'   = R(1 + 16(1−ν²)·F'/(π·E·Δh))          Hitchcock flattened radius
L    = √(R'·Δh)                             contact length, mm
hm   = (h₀ + h₁)/2                          mean thickness, mm
Q    = 1 + µ·L/(2·hm)                       friction-hill multiplier
p    = (k − σm)·Q                           mean roll pressure, MPa
F    = p · L · w                            separating force, N
```

`R'` depends on `F` and `F` depends on `R'`, so the pair is solved by fixed point
iteration — **8 iterations, not 3**. On thin strip `R'` can approach 2× nominal;
three iterations under-predicts force by 15–20% on a light pass.

The tension term enters as `(k − σm)`: applied tension does part of the work of
deformation, so the rolls supply less. That is the mechanism behind the §8.6
coupling *tension ↑ → force ↓*, and it is verified by the validation harness
(force falls 502 → 478 t when entry and exit tension are raised 60 kN).

**Limitations**
- Mean-pressure form: no explicit friction-hill integration, so the neutral point
  is not located and the pressure distribution is not resolved.
- No thermal softening, no roll or strip temperature.
- No roll crown, bending or flatness effects — force is treated as uniform across
  the barrel, which is why OS/DS split is a Phase 2 item.
- Elastic entry/exit zones are neglected.
- Hitchcock assumes elastic Hertzian flattening of a circular roll and breaks
  down as the strip approaches the minimum rollable thickness. Flattening is
  capped at 4× nominal so a numerical excursion cannot produce a non-physical
  contact length.

### Strain accumulates across passes

`kf` is integrated analytically over the pass, starting from the strain the
material already carries:

```
kf_mean = (1/(ε₁−ε₀)) ∫ kf₀(1 + Cε)ⁿ dε
        = kf₀[(1+Cε)ⁿ⁺¹]/(C(n+1)) evaluated ε₀→ε₁, divided by (ε₁−ε₀)
```

This is what makes pass 5 harder than pass 1 on the same steel, and why the
schedule builder walks the passes in order rather than treating each in
isolation. On the demo coil the accumulated strain reaches 0.95 by pass 5.

### Inverse form — the 46-tag feed

Roll separating force is **not** in the CRM04 historian extract, but
`MILL_ACT_TRQ` is. Rearranging the torque relation:

```
F = G_roll / (2·λ·L)                        estimateForceFromTorque()
```

Badged **ESTIMATED**, never MEASURED. Any error in λ, in the tension-torque
split, or in the assumed contact length propagates directly into the estimate —
treat it as an indication of trend, not a calibrated force reading.

---

## 3. Torque, power, current

```
a       = λ · L                             lever arm, λ = 0.45
G_roll  = 2 · F · a                         both work rolls, kNm — only while rolling
G_tens  = R_wr · (T_back − T_front)         tension differential, kNm
G       = G_roll + G_tens
P       = G · ω / η                         shaft power, kW, η = 0.92
I       = I_rated · G / G_rated             armature current, A
```

The tension term is **signed on purpose**. Front (exit) tension is applied by the
exit reel, which does part of the pulling, so the mill motor needs *less* torque.
Back (entry) tension drags against the rolls and costs *more*. Getting this sign
right is what makes "raise exit tension → mill current falls" behave the way an
operator expects.

`G_roll` is gated on the mill actually rolling. A stand parked with the capsule
loaded still carries a separating force — the rolls are pressing on stationary
strip — but it is doing no deformation work, so there is no rolling torque. The
tension differential torque *does* persist at standstill, because the reels hold
the strip taut and the mill motor holds against the difference. (Without this
gate the twin showed a stopped mill drawing 231 A, which the validation harness
caught.)

**Limitations**
- Constant lever-arm ratio λ; the true lever arm shifts with the friction hill.
- **No inertia term** — acceleration torque during a ramp is not modelled, so the
  current shown during a speed change is the steady-state value at the new speed.
- Bearing, seal and spindle losses folded into one efficiency constant.
- Current mapped linearly from torque (DC / field-oriented approximation). No
  field weakening above base speed.

---

## 4. Kinematics and mass flow

```
v_exit    = v_roll · (1 + f)                forward slip f = 0.03
rollRPM   = v_surface / (π · D)             §8.4
burRPM    = v_surface / (π · D_bur)         equal surface speed at the contact
h₀·v₀     = h₁·v₁                           mass flow — entry speed follows
reelRPM   = v / (2π·r)
```

Rotation is **derived from speed**. There is not one animation timer in the
codebase, so zero speed necessarily means zero rpm — and the validation harness
checks `rollRPM == v/(π·D)` to 1% continuously.

Deriving the roll surface speed from the strip speed via forward slip (rather
than setting it independently) is what keeps the §8.6 coupling honest. The
mass-flow closure error is published as a **diagnostic** — the sim never silently
corrects itself with it — and runs at 0.000%.

The entry and exit strip spans in the 3D scene scroll at their own speeds for
this reason: the entry side runs slower than the exit side by exactly the
reduction ratio, and a twin that scrolled both at the same rate would be quietly
contradicting its own thickness model.

**Limitation:** forward slip is constant; it actually depends on reduction,
friction and tension.

---

## 5. Coil model

```
r(L) = √(r_m² + h·L/π)                      area conservation, exact
n     = (r − r_m)/h                         wraps
G     = T · r                               reel torque
L₁    = L₀ · h₀/h₁                          length after reduction
```

The radius relation follows from equating the wound cross-sectional area
`π(r² − r_m²)` to `h·L`. It is exact for a tightly wound spiral of constant
thickness, and it is why the reel diameters move at the correct *decelerating*
rate rather than linearly, and why the outer reel visibly slows as it fills.

Reel torque rises as the coil builds even at constant tension — the behaviour
that makes ETR torque climb through a pass while DTR torque falls.

**Limitations:** zero interlayer air, no coil-set or telescoping, no inertia or
friction term in the reel torque (so torque during acceleration is understated).

---

## 6. Tension

Reference comes from the pass schedule as a **specific** tension (N/mm²), because
that is the quantity that stays meaningful as the strip gets thinner:

```
T_entry = σ_entry · h_entry · w             on the INCOMING thickness
T_exit  = σ_exit  · h_exit  · w             on the DELIVERED thickness
```

Using the same thickness for both is a common modelling error that makes the
tension torque split wrong.

The loop response is a first-order lag, discretised exactly so it is identical at
any tick rate:

```
T ← T_ref + (T − T_ref)·e^(−dt/τ)           τ = 0.55 s
```

Tension is scaled down at standstill and ramped in over the threading band — a
stopped mill holds a residual tension from the reel brakes, not the full rolling
reference. Showing full tension on a stopped mill is one of the classic twin
inconsistencies.

**Limitation:** one time constant stands in for the reel drive's speed/current
cascade and the strip's elastic storage between reel and bite.

---

## Coefficients

Every one is in `config/engineeringConfig.ts` with its unit, source and
limitation. Summary:

| Coefficient | Value | Note |
|---|---|---|
| `materialFactor` kf₀ | 450 MPa | Representative mean flow stress, low-carbon CR grade. A single scalar cannot represent a grade family. |
| `hardeningCoefficient` C | 8.0 | Ludwik-type fit, 0 < ε < 1.4. Fitted shape, not a measured curve. |
| `hardeningExponent` n | 0.22 | " |
| `frictionFactor` µ | 0.045 | Cold rolling with oil emulsion. Constant; real friction varies with speed, concentration, roll roughness. |
| `mechanicalEfficiency` η | 0.92 | All drive-train losses in one number. |
| `millModulus` M | 500 t/mm | **UNVERIFIED.** Gaugemeter spring constant. |
| `leverArmRatio` λ | 0.45 | 0.4–0.5 is the accepted band for cold rolling. |
| `forwardSlip` f | 0.03 | Keeps roll speed and strip speed consistent so mass flow closes. |
| `planeStrainFactor` | 1.1547 | 2/√3, von Mises. |
| `hitchcockIterations` | 8 | 3 under-predicts force by 15–20% on a light pass. |
| `rollYoungsModulus` E | 210 000 MPa | Forged steel roll. |
| `hagcGainP` / `hagcGainI` | 0.55 / 0.9 | Tuned for stability at the 10 Hz tick. |
| `hagcSlewRate` | 4.0 mm/s | Servo capsule capability. |
| `tensionTimeConstant` τ | 0.55 s | |
| `gaugeNoise.sigma` | 1.1 µm | Applied at the X-ray gauge only. White noise; real gauges also drift and alias with strip flutter. |
| `acceleration` / `deceleration` | 55 / 70 m/min/s | |
| `fastStopDeceleration` | 260 m/min/s | |
| `thicknessTolerance` | 5 µm | Confirmed plant target. |
| `staleAfterMs` | 3000 | §14.5 staleness watchdog. |
| `simulationTickMs` | 100 | 10 Hz, one of the §14.2 target rates. |

Force limits are derived from the confirmed 700 t maximum: warning 80% (560 t),
alarm 92% (644 t), trip 100%.

---

## Demo pass schedule

Representative narrow-complex schedule, **not** a production schedule for any
specific coil. Coil: 620 mm × 2.800 mm hot band, Ø1550 mm, 601.5 m, 8.2 t.

| Pass | Dir | In → Out (mm) | Red % | Speed (m/min) | σ entry | σ exit | Force (t) |
|---|---|---|---|---|---|---|---|
| 1 | FWD | 2.800 → 2.110 | 24.6 | 250 | 55 | 90 | 499 |
| 2 | REV | 2.110 → 1.630 | 22.7 | 300 | 65 | 95 | 527 |
| 3 | FWD | 1.630 → 1.320 | 19.0 | 340 | 75 | 100 | 490 |
| 4 | REV | 1.320 → 1.080 | 18.2 | 380 | 85 | 110 | 480 |
| 5 | FWD | 1.080 → 0.900 | 16.7 | 420 | 100 | 125 | 455 |

Total reduction 67.9%; forces peak at 75% of the 700 t rating; the schedule
completes in about 20 minutes of mill time and finishes at 1622 m of 0.900 mm
strip.

**The force column is not hand-entered.** It is computed by the same force model
that produces the live reading, so REF and actual agree in steady state and any
divergence an operator sees is real (AGC working, tension lag) rather than an
artefact of two different formulas.

---

## Scenarios

A scenario is a set of **modifiers on the physics inputs**, never a set of fake
outputs. Selecting HIGH FORCE does not write a large number into the force
display — it makes the material 22% harder, and the force that results comes out
of the same equations as always.

That distinction matters, and it produced a genuine correction during
development. HIGH FORCE originally also closed the gap 0.09 mm. With AGC closed
that does nothing: the loop holds the delivered thickness and simply gives the
gap back. Which is exactly what a real mill does — under a working AGC, a harder
coil shows up as *force*, not as a thicker strip. The scenario now uses the
material lever alone.

| Scenario | Lever | Validates |
|---|---|---|
| Normal production | — | |
| High rolling force | flow stress ×1.22 | §17 test 7 |
| Thickness excursion | gap +0.05 mm, AGC open | §17 test 7 |
| AGC off | AGC open | |
| Hydraulic pressure low | HAGC pressure factor | |
| ETR gauge not ready | gauge ready false | §13.2 named-cause interlock |
| Communication loss | engine stops publishing | §17 test 8 |
| Emergency stop | E-stop asserted | §17 test 6 |

---

## Verification

`npm run validate` drives the engine at a fixed 0.1 s step and asserts 60 checks:
all ten §17 behaviours, the §18 coupling invariants, and a full five-pass
schedule run. Representative results at steady rolling on pass 1:

```
Work roll rpm = v/(π·D)          193.15 vs 193.15 rpm
BUR rpm scales with diameter      67.18 vs  67.18 rpm
Mass flow closes                   0.0000 %
Entry speed = v·h₁/h₀            187.7 vs 187.8 m/min
Payoff reel rpm = v/2πr           39.005 vs 39.005 rpm
Gaugemeter h = S₀ + F/M          residual 0.0059 µm
Thickness deviation                1.93 µm  (target ±5)
Rolling force                       504 t of 700 t
```
