/**
 * ALARM ENGINE — §13.1 of the master spec.
 *
 * Rule based, evaluated against MachineState. The engine is PURE: it reports
 * which conditions are currently true. Latching, acknowledgement, timestamps and
 * history are the alarm store's job — keeping them apart is what lets the rules
 * be re-evaluated every frame without churning the alarm list.
 *
 * A rule NEVER fires on a null value. On the 46-tag feed the hydraulic pressure
 * tag does not exist, and an alarm engine that treats "no tag" as "zero" would
 * raise a permanent, meaningless HYDRAULIC PRESSURE LOW (§7.4).
 */

import { engineeringConfig } from '../config/engineeringConfig'
import { millConfig } from '../config/millConfig'
import type { AlarmSeverity, TwinSection } from '../types/alarms'
import type { MachineState } from '../types/machine'
import { isRolling } from './machineStateMachine'

export interface AlarmCondition {
  id: string
  severity: AlarmSeverity
  parameter: string
  tagName: string
  actualValue: number
  limit: number
  unit: string
  message: string
  section?: TwinSection
}

export function evaluateAlarms(state: MachineState): AlarmCondition[] {
  const conditions: AlarmCondition[] = []
  const { forceLimits, motorLimits, tensionLimits, thicknessTolerance, hydraulicPressureMin } =
    engineeringConfig

  const rolling = isRolling(state.machineStatus)

  // ---- Rolling force ----------------------------------------------------
  const force = state.rollingForce.actual
  if (force >= forceLimits.trip) {
    conditions.push({
      id: 'HIGH_ROLLING_FORCE',
      severity: 'TRIP',
      parameter: 'Rolling force',
      tagName: 'ROLL.FORCE.ACTUAL',
      actualValue: force,
      limit: forceLimits.trip,
      unit: 't',
      message: `ROLLING FORCE AT TRIP LIMIT — ${force.toFixed(0)} t of ${millConfig.ratings.maxRollingForce} t`,
      section: 'ROLL_BITE',
    })
  } else if (force >= forceLimits.alarm) {
    conditions.push({
      id: 'HIGH_ROLLING_FORCE',
      severity: 'ALARM',
      parameter: 'Rolling force',
      tagName: 'ROLL.FORCE.ACTUAL',
      actualValue: force,
      limit: forceLimits.alarm,
      unit: 't',
      message: `HIGH ROLLING FORCE — ${force.toFixed(0)} t exceeds ${forceLimits.alarm.toFixed(0)} t`,
      section: 'ROLL_BITE',
    })
  } else if (force >= forceLimits.warning) {
    conditions.push({
      id: 'HIGH_ROLLING_FORCE',
      severity: 'WARNING',
      parameter: 'Rolling force',
      tagName: 'ROLL.FORCE.ACTUAL',
      actualValue: force,
      limit: forceLimits.warning,
      unit: 't',
      message: `ROLLING FORCE HIGH — ${force.toFixed(0)} t above ${forceLimits.warning.toFixed(0)} t`,
      section: 'ROLL_BITE',
    })
  }

  // ---- Thickness deviation ----------------------------------------------
  // Only meaningful while the mill is actually reducing the strip.
  if (rolling) {
    const deviation = state.thickness.deviation
    const absDeviation = Math.abs(deviation)
    if (absDeviation > thicknessTolerance * 3) {
      conditions.push({
        id: 'THICKNESS_DEVIATION',
        severity: 'ALARM',
        parameter: 'Thickness deviation',
        tagName: 'STRIP.THICKNESS.DEVIATION',
        actualValue: deviation,
        limit: thicknessTolerance * 3,
        unit: 'µm',
        message: `THICKNESS DEVIATION — ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)} µm against ±${thicknessTolerance} µm target`,
        section: 'STRIP',
      })
    } else if (absDeviation > thicknessTolerance) {
      conditions.push({
        id: 'THICKNESS_DEVIATION',
        severity: 'WARNING',
        parameter: 'Thickness deviation',
        tagName: 'STRIP.THICKNESS.DEVIATION',
        actualValue: deviation,
        limit: thicknessTolerance,
        unit: 'µm',
        message: `THICKNESS OUTSIDE TOLERANCE — ${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)} µm against ±${thicknessTolerance} µm target`,
        section: 'STRIP',
      })
    }
  }

  // ---- Hydraulic pressure ------------------------------------------------
  // Guarded on null: no tag means no alarm, not a zero-pressure alarm.
  const loadingPressure = state.hydraulics.loadingPressure
  if (loadingPressure !== null && rolling && loadingPressure < hydraulicPressureMin) {
    conditions.push({
      id: 'HYDRAULIC_PRESSURE_LOW',
      severity: 'ALARM',
      parameter: 'HAGC loading pressure',
      tagName: 'HYD.LOADING.PRESSURE',
      actualValue: loadingPressure,
      limit: hydraulicPressureMin,
      unit: 'bar',
      message: `HYDRAULIC PRESSURE LOW — ${loadingPressure.toFixed(0)} bar below ${hydraulicPressureMin} bar`,
      section: 'HYDRAULICS',
    })
  }

  // ---- Drive current -----------------------------------------------------
  const current = state.drive.current
  if (current >= motorLimits.currentMax) {
    conditions.push({
      id: 'DRIVE_CURRENT_HIGH',
      severity: 'ALARM',
      parameter: 'Main drive current',
      tagName: 'DRIVE.CURRENT',
      actualValue: current,
      limit: motorLimits.currentMax,
      unit: 'A',
      message: `MAIN DRIVE CURRENT HIGH — ${current.toFixed(0)} A at rating`,
      section: 'DRIVE',
    })
  } else if (current >= motorLimits.currentMax * 0.9) {
    conditions.push({
      id: 'DRIVE_CURRENT_HIGH',
      severity: 'WARNING',
      parameter: 'Main drive current',
      tagName: 'DRIVE.CURRENT',
      actualValue: current,
      limit: motorLimits.currentMax * 0.9,
      unit: 'A',
      message: `MAIN DRIVE CURRENT HIGH — ${current.toFixed(0)} A above 90% of rating`,
      section: 'DRIVE',
    })
  }

  // ---- Strip tension -----------------------------------------------------
  if (rolling) {
    if (state.tension.entry < tensionLimits.entryMin) {
      conditions.push({
        id: 'ENTRY_TENSION_LOW',
        severity: 'ALARM',
        parameter: 'Entry tension',
        tagName: 'TENSION.ENTRY',
        actualValue: state.tension.entry,
        limit: tensionLimits.entryMin,
        unit: 'kN',
        message: `ENTRY TENSION LOW — ${state.tension.entry.toFixed(1)} kN, strip may slip`,
        section: 'ENTRY_REEL',
      })
    }
    if (state.tension.exit > tensionLimits.exitMax) {
      conditions.push({
        id: 'EXIT_TENSION_HIGH',
        severity: 'ALARM',
        parameter: 'Exit tension',
        tagName: 'TENSION.EXIT',
        actualValue: state.tension.exit,
        limit: tensionLimits.exitMax,
        unit: 'kN',
        message: `EXIT TENSION HIGH — ${state.tension.exit.toFixed(1)} kN, strip break risk`,
        section: 'EXIT_REEL',
      })
    }
  }

  // ---- Emergency / fast stop ---------------------------------------------
  if (state.interlocks.emergencyStop === true) {
    conditions.push({
      id: 'EMERGENCY_STOP',
      severity: 'TRIP',
      parameter: 'Emergency stop',
      tagName: 'EMERGENCY.STOP',
      actualValue: 1,
      limit: 0,
      unit: '',
      message: 'EMERGENCY STOP ACTIVE',
      section: 'STAND',
    })
  }
  if (state.machineStatus === 'FAST_STOP') {
    conditions.push({
      id: 'FAST_STOP',
      severity: 'TRIP',
      parameter: 'Fast stop',
      tagName: 'FAST.STOP',
      actualValue: 1,
      limit: 0,
      unit: '',
      message: 'FAST STOP — MILL DECELERATING TO STANDSTILL',
      section: 'STAND',
    })
  }

  // ---- Auxiliary media ----------------------------------------------------
  const aux: Array<[keyof MachineState['auxiliarySystems'], string, TwinSection]> = [
    ['lubrication', 'Lubrication', 'STAND'],
    ['coolant', 'Roll coolant', 'ROLL_BITE'],
    ['exhaust', 'Exhaust', 'STAND'],
    ['lpSystem', 'LP system', 'HYDRAULICS'],
    ['hpLoading', 'HP loading', 'HYDRAULICS'],
    ['hpBending', 'HP bending', 'HYDRAULICS'],
  ]
  for (const [key, label, section] of aux) {
    const value = state.auxiliarySystems[key]
    if (value === 'FAULT') {
      conditions.push({
        id: `AUX_${key.toUpperCase()}`,
        severity: 'ALARM',
        parameter: label,
        tagName: `${key.toUpperCase()}.STATUS`,
        actualValue: 0,
        limit: 1,
        unit: '',
        message: `${label.toUpperCase()} FAULT`,
        section,
      })
    }
  }

  // ---- Gauge -------------------------------------------------------------
  if (state.gauges.etr.ready === false || state.gauges.dtr.ready === false) {
    const which = state.gauges.etr.ready === false ? 'ETR' : 'DTR'
    conditions.push({
      id: 'GAUGE_NOT_READY',
      severity: 'WARNING',
      parameter: 'X-ray gauge',
      tagName: `GAUGE.${which}.READY`,
      actualValue: 0,
      limit: 1,
      unit: '',
      message: `${which} GAUGE NOT READY — AGC THICKNESS FEEDBACK UNAVAILABLE`,
      section: which === 'ETR' ? 'GAUGE_EXIT' : 'GAUGE_ENTRY',
    })
  }

  // ---- Communication ------------------------------------------------------
  if (state.communication.stale || !state.communication.connected) {
    conditions.push({
      id: 'COMMUNICATION_LOST',
      severity: 'ALARM',
      parameter: 'Data feed',
      tagName: 'COMMS',
      actualValue: state.communication.ageMs,
      limit: engineeringConfig.staleAfterMs,
      unit: 'ms',
      message: state.communication.connected
        ? `DATA STALE — no update for ${(state.communication.ageMs / 1000).toFixed(1)} s`
        : 'COMMUNICATION LOST — DATA SOURCE DISCONNECTED',
    })
  }

  return conditions
}
