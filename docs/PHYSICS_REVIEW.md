# Gate B — Simulation Physics Consistency Review (§19)

> Run as a cold-rolling process engineer. The goal is **internal physical
> consistency**, not mathematical perfection.

**Result: PASS**, with the model-scope caveat stated at the end.

---

## The eight requirements

### 1. Changing one parameter produces reasonable effects on all dependants (§8.6)

Every row of the §8.6 dependency matrix is exercised by `npm run validate` and
by the twelve live invariants on the VALIDATION page.

| Change | Must affect | Verified |
|---|---|---|
| Mill speed ↑ | roll rpm, strip velocity, reel rpm, drive power, drive current | 250→310 m/min ⇒ WR 193→240 rpm, ETR 135→146 rpm, P 1205→1484 kW |
| Roll gap ↓ | reduction ↑, output thickness ↓, force ↑, torque ↑, current ↑ | −0.05 mm ⇒ h 2.1155→2.0848 mm, F 502→512 t, G 54.1→56.0 kNm, I 1985→2053 A |
| Tension ↑ | force ↓, strip tautness | +60 kN ⇒ F 502→478 t; chevron intensity and strip droop follow |
| Reduction ↑ | force ↑, torque ↑, current ↑ | Same chain as roll gap |
| Pass → next | target thickness, roll gap ref, speed ref, tension refs all change | 2.110→1.630 mm target, capsule prepositioned, refs from the schedule |
| Coil length wound | ETR diameter ↑, DTR diameter ↓, remaining length ↓ | `r = √(r_m² + hL/π)` on both reels; reel rpm falls as the winder fills |

The couplings hold because of **ordering, not enforcement**: the tick evaluates
speed → tension → thickness/force → kinematics → drive → coil, and each step can
only read the outputs of the ones above it. A downstream value cannot fail to
respond to an upstream change, because it is computed from it.

### 2. No random independent values anywhere ✅

There is exactly one source of randomness in the codebase: `SeededRandom` in
`engineeringConfig.ts`, used in exactly one place — `applyGaugeNoise`, at the
X-ray gauge, where a real measurement chain adds scatter.

- The generator is **seeded** (xorshift32), so the simulation is reproducible
  run to run.
- No process value that other values depend on ever receives noise. The AGC is
  fed the model thickness, not the noisy displayed value.
- The incoming hot-band variation — which *is* a disturbance the AGC must reject
  — is a **deterministic** three-harmonic function of coil position, not a random
  walk.

### 3. All engineering calculations centralised in single-purpose functions ✅

| Quantity | Sole owner |
|---|---|
| Reduction, strain, flow stress, contact length, roll rpm, mass flow, specific tension | `simulation/rollingModel.ts` |
| Roll separating force (forward and inverse) | `simulation/forceModel.ts` |
| Delivered thickness, gaugemeter (forward, inverse, target), HAGC, gauge noise | `simulation/thicknessModel.ts` |
| Torque, power, current, hydraulic pressure | `simulation/driveModel.ts` |
| Coil radius, length, layers, reel rpm, reel torque, reel current, mass | `simulation/coilModel.ts` |
| Tension references and loop response | `simulation/tensionModel.ts` |
| Derived engineering indicators (utilisation, consistency, specific energy, throughput) | `machine/rollingEngine.ts` |

No component computes physics. `machine/rollingEngine.ts` computes *indicators*
from `MachineState` — ratios and percentages, never new process values.

### 4. Every approximation documented inline, with its limitation stated ✅

Each model file carries a `LIMITATIONS` block. Consolidated:

- **Force**: mean-pressure form — no friction-hill integration, so the neutral
  point is not located; no thermal softening; no roll crown, bending or flatness,
  so force is uniform across the barrel; elastic entry/exit zones neglected;
  Hitchcock breaks down near the minimum rollable thickness (flattening capped at
  4× nominal).
- **Thickness**: mill modulus `M` treated as constant, where the real mill spring
  curve is measured and mildly force- and width-dependent.
- **HAGC**: single PI on delivered thickness, standing in for a cascaded
  position/pressure loop at 100 Hz+ with MFC, THFF and THFB trims and a separate
  tilt loop.
- **Drive**: constant lever-arm ratio; **no inertia term**, so current during a
  speed ramp is the steady-state value at the new speed; losses in one efficiency
  constant; linear torque→current map with no field weakening.
- **Kinematics**: constant forward slip, where `f` depends on reduction, friction
  and tension.
- **Coil**: zero interlayer air, no coil-set or telescoping; reel torque has no
  inertia or friction term, so torque during acceleration is understated.
- **Tension**: one time constant for the reel drive cascade and the strip's
  elastic storage.
- **Material**: one fitted flow curve for what is really a grade family; no
  recovery or annealing term.
- **Instrument**: white Gaussian gauge noise only — real X-ray gauges also drift,
  standardise, and alias against strip flutter.

### 5. MEASURED / REFERENCE / CALCULATED / SIMULATED / ESTIMATED correct at every render point ✅

Enforced structurally rather than by review:

- `data/tagMap.ts::makeTag` is the **only** constructor of a `Tag`. Provenance is
  resolved there from the tag definition and the operating mode.
- `components/common/ValueReadout.tsx` is the **only** component that prints a
  process value, and it takes a *tag name*. There is no prop that lets a caller
  override the badge.
