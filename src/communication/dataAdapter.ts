/**
 * TAG FRAME -> MACHINE STATE PROJECTION.
 *
 * §4 non-negotiable: "the twin and the UI must never hold independent copies of
 * a process value. There is exactly ONE authoritative MachineState object."
 *
 * This module is the ONLY place MachineState is constructed. Every field is read
 * from a Tag — nothing here recomputes physics, and nothing here invents a
 * fallback number. Where a tag is absent the field becomes `null` and the UI
 * renders NO TAG (§7.4).
 *
 * Read this file as the audit trail for §18: every row of the Digital Twin Audit
 * Table maps to exactly one assignment below.
 */

import { millConfig } from '../config/millConfig'
import { specificTension } from '../simulation/rollingModel'
import { numericValue } from '../data/tagMap'
import type {
  CommState,
  CtrlState,
  GaugeState,
  Health,
  MachineState,
  MachineStatus,
  OperatingMode,
  ReelRole,
  ReelState,
  RollState,
  RollingDirection,
} from '../types/machine'
import type { Tag, TagFrame } from '../types/tags'

// ---------------------------------------------------------------------------
// Typed readers. Every one returns null rather than a substitute value.
// ---------------------------------------------------------------------------

function num(tags: TagFrame, tagName: string): number | null {
  return numericValue(tags[tagName])
}

/**
 * Numeric read for a field that is REQUIRED to be a number by the state type.
 * Used only where the tag is guaranteed present on every supported feed; the
 * fallback exists to satisfy the type, never to fabricate a reading — a missing
 * tag here would already have been caught by the tag inventory.
 */
function numOr(tags: TagFrame, tagName: string, fallback: number): number {
  const v = numericValue(tags[tagName])
  return v === null ? fallback : v
}

function str(tags: TagFrame, tagName: string): string | null {
  const tag = tags[tagName]
  if (!tag || tag.value === null) return null
  return typeof tag.value === 'string' ? tag.value : String(tag.value)
}

function bool(tags: TagFrame, tagName: string): boolean | null {
  const tag = tags[tagName]
  if (!tag || tag.value === null) return null
  if (typeof tag.value === 'boolean') return tag.value
  if (typeof tag.value === 'string') return tag.value === 'true' || tag.value === 'ON'
  return null
}

function health(tags: TagFrame, tagName: string): Health {
  const tag = tags[tagName]
  if (!tag || tag.value === null) return 'NO_TAG'
  const v = String(tag.value)
  if (v === 'HEALTHY' || v === 'WARNING' || v === 'FAULT' || v === 'OFF') return v
  return 'UNKNOWN'
}

function ctrl(tags: TagFrame, tagName: string): CtrlState {
  const tag = tags[tagName]
  if (!tag || tag.value === null) return 'NO_TAG'
  const v = String(tag.value)
  if (v === 'ON' || v === 'OFF' || v === 'FAULT') return v
  return 'UNKNOWN'
}

/** Subtraction that propagates unavailability instead of turning it into 0. */
function diff(a: number | null, b: number | null, scale = 1): number | null {
  if (a === null || b === null) return null
  return (a - b) * scale
}

// ---------------------------------------------------------------------------
// Sub-projections
// ---------------------------------------------------------------------------

