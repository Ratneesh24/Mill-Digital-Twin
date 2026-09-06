/**
 * CENTRAL MACHINE STATE — §6 of the master spec.
 *
 * There is exactly ONE authoritative MachineState object in the application.
 * Components subscribe to it; they never compute their own version of a value.
 * MachineState is a pure *projection* of the current TagFrame produced by
 * `communication/dataAdapter.ts` — it is never mutated from a component.
 */

export type MachineStatus =
  | 'IDLE'
  | 'READY'
  | 'THREADING'
  | 'ROLLING'
  | 'DECELERATING'
  | 'REVERSING'
  | 'STOPPED'
  | 'FAST_STOP'
  | 'WARMUP'
  | 'SKIN_PASS'
  | 'REWIND'
  | 'ROLL_CHANGE'
  | 'FAULT'

export type RollingDirection = 'FORWARD' | 'REVERSE'

/**
 * SIMULATION      — full 74-tag simulated mill, everything badged SIM
 * SIM_46TAG       — same simulation, filtered through the CRM04 historian tag
 *                   inventory so the twin degrades exactly as it will on the
 *                   real feed (force EST, gap CALC, bending NO TAG) — §7.4
 * LIVE            — WebSocket / OPC-UA gateway feed, real provenance
 */
export type OperatingMode = 'SIMULATION' | 'SIM_46TAG' | 'LIVE'

/**
 * NO_TAG is distinct from UNKNOWN on purpose. UNKNOWN means "we have a tag and
 * cannot interpret it"; NO_TAG means "this feed has no such tag at all" (§7.4)
 * and the UI must say so rather than show a plausible-looking state.
 */
export type Health = 'HEALTHY' | 'WARNING' | 'FAULT' | 'OFF' | 'UNKNOWN' | 'NO_TAG'

export type CtrlState = 'ON' | 'OFF' | 'FAULT' | 'UNKNOWN' | 'NO_TAG'

/** Logical role of a reel, derived from `rollingDirection` — never hardcoded. */
export type ReelRole = 'PAYOFF' | 'TENSION' | 'IDLE'

export interface ReelState {
  /** Physical identity of the reel. */
  id: 'DTR' | 'ETR' | 'POR'
  /** Logical role for the current pass — derived from rolling direction (§1). */
  role: ReelRole
  /** Specific tension actually applied to the strip, kN. */
  tension: number
  /** Tension reference from the pass schedule, kN. */
  tensionReference: number
  /** Outside coil diameter, mm. */
  diameter: number
  /** Strip length currently on the reel, m. */
  length: number
  /** Reel motor torque, kNm. */
  torque: number
  /** Reel motor current, A. */
  current: number
  /** Strip thickness currently at this reel, mm. `null` for POR. */
  thickness: number | null
  /** Reel rotational speed, rpm (sign follows rolling direction). */
  rpm: number
  /** Number of wraps on the mandrel. `null` for DTR/ETR — POR only (§7.2). */
  layers: number | null
  /** `null` when no brake status word exists on this feed. */
  brake: 'APPLIED' | 'RELEASED' | null
  status: 'RUNNING' | 'STOPPED' | 'FAULT' | 'UNKNOWN'
}

export interface RollState {
  /**
   * Nominal (design) roll body diameter from millConfig, mm. This is what the
   * 3D scene and the rpm model use, so the twin renders correctly even on a
   * feed that carries no roll-shop data.
   */
  diameter: number
  /**
   * Actual ground diameter reported by the roll shop, mm. `null` when no roll
   * ID / diameter tag exists (§7.4) — a different quantity from `diameter`,
   * not a duplicate of it.
   */
  actualDiameter: number | null
  /** Barrel length, mm. */
  barrelLength: number
  /** Rotational speed, rpm. Sign encodes direction of rotation. */
  rpm: number
  /**
   * Bending force per chock, kN. `null` when no bending tag exists on the
   * active feed — the twin must NOT animate a fake bend (§7.4).
   */
  bendingForce: number | null
  /** Accumulated rolled length since last roll change, km. Phase 4 (roll wear). */
  rolledLength: number | null
  /** Surface speed, m/min. */
  surfaceSpeed: number
}

export interface GaugeState {
  /** Measured thickness at this gauge, mm. */
  thickness: number | null
  /** Deviation from the reference for this gauge, µm. */
  deviation: number | null
  /** `null` when no gauge-ready status word exists on this feed. */
  ready: boolean | null
  /** X-ray gauge measuring head in/out of the pass line. */
  inLine: boolean | null
}

export interface CommState {
  connected: boolean
  sourceName: string
  /** Timestamp of the last frame accepted by the adapter. */
  lastFrameTimestamp: number
  /** Timestamp of the last frame whose quality was GOOD. */
  lastValidTimestamp: number
  /** Age of the newest frame, ms. */
  ageMs: number
  stale: boolean
  /** Measured update rate of the incoming feed, Hz. */
  updateRateHz: number
  framesReceived: number
}

export interface MachineState {
  machineStatus: MachineStatus
  /** Reason string for the current status — used by the interlock panel (§13.2). */
  statusReason: string
  rollingDirection: RollingDirection
  operatingMode: OperatingMode

  speed: {
    reference: number
    actual: number
    unit: 'm/min'
  }