- A value with provenance `UNAVAILABLE` is forced to `null` at construction, so a
  NO TAG readout cannot carry a number.

Two live invariants on the VALIDATION page check this every frame:
`No simulated value is badged MEASURED` (108 tags checked) and
`NO TAG values carry no number`.

Derived indicators that are *not* tags — utilisation, throughput, specific
energy, pass time remaining — render through `DerivedRow`, in a visibly dimmer
treatment, so they cannot be mistaken for measurements.

### 6. Simulation equations never presented as actual mill technology formulas ✅

- Every model file opens with a `MODEL CLASS` statement naming it a simplified
  textbook relation and disclaiming it as the mill's technology model.
- The PLANT CONFIG page carries the same statement in a warning panel directly
  above the coefficient table.
- The VALIDATION page's `MODEL SCOPE` note says explicitly that passing the
  invariants means the twin is *internally* consistent, not that it is calibrated
  against CRM04.
- The README repeats it as "the most important caveat".

### 7. All coefficients moved into `engineeringConfig.ts` ✅

Every number that influences a physical result is declared there with its unit,
its source and its limitation. The model files contain no numeric literals other
than mathematical constants (0.5 for halving, 1000 for mm↔m, iteration guards).

Plant *dimensions* live in `millConfig.ts`, which also feeds the 3D scene — so
replacing a work roll diameter updates the physics and the geometry together, and
cannot update one without the other.

### 8. The gaugemeter and mass-flow relations are the anchors ✅

This is the requirement that shaped the architecture most.

`h = S₀ + F/M` is not applied as a post-hoc correction — it is **solved
simultaneously with the force model**, because `F` depends on `h` and `h` depends
on `F`. `solveGaugemeter` iterates the fixed point `h_{k+1} = S₀ + F(h_k)/M`
under relaxation until it converges. The residual is published as a diagnostic
and runs at ~0.006 µm.

Mass flow `h₀·v₀ = h₁·v₁` sets the entry speed, and its closure error is
published as a diagnostic — **not** used as a hidden correction, as §8.1
requires. It runs at 0.000% and is shown on the SYSTEM STATUS panel where an
engineer can challenge it.

The 3D scene honours mass flow too: the entry and exit strip spans scroll at
their own speeds, differing by exactly the reduction ratio.

---

## Findings and corrections made during this review

### Hitchcock iteration count was materially wrong

Three fixed-point iterations left the force 15–20% low on a light pass. Roll
flattening on thin strip can reach 2× the nominal radius and converges slowly.
Now iterates up to 8 times with a convergence test on `R'` (`hitchcockIterations`
in config).

### The "harder material" lever was a no-op

`materialFactorScale` multiplied the *accumulated strain*, which is zero on pass
1, so the HIGH FORCE scenario did nothing on the first pass. Replaced with
`flowStressScale`, which multiplies the mean flow stress — the physically
meaningful input.

### Closing the gap under a working AGC does not raise force

The HIGH FORCE scenario originally also offset the gap by −0.09 mm. Under a
closed AGC that has no lasting effect: the loop holds the delivered thickness and
gives the gap back. **This is correct mill behaviour** — a harder coil shows up
as force, not as a thicker strip — so the scenario was changed to use the
material lever alone rather than the model being changed to accommodate the
scenario.

### Drive torque at standstill was non-physical

`2·F·a` was being computed from the standstill capsule load, so a parked mill
reported 231 A. The deformation-torque term is now gated on the mill actually
rolling. The tension-differential term is deliberately not gated, because the
reels genuinely do hold the strip taut at standstill.

### Tension limits were too tight for the demo section

The configured envelope clamped the schedule's own tension references, which
would have silently altered the force. Widened to 3–220 kN entry, 5–280 kN exit
for a 620 mm × 2.8 mm section at 55–125 N/mm².

---

## Can the simplified equations be swapped for the real mill model?

Yes, and the seam is narrow. To adopt the real technology model:

1. Replace the body of `calculateRollingForce` in `simulation/forceModel.ts`.
   Signature: `RollingForceInput → RollingForceResult`.
2. Replace `calculateMeanFlowStress` in `rollingModel.ts` with the plant flow
   curves.
3. If the mill spring is a curve rather than a constant, change `solveGaugemeter`
   to call it instead of dividing by `M`.
4. If the real HAGC law is available, replace `hagcStep`.

Nothing in `src/components`, `src/store`, `src/communication` or `src/machine`
changes. `dataAdapter.ts` still projects the same tags; `ValueReadout` still
prints them; `twinEngine` still drives the scene from them.

---

## Model scope — the honest statement

Passing every check on this page means the twin is **internally consistent**: the
numbers on the 3D scene, the KPI bar and the trend chart are the same numbers,
and they obey the relations in §8.

It does **not** mean the twin is calibrated against CRM04. Five parameters that
drive both the physics and the geometry are placeholders (work roll diameter,
backup roll diameter, barrel length, mill modulus M, main drive rating), the
material model is a generic low-carbon fit rather than a plant grade family, and
the force model has never been baselined — which §22 item 5 flags as blocked
behind the standing −9 t AGC differential force reference audit.

Until those close, the twin demonstrates **behaviour**, not **values**.