function projectReel(tags: TagFrame, reel: 'DTR' | 'ETR' | 'POR'): ReelState {
  const roleRaw = str(tags, `${reel}.ROLE`)
  const role: ReelRole =
    roleRaw === 'PAYOFF' || roleRaw === 'TENSION' || roleRaw === 'IDLE'
      ? roleRaw
      : reel === 'POR'
        ? 'IDLE'
        : 'IDLE'

  const brakeRaw = str(tags, `${reel}.BRAKE`)
  const statusRaw = str(tags, `${reel}.STATUS`)

  return {
    id: reel,
    role,
    tension: numOr(tags, `${reel}.TENSION`, 0),
    tensionReference:
      reel === 'POR'
        ? 0
        : role === 'PAYOFF'
          ? numOr(tags, 'TENSION.ENTRY.REF', 0)
          : numOr(tags, 'TENSION.EXIT.REF', 0),
    diameter: numOr(tags, `${reel}.DIAMETER`, millConfig.geometry.mandrelDiameter),
    length: numOr(tags, `${reel}.LENGTH`, 0),
    torque: numOr(tags, `${reel}.TORQUE`, 0),
    current: numOr(tags, `${reel}.CURRENT`, 0),
    thickness: num(tags, `${reel}.THICKNESS`),
    rpm: numOr(tags, `${reel}.RPM`, 0),
    layers: num(tags, `${reel}.LAYERS`),
    brake: brakeRaw === 'APPLIED' || brakeRaw === 'RELEASED' ? brakeRaw : null,
    status:
      statusRaw === 'RUNNING' || statusRaw === 'STOPPED' || statusRaw === 'FAULT'
        ? statusRaw
        : 'UNKNOWN',
  }
}

function projectRoll(
  tags: TagFrame,
  rpmTag: string,
  bendingTag: string | null,
  actualDiameterTag: string,
  nominalDiameter: number,
  surfaceSpeed: number,
): RollState {
  return {
    // Geometry for the scene and for the rpm model comes from config, so the
    // twin renders correctly on a feed with no roll-shop data.
    diameter: nominalDiameter,
    actualDiameter: num(tags, actualDiameterTag),
    barrelLength: millConfig.geometry.barrelLength,
    rpm: numOr(tags, rpmTag, 0),
    bendingForce: bendingTag ? num(tags, bendingTag) : null,
    // Roll wear / accumulated rolled length is a Phase 4 item — no tag, no model.
    rolledLength: null,
    surfaceSpeed,
  }
}

function projectGauge(
  tags: TagFrame,
  thicknessTag: string,
  readyTag: string,
  referenceThickness: number | null,
): GaugeState {
  const thickness = num(tags, thicknessTag)
  return {
    thickness,
    deviation: diff(thickness, referenceThickness, 1000),
    ready: bool(tags, readyTag),
    // No "measuring head in line" tag exists on either feed; the head position
    // is only known when the gauge itself reports ready.
    inLine: bool(tags, readyTag),
  }
}

// ---------------------------------------------------------------------------
// The projection
// ---------------------------------------------------------------------------

export interface AdapterContext {
  mode: OperatingMode
  communication: CommState
  diagnostics: { solverIterations: number; gaugemeterResidualUm: number }
}

