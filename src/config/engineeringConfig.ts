/**
 * ENGINEERING CONFIGURATION — §8 of the master spec.
 *
 * EVERY coefficient used by any equation in `src/simulation` lives here.
 * There are no magic numbers in the model files: if a number influences a
 * physical result, it is declared in this file with its unit, its source and
 * its limitation.
 *
 * IMPORTANT (§19.6): these are SIMPLIFIED TEXTBOOK RELATIONS chosen so the twin
 * is internally consistent. They are NOT the mill's technology model. Swapping
 * in the real ABP / mill-technology model means replacing the functions in
 * `src/simulation/*` — the frontend never sees the difference.
 */

import { millConfig } from './millConfig'

export interface EngineeringConfig {
  /** Base deformation resistance (mean flow stress at zero strain), MPa. */
  materialFactor: number
  /** Strain-hardening multiplier in kf = kf0·(1 + C·ε)^n, dimensionless. */
  hardeningCoefficient: number
  /** Strain-hardening exponent n, dimensionless. */
  hardeningExponent: number
  /** Coulomb friction coefficient in the roll bite, dimensionless. */
  frictionFactor: number
  /** Mechanical efficiency of the drive train, 0..1. */
  mechanicalEfficiency: number
  /** Mill modulus M, t/mm — the gaugemeter spring constant (§8.1). */
  millModulus: number
  /** Young's modulus of the roll material, MPa (Hitchcock flattening). */
  rollYoungsModulus: number
  /** Poisson ratio of the roll material, dimensionless. */
  rollPoissonRatio: number
  /** Lever-arm ratio a/L for cold rolling torque, dimensionless. */
  leverArmRatio: number
  /** Forward slip at the roll exit, dimensionless (v_exit = v_roll·(1+f)). */
  forwardSlip: number
  /** Plane-strain factor 2/√3 for the von Mises criterion, dimensionless. */
  planeStrainFactor: number
  /** Max fixed-point iterations for the Hitchcock force/flattening coupling. */
  hitchcockIterations: number
  /** Convergence tolerance on the flattened radius, mm. */
  hitchcockToleranceMm: number

  forceLimits: { warning: number; alarm: number; trip: number }
  motorLimits: { currentMax: number; powerMax: number; torqueMax: number }
  tensionLimits: { entryMin: number; entryMax: number; exitMin: number; exitMax: number }
  speedLimits: { max: number; threadingSpeed: number }
  /** Specific tension envelope, N/mm² — used to validate schedule entries. */
  specificTensionLimits: { min: number; max: number }

  /** Thickness tolerance, µm (±). */
  thicknessTolerance: number
  /** X-ray gauge noise, 1σ in µm. */
  gaugeNoise: { sigma: number }

  /** Mill acceleration, m/min per second. */
  acceleration: number
  /** Normal deceleration, m/min per second. */
  deceleration: number
  /** Fast-stop deceleration, m/min per second. */
  fastStopDeceleration: number

  /** HAGC actuator slew rate, mm/s. */
  hagcSlewRate: number
  /** HAGC proportional gain, mm of S0 per mm of thickness error. */
  hagcGainP: number
  /** HAGC integral gain, mm of S0 per mm·s of thickness error. */
  hagcGainI: number
  /** Tension loop first-order time constant, s. */
  tensionTimeConstant: number

  /** Hydraulic loading pressure at maximum force, bar. */
  hydraulicPressureAtMaxForce: number
  /** Hydraulic low-pressure alarm limit, bar. */
  hydraulicPressureMin: number
  /** Low-pressure lubrication system nominal pressure, bar. */
  lpSystemPressure: number

  /** Frame considered stale after this many ms without an update (§14.5). */
  staleAfterMs: number
  /** Simulation tick period, ms. */
  simulationTickMs: number
  /** UI/telemetry sampling period, ms — decoupled from the 3D frame loop (§15). */
  telemetrySampleMs: number
  /** Chart repaint period, ms — throttled independently of the 3D loop (§12). */
  chartRefreshMs: number

  /** Fixed-point solver settings for the coupled gaugemeter/force problem. */
  solver: { maxIterations: number; toleranceMm: number; relaxation: number }
}

/**
 * Steel density, kg/m³ — used only for coil mass and inertia display.
 * Standard value for low-carbon steel; not a tuning parameter.
 */
export const STEEL_DENSITY = 7850

/** Standard gravity, m/s² — for the t ↔ kN conversion. */
export const GRAVITY = 9.80665