  rollGap: {
    /**
     * Unloaded roll gap position S0 commanded by HAGC, mm.
     * `null` on the 46-tag feed — there is no HAGC/LVDT position tag (§7.4).
     */
    reference: number | null
    /** Loaded gap = delivered thickness, mm. */
    actual: number
    /** actual - reference, µm. `null` when the reference is unavailable. */
    deviation: number | null
    /** Operator side, mm. `null` when no LVDT tag exists (§7.4). */
    os: number | null
    /** Drive side, mm. `null` when no LVDT tag exists (§7.4). */
    ds: number | null
    /** OS-DS tilt, µm. `null` when unavailable. */
    tilt: number | null
  }

  rollingForce: {
    /** Total roll separating force, t. */
    actual: number
    /** Pass-schedule predicted force, t. */
    reference: number
    /** actual / maximum rolling force, %. */
    percentage: number
    /** Operator side share, t. `null` when unavailable. */
    os: number | null
    /** Drive side share, t. `null` when unavailable. */
    ds: number | null
    /** Standing AGC differential force reference, t (§2 CRM04 -9 T issue). */
    differentialRef: number | null
  }

  tension: {
    /** Entry (back) tension, kN — logical role, follows direction. */
    entry: number
    /** Exit (front) tension, kN — logical role, follows direction. */
    exit: number
    entryReference: number
    exitReference: number
    /** Entry specific tension, N/mm². */
    entrySpecific: number
    /** Exit specific tension, N/mm². */
    exitSpecific: number
    dtr: ReelState
    etr: ReelState
    por: ReelState
  }

  thickness: {
    /** Entry thickness for this pass, mm. */
    entry: number
    /** Exit thickness reference for this pass, mm. */
    reference: number
    /** Delivered thickness, mm. */
    actual: number
    /** actual - reference, µm. */
    deviation: number
    /** Final target thickness for the coil, mm. */
    target: number
    /** Reduction achieved this pass, %. */
    reduction: number
  }

  rolls: {
    upperWork: RollState
    lowerWork: RollState
    upperBackup: RollState
    lowerBackup: RollState
  }

  coil: {
    id: string
    /** Strip width, mm. */
    width: number
    /** As-charged thickness of the coil, mm. */
    entryThickness: number
    /** Thickness right now (input to the current pass), mm. */
    currentThickness: number
    /** Final thickness after the last scheduled pass, mm. */
    finalThickness: number
    /** Total strip length at current thickness, m. */
    length: number
    /** Length still to pass through the mill this pass, m. */
    remainingLength: number
    /** Diameter of the coil being paid off, mm. */
    diameter: number
    /** `null` when grade must be joined from MES and is not on the feed (§7.4). */
    grade: string | null
  }

  pass: {
    current: number
    total: number
    inputThickness: number
    targetThickness: number
    /** Scheduled reduction for this pass, %. */
    reduction: number
    /** Fraction of this pass completed, 0..1. */
    progress: number
  }

  drive: {
    /** Main mill drive torque, kNm. */
    torque: number
    /** Main mill drive armature current, A. */
    current: number
    /** Main mill drive power, kW. */
    power: number
    /** Main mill drive speed, rpm. */
    rpm: number
    /** Torque as % of rating. */
    torquePercentage: number
  }

  hydraulics: {
    /** HAGC capsule loading pressure, bar. `null` when no tag (§7.4). */
    loadingPressure: number | null
    /** Work roll bending pressure, bar. `null` when no tag (§7.4). */
    bendingPressure: number | null
    /** HAGC capsule position, mm. `null` when no LVDT tag (§7.4). */
    gapPosition: number | null
    /** LP lubrication pressure, bar. `null` when no tag (§7.4). */
    lpPressure: number | null
  }

  auxiliarySystems: {
    lubrication: Health
    coolant: Health
    exhaust: Health
    lpSystem: Health
    hpLoading: Health
    hpBending: Health
  }

  gauges: {
    /** X-ray gauge on the DTR side of the stand. */
    dtr: GaugeState
    /** X-ray gauge on the ETR side of the stand. */
    etr: GaugeState
  }

  /** `null` on a feed with no interlock chain tags (§7.4). */
  interlocks: {
    mill: boolean | null
    drive: boolean | null
    gauge: boolean | null
    hydraulic: boolean | null
    tension: boolean | null
    emergencyStop: boolean | null
  }

  controls: {
    agc: CtrlState
    thfb: CtrlState
    thff: CtrlState
    spff: CtrlState
    mfc: CtrlState
    trf: CtrlState
    positionMode: CtrlState
    rollGapClosed: CtrlState
    bending: CtrlState
  }

  /**
   * Mass-flow cross-check (§8.1): h_entry·v_entry vs h_exit·v_exit.
   * Surfaced as a diagnostic, never used as a hidden correction.
   */
  diagnostics: {
    massFlowErrorPct: number
    /** Gaugemeter residual: |actual - (S0 + F/M)|, µm. */
    gaugemeterResidualUm: number
    /** Simulation solver iterations used on the last tick. */
    solverIterations: number
  }

  communication: CommState
}

/** A machine event for the §11.4 event timeline. */
export interface MachineEvent {
  id: string
  timestamp: number
  category: 'STATE' | 'PASS' | 'SETPOINT' | 'ALARM' | 'COMMS' | 'OPERATOR'
  message: string
}