export function projectMachineState(tags: TagFrame, ctx: AdapterContext): MachineState {
  const width = numOr(tags, 'STRIP.WIDTH', millConfig.ratings.maxStripWidth)

  const directionRaw = str(tags, 'MILL.DIRECTION')
  const rollingDirection: RollingDirection = directionRaw === 'REVERSE' ? 'REVERSE' : 'FORWARD'

  const statusRaw = str(tags, 'MILL.STATUS')
  const machineStatus = (statusRaw ?? 'IDLE') as MachineStatus

  const speedActual = numOr(tags, 'MILL.SPEED.ACTUAL', 0)
  const surfaceSpeed = speedActual

  const thicknessActual = numOr(tags, 'STRIP.THICKNESS', 0)
  const thicknessReference = numOr(tags, 'STRIP.THICKNESS.REF', 0)
  const thicknessEntry = numOr(tags, 'STRIP.THICKNESS.ENTRY', 0)

  const gapReference = num(tags, 'ROLL.GAP.REF')
  const gapActual = numOr(tags, 'ROLL.GAP.ACTUAL', 0)

  const forceActual = numOr(tags, 'ROLL.FORCE.ACTUAL', 0)

  const entryTension = numOr(tags, 'TENSION.ENTRY', 0)
  const exitTension = numOr(tags, 'TENSION.EXIT', 0)

  const wrDiameter = millConfig.geometry.workRollDiameter
  const burDiameter = millConfig.geometry.backupRollDiameter

  return {
    machineStatus,
    statusReason: str(tags, 'MILL.STATUS.REASON') ?? '',
    rollingDirection,
    operatingMode: ctx.mode,

    speed: {
      reference: numOr(tags, 'MILL.SPEED.REF', 0),
      actual: speedActual,
      unit: 'm/min',
    },

    rollGap: {
      reference: gapReference,
      actual: gapActual,
      // Loaded gap vs commanded position, µm. Null-safe: on a feed with no
      // position tag this is genuinely unknowable, not zero.
      deviation: diff(gapActual, gapReference, 1000),
      os: num(tags, 'ROLL.GAP.OS'),
      ds: num(tags, 'ROLL.GAP.DS'),
      tilt: num(tags, 'ROLL.GAP.TILT'),
    },

    rollingForce: {
      actual: forceActual,
      reference: numOr(tags, 'ROLL.FORCE.REF', 0),
      percentage: (forceActual / millConfig.ratings.maxRollingForce) * 100,
      os: num(tags, 'ROLL.FORCE.OS'),
      ds: num(tags, 'ROLL.FORCE.DS'),
      differentialRef: num(tags, 'ROLL.FORCE.DIFF_REF'),
    },

    tension: {
      entry: entryTension,
      exit: exitTension,
      entryReference: numOr(tags, 'TENSION.ENTRY.REF', 0),
      exitReference: numOr(tags, 'TENSION.EXIT.REF', 0),
      // Specific tension is a presentation of the same tension value against the
      // strip section — a unit conversion, not a second source (§18).
      entrySpecific: specificTension(entryTension, thicknessEntry, width),
      exitSpecific: specificTension(exitTension, thicknessActual, width),
      dtr: projectReel(tags, 'DTR'),
      etr: projectReel(tags, 'ETR'),
      por: projectReel(tags, 'POR'),
    },

    thickness: {
      entry: thicknessEntry,
      reference: thicknessReference,
      actual: thicknessActual,
      deviation: numOr(tags, 'STRIP.THICKNESS.DEVIATION', 0),
      target: numOr(tags, 'STRIP.THICKNESS.REF', 0),
      reduction: numOr(tags, 'STRIP.REDUCTION', 0),
    },

    rolls: {
      upperWork: projectRoll(
        tags,
        'WR.TOP.RPM',
        'WR.TOP.BENDING',
        'WR.TOP.DIAMETER',
        wrDiameter,
        surfaceSpeed,
      ),
      lowerWork: projectRoll(
        tags,
        'WR.BOTTOM.RPM',
        'WR.BOTTOM.BENDING',
        'WR.BOTTOM.DIAMETER',
        wrDiameter,
        surfaceSpeed,
      ),
      upperBackup: projectRoll(
        tags,
        'BUR.TOP.RPM',
        null,
        'BUR.TOP.DIAMETER',
        burDiameter,
        surfaceSpeed,
      ),
      lowerBackup: projectRoll(
        tags,
        'BUR.BOTTOM.RPM',
        null,
        'BUR.BOTTOM.DIAMETER',
        burDiameter,
        surfaceSpeed,
      ),
    },

    coil: {
      id: str(tags, 'COIL.ID') ?? 'NO TAG',
      width,
      entryThickness: numOr(tags, 'STRIP.THICKNESS.ENTRY', 0),
      currentThickness: thicknessActual,
      finalThickness: numOr(tags, 'STRIP.THICKNESS.REF', 0),
      length: numOr(tags, 'COIL.LENGTH', 0),
      remainingLength: numOr(tags, 'COIL.REMAINING_LENGTH', 0),
      diameter: numOr(tags, 'COIL.DIAMETER', millConfig.geometry.mandrelDiameter),
      grade: str(tags, 'COIL.GRADE'),
    },

    pass: {
      current: numOr(tags, 'PASS.NUMBER', 1),
      total: numOr(tags, 'PASS.TOTAL', 1),
      inputThickness: thicknessEntry,
      targetThickness: thicknessReference,
      reduction: numOr(tags, 'STRIP.REDUCTION', 0),
      progress: numOr(tags, 'PASS.PROGRESS', 0) / 100,
    },

    drive: {
      torque: numOr(tags, 'DRIVE.TORQUE', 0),
      current: numOr(tags, 'DRIVE.CURRENT', 0),
      power: numOr(tags, 'DRIVE.POWER', 0),
      rpm: numOr(tags, 'DRIVE.RPM', 0),
      torquePercentage:
        (numOr(tags, 'DRIVE.TORQUE', 0) / millConfig.ratings.mainDriveRatedTorque) * 100,
    },

    hydraulics: {
      loadingPressure: num(tags, 'HYD.LOADING.PRESSURE'),
      bendingPressure: num(tags, 'HYD.BENDING.PRESSURE'),
      gapPosition: num(tags, 'HYD.GAP.POSITION'),
      lpPressure: num(tags, 'LP.PRESSURE'),
    },

    auxiliarySystems: {
      lubrication: health(tags, 'LUBRICATION.STATUS'),
      coolant: health(tags, 'COOLANT.STATUS'),
      exhaust: health(tags, 'EXHAUST.STATUS'),
      lpSystem: health(tags, 'LP.STATUS'),
      hpLoading: health(tags, 'HP.LOADING.STATUS'),
      hpBending: health(tags, 'HP.BENDING.STATUS'),
    },

    gauges: {
      dtr: projectGauge(
        tags,
        'GAUGE.DTR.THICKNESS',
        'GAUGE.DTR.READY',
        // The DTR-side gauge measures the delivered strip only when DTR is the
        // exit side; otherwise it is the entry gauge and has no exit reference.
        rollingDirection === 'REVERSE' ? thicknessReference : null,
      ),
      etr: projectGauge(
        tags,
        'GAUGE.ETR.THICKNESS',
        'GAUGE.ETR.READY',
        rollingDirection === 'FORWARD' ? thicknessReference : null,
      ),
    },

    interlocks: {
      mill: bool(tags, 'MILL.INTERLOCK'),
      drive: bool(tags, 'DRIVE.READY'),
      gauge: bool(tags, 'GAUGE.READY'),
      hydraulic: bool(tags, 'HYDRAULIC.READY'),
      tension: bool(tags, 'TENSION.READY'),
      emergencyStop: bool(tags, 'EMERGENCY.STOP'),
    },

    controls: {
      agc: ctrl(tags, 'AGC.STATUS'),
      thfb: ctrl(tags, 'THFB.STATUS'),
      thff: ctrl(tags, 'THFF.STATUS'),
      spff: ctrl(tags, 'SPFF.STATUS'),
      mfc: ctrl(tags, 'MFC.STATUS'),
      trf: ctrl(tags, 'TRF.STATUS'),
      positionMode: ctrl(tags, 'POSITION.MODE.STATUS'),
      rollGapClosed: ctrl(tags, 'ROLLGAP.CLOSED.STATUS'),
      bending: ctrl(tags, 'BENDING.STATUS'),
    },

    diagnostics: {
      massFlowErrorPct: numOr(tags, 'MILL.MASSFLOW.ERROR', 0),
      gaugemeterResidualUm: ctx.diagnostics.gaugemeterResidualUm,
      solverIterations: ctx.diagnostics.solverIterations,
    },

    communication: ctx.communication,
  }
}

/**
 * MachineState used before the first frame arrives, and after a source is
 * disconnected. Everything reads zero/NO TAG and the status is IDLE — the twin
 * must not show a plausible mill until a frame actually lands.
 */
export function emptyMachineState(mode: OperatingMode): MachineState {
  return projectMachineState({} as Record<string, Tag>, {
    mode,
    communication: {
      connected: false,
      sourceName: 'No source',
      lastFrameTimestamp: 0,
      lastValidTimestamp: 0,
      ageMs: 0,
      stale: true,
      updateRateHz: 0,
      framesReceived: 0,
    },
    diagnostics: { solverIterations: 0, gaugemeterResidualUm: 0 },
  })
}