export const engineeringConfig: EngineeringConfig = {
  /**
   * Low-carbon cold-rolling grade, annealed hot band. 450 MPa is a representative
   * mean flow stress before hardening. LIMITATION: a single scalar cannot
   * represent a grade family; the real model uses a per-grade flow curve.
   */
  materialFactor: 450,
  /**
   * kf = kf0·(1 + C·ε)^n with C = 8.0, n = 0.22 — a Ludwik-type hardening fit for
   * low-carbon steel over 0 < ε < 1.4. LIMITATION: fitted shape only, not a
   * measured curve for any specific Tata grade.
   */
  hardeningCoefficient: 8.0,
  hardeningExponent: 0.22,
  /**
   * µ = 0.045 — typical for cold rolling with a rolling-oil emulsion
   * (Bamerol Aquarol 411B / Servosteeroll C105). LIMITATION: friction actually
   * varies with speed, emulsion concentration and roll roughness; here it is a
   * constant.
   */
  frictionFactor: 0.045,
  mechanicalEfficiency: 0.92,
  millModulus: millConfig.ratings.millModulus,
  /** Forged steel work roll. */
  rollYoungsModulus: 210_000,
  rollPoissonRatio: 0.3,
  /**
   * a/L = 0.45. In cold rolling the resultant acts between the neutral point and
   * the exit; 0.4–0.5 is the accepted band. LIMITATION: constant, whereas the
   * true lever arm shifts with friction hill shape.
   */
  leverArmRatio: 0.45,
  /**
   * Forward slip f = 0.03. Keeps roll surface speed and strip exit speed
   * mutually consistent so mass flow closes. LIMITATION: f actually depends on
   * reduction, friction and tension; a constant is a deliberate simplification.
   */
  forwardSlip: 0.03,
  /** 2/√3 = 1.155 — plane-strain (von Mises) constraint factor. */
  planeStrainFactor: 1.1547,
  /**
   * Roll flattening and force are mutually dependent, and on thin strip the
   * fixed point converges slowly (R' can reach 2x nominal). Three iterations
   * under-predicts force by 15-20% on a light pass; eight converges to well
   * inside 1 t on the whole schedule.
   */
  hitchcockIterations: 8,
  hitchcockToleranceMm: 0.01,

  forceLimits: {
    warning: millConfig.ratings.maxRollingForce * 0.8, // 560 t
    alarm: millConfig.ratings.maxRollingForce * 0.92, // 644 t
    trip: millConfig.ratings.maxRollingForce, // 700 t
  },
  motorLimits: {
    currentMax: millConfig.ratings.mainDriveRatedCurrent,
    powerMax: millConfig.ratings.mainDriveRating,
    torqueMax: millConfig.ratings.mainDriveRatedTorque,
  },
  /**
   * Tension limits in kN. PLACEHOLDER envelope pending §22 item 2
   * (actual limits per grade family). Sized for the narrow-complex demo coil
   * (620 mm x 2.8 mm hot band) at 55-125 N/mm2 specific tension.
   */
  tensionLimits: { entryMin: 3, entryMax: 220, exitMin: 5, exitMax: 280 },
  speedLimits: {
    max: millConfig.ratings.maxMillSpeed,
    threadingSpeed: millConfig.ratings.threadingSpeed,
  },
  specificTensionLimits: { min: 10, max: 180 },

  thicknessTolerance: millConfig.ratings.thicknessToleranceUm,
  /**
   * σ = 1.1 µm. Chosen so that a healthy AGC keeps the displayed gauge signal
   * inside the ±5 µm target while still showing realistic instrument scatter.
   * LIMITATION: white noise only — real X-ray gauges also drift and alias with
   * strip flutter.
   */
  gaugeNoise: { sigma: 1.1 },

  acceleration: 55,
  deceleration: 70,
  fastStopDeceleration: 260,

  hagcSlewRate: 4.0,
  /**
   * HAGC gains. The loop drives S0 so that the gaugemeter thickness converges on
   * the pass reference. Tuned for a stable response at the 20 Hz sim tick.
   * LIMITATION: the real HAGC is a cascaded position/pressure loop at 100 Hz+
   * with mass-flow and feed-forward trims; this is a single PI on thickness.
   */
  hagcGainP: 0.55,
  hagcGainI: 0.9,
  tensionTimeConstant: 0.55,

  hydraulicPressureAtMaxForce: 280,
  hydraulicPressureMin: 90,
  lpSystemPressure: 4.5,

  staleAfterMs: 3000,
  /**
   * 10 Hz — one of the publish rates §14.2 asks the twin to work at, and a
   * realistic edge-gateway rate. The scene stays continuous at this rate
   * because every visual value is damped in `twinEngine` (§10.4), which is the
   * same mechanism that will carry the 0.2 Hz historian replay case.
   */
  simulationTickMs: 100,
  telemetrySampleMs: 250, // 4 Hz
  chartRefreshMs: 500, // 2 Hz repaint

  solver: { maxIterations: 12, toleranceMm: 1e-5, relaxation: 0.6 },
}

/**
 * Deterministic pseudo-random generator.
 *
 * §19.2 forbids "random independent values". Instrument noise is nevertheless
 * physically real, so it is produced by a SEEDED generator: the simulation is
 * reproducible run-to-run, and noise is applied only at the point where a real
 * instrument would add it (the X-ray gauge signal), never to a process value
 * that other values depend on.
 */
export class SeededRandom {
  private state: number

  constructor(seed = 0x2f6e2b1) {
    this.state = seed >>> 0
  }

  /** xorshift32 — uniform in [0, 1). */
  next(): number {
    let x = this.state
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    this.state = x
    return x / 0x1_0000_0000
  }

  /** Box–Muller normal deviate, mean 0, unit variance. */
  normal(): number {
    const u1 = Math.max(this.next(), Number.EPSILON)
    const u2 = this.next()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  reset(seed = 0x2f6e2b1): void {
    this.state = seed >>> 0
  }
}
