/**
 * TAG DEFINITIONS — §7.2 namespace + §7.4 live-mode reality gap.
 *
 * This file is the CONTRACT between the mill and the twin. Every value the UI
 * can display is declared here exactly once, with:
 *   - what it means and its unit
 *   - what provenance it carries when the simulation produces it
 *   - what happens to it on the REAL CRM04 46-tag feed (§7.4)
 *
 * §7.4 states the available 6-month CRM04 extract (5 s sampling, coil-linked,
 * ~46 of 74 tags) DOES contain:
 *   POR/ETR/DTR torque, current, diameter, tension, length · MILL_ACT_TRQ ·
 *   MILL_CURRENT · two X-ray thickness gauges · MMS pass-schedule setup tags ·
 *   LINE_START_STOP · INPUT/OUTPUT_THICKNESS
 * and DOES NOT contain:
 *   roll separating force · HAGC/LVDT position · bending force · WR RPM ·
 *   roll ID · coolant tags
 *
 * PROMOTION PATH: when OEM raises PLC sampling on a tag (§22 item 3), change
 * that tag's `liveAvailability` to 'MEASURED' here and delete its `liveNote`.
 * Nothing else in the codebase changes — no component reads an availability
 * flag directly, they all read the resolved provenance off the Tag.
 */

import { engineeringConfig } from '../config/engineeringConfig'
import { millConfig } from '../config/millConfig'
import type { TagDefinition } from '../types/tags'

const { forceLimits, motorLimits, tensionLimits, speedLimits } = engineeringConfig

/** Reason strings reused across the tags that share a root cause. */
const NOTE = {
  NO_FORCE:
    'Roll separating force is not in the 6-month CRM04 extract. Estimated from MILL_ACT_TRQ and the reduction model — indication of trend only, not a calibrated force reading. Priority tag for OEM (§22 item 3).',
  NO_LVDT:
    'No HAGC/LVDT position tag in the extract. Derived from the gaugemeter inverse S0 = h - F/M, using the ESTIMATED force — so its accuracy is bounded by the force estimate.',
  NO_BENDING:
    'No work roll bending force tag in the extract. Displayed as NO TAG; the twin must not animate a fake roll bend (§7.4).',
  NO_WR_RPM:
    'No work roll speed tag in the extract. Derived from mill speed and roll diameter (§8.4).',
  NO_OSDS:
    'No per-side instrumentation in the extract. OS/DS split and tilt are carried in the data model (§2 BUR taper / -9 t differential issue) but have no value on this feed.',
  NO_COOLANT: 'No coolant / lubrication / exhaust status tags in the extract.',
  NO_MILL_SPEED_ACTUAL:
    'No direct mill speed feedback tag. Derived from the rate of change of the reel length tags; at 5 s historian sampling this is a coarse average, not an instantaneous speed.',
  DERIVED_FROM_STATE:
    'Not a PLC tag. Derived inside the twin from tags that are present on the feed.',
} as const

function def(d: TagDefinition): TagDefinition {
  return d
}

export const tagDefinitions: TagDefinition[] = [
  // -------------------------------------------------------------------------
  // MILL
  // -------------------------------------------------------------------------
  def({
    tagName: 'MILL.SPEED.REF',
    description: 'Mill speed reference',
    unit: 'm/min',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    limits: { high: speedLimits.max },
    decimals: 0,
  }),
  def({
    tagName: 'MILL.SPEED.ACTUAL',
    description: 'Mill speed actual (exit strip speed)',
    unit: 'm/min',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_MILL_SPEED_ACTUAL,
    limits: { warningHigh: speedLimits.max * 0.95, alarmHigh: speedLimits.max },
    decimals: 0,
  }),
  def({
    tagName: 'MILL.SPEED.ENTRY',
    description: 'Entry strip speed (mass flow)',
    unit: 'm/min',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.DERIVED_FROM_STATE,
    decimals: 0,
  }),
  def({
    tagName: 'MILL.DIRECTION',
    description: 'Rolling direction',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'CALCULATED',
    liveNote:
      'No direction tag in the extract. Inferred from the sign of the reel length rate of change (which reel is filling).',
  }),
  def({
    tagName: 'MILL.STATUS',
    description: 'Mill status',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Derived from LINE_START_STOP plus the derived speed. Coarser than the PLC state word.',
  }),
  def({
    tagName: 'MILL.STATUS.REASON',
    description: 'Why the mill is in its current state',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'CALCULATED',
    liveNote:
      'No PLC state-reason word. Derived inside the twin from the interlock chain and the derived status.',
  }),
  def({
    tagName: 'MILL.INTERLOCK',
    description: 'Mill ready interlock',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No interlock chain tags in the extract.',
  }),
  def({
    tagName: 'MILL.MASSFLOW.ERROR',
    description: 'Mass-flow closure error (diagnostic)',
    unit: '%',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.DERIVED_FROM_STATE,
    decimals: 2,
  }),

  // -------------------------------------------------------------------------
  // ROLL GAP
  // -------------------------------------------------------------------------
  def({
    tagName: 'ROLL.GAP.REF',
    description: 'Roll gap position reference S0',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_LVDT,
    decimals: 3,
  }),
  def({
    tagName: 'ROLL.GAP.ACTUAL',
    description: 'Roll gap actual (loaded)',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_LVDT,
    decimals: 3,
  }),
  def({
    tagName: 'ROLL.GAP.OS',
    description: 'Roll gap operator side',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_OSDS,
    decimals: 3,
  }),
  def({
    tagName: 'ROLL.GAP.DS',
    description: 'Roll gap drive side',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_OSDS,
    decimals: 3,
  }),
  def({
    tagName: 'ROLL.GAP.TILT',
    description: 'Roll gap tilt OS-DS',
    unit: 'µm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_OSDS,
    decimals: 1,
  }),

  // -------------------------------------------------------------------------
  // ROLL FORCE
  // -------------------------------------------------------------------------
  def({
    tagName: 'ROLL.FORCE.ACTUAL',
    description: 'Roll separating force',
    unit: 't',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'ESTIMATED',
    liveNote: NOTE.NO_FORCE,
    limits: {
      warningHigh: forceLimits.warning,
      alarmHigh: forceLimits.alarm,
      tripHigh: forceLimits.trip,
      high: millConfig.ratings.maxRollingForce,
    },
    decimals: 0,
  }),
  def({
    tagName: 'ROLL.FORCE.REF',
    description: 'Roll force predicted by pass schedule',
    unit: 't',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 0,
  }),
  def({
    tagName: 'ROLL.FORCE.OS',
    description: 'Roll force operator side',
    unit: 't',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_OSDS,
    decimals: 0,
  }),
  def({
    tagName: 'ROLL.FORCE.DS',
    description: 'Roll force drive side',
    unit: 't',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_OSDS,
    decimals: 0,
  }),
  def({
    tagName: 'ROLL.FORCE.DIFF_REF',
    description: 'AGC differential force reference',
    unit: 't',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'Standing -9 t differential reference on Mill 4 (§2). Not in the extract; under audit as §22 item 5.',
    decimals: 1,
  }),

  // -------------------------------------------------------------------------
  // STRIP / THICKNESS
  // -------------------------------------------------------------------------
  def({
    tagName: 'STRIP.WIDTH',
    description: 'Strip width',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 0,
  }),
  def({
    tagName: 'STRIP.THICKNESS',
    description: 'Delivered strip thickness',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    decimals: 3,
  }),
  def({
    tagName: 'STRIP.THICKNESS.ENTRY',
    description: 'Entry strip thickness',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    decimals: 3,
  }),
  def({
    tagName: 'STRIP.THICKNESS.REF',
    description: 'Thickness reference for this pass',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 3,
  }),
  def({
    tagName: 'STRIP.THICKNESS.DEVIATION',
    description: 'Thickness deviation from reference',
    unit: 'µm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Difference of two tags that are both present on the feed.',
    limits: {
      warningLow: -engineeringConfig.thicknessTolerance,
      warningHigh: engineeringConfig.thicknessTolerance,
      alarmLow: -engineeringConfig.thicknessTolerance * 3,
      alarmHigh: engineeringConfig.thicknessTolerance * 3,
    },
    decimals: 1,
  }),
  def({
    tagName: 'STRIP.REDUCTION',
    description: 'Reduction achieved this pass',
    unit: '%',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Computed from INPUT_THICKNESS and OUTPUT_THICKNESS, both present on the feed.',
    decimals: 2,
  }),

  // -------------------------------------------------------------------------
  // TENSION
  // -------------------------------------------------------------------------
  def({
    tagName: 'TENSION.ENTRY',
    description: 'Entry (back) tension',
    unit: 'kN',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    limits: {
      alarmLow: tensionLimits.entryMin,
      alarmHigh: tensionLimits.entryMax,
    },
    decimals: 1,
  }),
  def({
    tagName: 'TENSION.EXIT',
    description: 'Exit (front) tension',
    unit: 'kN',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    limits: {
      alarmLow: tensionLimits.exitMin,
      alarmHigh: tensionLimits.exitMax,
    },
    decimals: 1,
  }),
  def({
    tagName: 'TENSION.ENTRY.REF',
    description: 'Entry tension reference',
    unit: 'kN',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 1,
  }),
  def({
    tagName: 'TENSION.EXIT.REF',
    description: 'Exit tension reference',
    unit: 'kN',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 1,
  }),

  // -------------------------------------------------------------------------
  // REELS — DTR / ETR / POR. All present on the CRM04 extract.
  // -------------------------------------------------------------------------
  ...buildReelTags('DTR', 'Decoiler / entry tension reel'),
  ...buildReelTags('ETR', 'Exit tension reel'),
  ...buildReelTags('POR', 'Payoff reel'),

  // -------------------------------------------------------------------------
  // COIL / PASS
  // -------------------------------------------------------------------------
  def({
    tagName: 'COIL.ID',
    description: 'Coil identifier',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
  }),
  def({
    tagName: 'COIL.GRADE',
    description: 'Coil grade',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Grade is not in the extract; coil ID 1-4 would have to be joined against MES.',
  }),
  def({
    tagName: 'COIL.LENGTH',
    description: 'Strip length at current thickness',
    unit: 'm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'MEASURED',
    decimals: 0,
  }),
  def({
    tagName: 'COIL.REMAINING_LENGTH',
    description: 'Length remaining in this pass',
    unit: 'm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Derived from the payoff reel length tag.',
    decimals: 0,
  }),
  def({
    tagName: 'COIL.DIAMETER',
    description: 'Payoff coil diameter',
    unit: 'mm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'MEASURED',
    decimals: 0,
  }),
  def({
    tagName: 'PASS.NUMBER',
    description: 'Current pass number',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 0,
  }),
  def({
    tagName: 'PASS.TOTAL',
    description: 'Total passes in schedule',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'REFERENCE',
    decimals: 0,
  }),
  def({
    tagName: 'PASS.PROGRESS',
    description: 'Pass progress',
    unit: '%',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Derived from the payoff reel length tag against the coil length.',
    decimals: 0,
  }),

  // -------------------------------------------------------------------------
  // MAIN DRIVE
  // -------------------------------------------------------------------------
  def({
    tagName: 'DRIVE.TORQUE',
    description: 'Main drive torque (MILL_ACT_TRQ)',
    unit: 'kNm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    limits: { warningHigh: motorLimits.torqueMax * 0.9, alarmHigh: motorLimits.torqueMax },
    decimals: 1,
  }),
  def({
    tagName: 'DRIVE.CURRENT',
    description: 'Main drive current (MILL_CURRENT)',
    unit: 'A',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    limits: { warningHigh: motorLimits.currentMax * 0.9, alarmHigh: motorLimits.currentMax },
    decimals: 0,
  }),
  def({
    tagName: 'DRIVE.POWER',
    description: 'Main drive power',
    unit: 'kW',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: 'Computed from MILL_ACT_TRQ and the derived roll speed.',
    limits: { warningHigh: motorLimits.powerMax * 0.9, alarmHigh: motorLimits.powerMax },
    decimals: 0,
  }),
  def({
    tagName: 'DRIVE.RPM',
    description: 'Main drive speed',
    unit: 'rpm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_WR_RPM,
    decimals: 0,
  }),

  // -------------------------------------------------------------------------
  // ROLLS
  // -------------------------------------------------------------------------
  def({
    tagName: 'WR.TOP.RPM',
    description: 'Upper work roll speed',
    unit: 'rpm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_WR_RPM,
    decimals: 0,
  }),
  def({
    tagName: 'WR.BOTTOM.RPM',
    description: 'Lower work roll speed',
    unit: 'rpm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_WR_RPM,
    decimals: 0,
  }),
  def({
    tagName: 'WR.TOP.BENDING',
    description: 'Upper work roll bending force',
    unit: 'kN',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_BENDING,
    decimals: 0,
  }),
  def({
    tagName: 'WR.BOTTOM.BENDING',
    description: 'Lower work roll bending force',
    unit: 'kN',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_BENDING,
    decimals: 0,
  }),
  def({
    tagName: 'WR.TOP.DIAMETER',
    description: 'Upper work roll diameter',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No roll ID / roll diameter tag in the extract; would come from the roll shop system.',
    decimals: 1,
  }),
  def({
    tagName: 'WR.BOTTOM.DIAMETER',
    description: 'Lower work roll diameter',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No roll ID / roll diameter tag in the extract; would come from the roll shop system.',
    decimals: 1,
  }),
  def({
    tagName: 'BUR.TOP.RPM',
    description: 'Upper backup roll speed',
    unit: 'rpm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_WR_RPM,
    decimals: 0,
  }),
  def({
    tagName: 'BUR.BOTTOM.RPM',
    description: 'Lower backup roll speed',
    unit: 'rpm',
    simulationProvenance: 'CALCULATED',
    liveAvailability: 'CALCULATED',
    liveNote: NOTE.NO_WR_RPM,
    decimals: 0,
  }),
  def({
    tagName: 'BUR.TOP.DIAMETER',
    description: 'Upper backup roll diameter',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No roll ID / roll diameter tag in the extract.',
    decimals: 1,
  }),
  def({
    tagName: 'BUR.BOTTOM.DIAMETER',
    description: 'Lower backup roll diameter',
    unit: 'mm',
    simulationProvenance: 'REFERENCE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No roll ID / roll diameter tag in the extract.',
    decimals: 1,
  }),

  // -------------------------------------------------------------------------
  // HYDRAULICS
  // -------------------------------------------------------------------------
  def({
    tagName: 'HYD.LOADING.PRESSURE',
    description: 'HAGC capsule loading pressure',
    unit: 'bar',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No hydraulic pressure tags in the extract.',
    limits: { alarmLow: engineeringConfig.hydraulicPressureMin },
    decimals: 0,
  }),
  def({
    tagName: 'HYD.BENDING.PRESSURE',
    description: 'Work roll bending pressure',
    unit: 'bar',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_BENDING,
    decimals: 0,
  }),
  def({
    tagName: 'HYD.GAP.POSITION',
    description: 'HAGC capsule position',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_LVDT,
    decimals: 3,
  }),
  def({
    tagName: 'LP.PRESSURE',
    description: 'Low pressure lubrication pressure',
    unit: 'bar',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: NOTE.NO_COOLANT,
    decimals: 1,
  }),

  // -------------------------------------------------------------------------
  // AUXILIARY SYSTEM STATUS
  // -------------------------------------------------------------------------
  ...(
    [
      ['LP.STATUS', 'LP system status'],
      ['HP.LOADING.STATUS', 'HP loading system status'],
      ['HP.BENDING.STATUS', 'HP bending system status'],
      ['COOLANT.STATUS', 'Roll coolant status'],
      ['LUBRICATION.STATUS', 'Lubrication status'],
      ['EXHAUST.STATUS', 'Exhaust / fume extraction status'],
    ] as const
  ).map(([tagName, description]) =>
    def({
      tagName,
      description,
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'UNAVAILABLE',
      liveNote: NOTE.NO_COOLANT,
    }),
  ),

  // -------------------------------------------------------------------------
  // PROCESS CONTROL STATUS
  // -------------------------------------------------------------------------
  ...(
    [
      ['AGC.STATUS', 'Automatic gauge control'],
      ['THFB.STATUS', 'Thickness feedback control'],
      ['THFF.STATUS', 'Thickness feed-forward control'],
      ['SPFF.STATUS', 'Speed feed-forward control'],
      ['MFC.STATUS', 'Mass flow control'],
      ['TRF.STATUS', 'Tension regulation / feed-forward'],
      ['POSITION.MODE.STATUS', 'Position control mode'],
      ['ROLLGAP.CLOSED.STATUS', 'Roll gap closed'],
      ['BENDING.STATUS', 'Roll bending control'],
    ] as const
  ).map(([tagName, description]) =>
    def({
      tagName,
      description,
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'UNAVAILABLE',
      liveNote: 'No control-mode status words in the extract; these come from the mill PLC.',
    }),
  ),

  // -------------------------------------------------------------------------
  // INTERLOCKS
  // -------------------------------------------------------------------------
  ...(
    [
      ['DRIVE.READY', 'Drive ready'],
      ['GAUGE.READY', 'Gauge ready'],
      ['HYDRAULIC.READY', 'Hydraulic ready'],
      ['TENSION.READY', 'Tension ready'],
      ['EMERGENCY.STOP', 'Emergency stop'],
      ['FAST.STOP', 'Fast stop'],
    ] as const
  ).map(([tagName, description]) =>
    def({
      tagName,
      description,
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'UNAVAILABLE',
      liveNote: 'No interlock chain tags in the extract beyond LINE_START_STOP.',
    }),
  ),

  // -------------------------------------------------------------------------
  // X-RAY GAUGES — both present on the CRM04 extract.
  // -------------------------------------------------------------------------
  def({
    tagName: 'GAUGE.DTR.THICKNESS',
    description: 'X-ray thickness gauge, DTR side',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    decimals: 3,
  }),
  def({
    tagName: 'GAUGE.ETR.THICKNESS',
    description: 'X-ray thickness gauge, ETR side',
    unit: 'mm',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'MEASURED',
    decimals: 3,
  }),
  def({
    tagName: 'GAUGE.DTR.READY',
    description: 'X-ray gauge ready, DTR side',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Gauge readings are present but the gauge ready/standardise status word is not.',
  }),
  def({
    tagName: 'GAUGE.ETR.READY',
    description: 'X-ray gauge ready, ETR side',
    simulationProvenance: 'SIMULATED',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Gauge readings are present but the gauge ready/standardise status word is not.',
  }),

  // ---------------------------------------------------------------------------
  // DECLARED GAPS — parameters the operations screen asks for that this twin
  // cannot source. They are declared rather than omitted so the dashboard can
  // show the parameter, name it, and say NO TAG with a reason, instead of
  // quietly leaving a hole where an operator expects a number.
  //
  // These carry `simulationProvenance: 'UNAVAILABLE'` as well as
  // `liveAvailability: 'UNAVAILABLE'`, which matters: `resolveProvenance`
  // returns the simulation provenance unconditionally in SIMULATION mode, so
  // anything less would invent a value in the demo that does not exist in the
  // model either. There is no emitter for any of them, by design.
  //
  // PROMOTION PATH: when PIMS starts carrying one, flip `liveAvailability`,
  // drop the `liveNote`, and add it to the frame builder. Nothing else changes.
  // ---------------------------------------------------------------------------
  def({
    tagName: 'AGC.ERROR',
    description: 'AGC thickness error (controller input)',
    unit: 'µm',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'The HAGC controller internals are not published. The thickness deviation is the same error the loop acts on — use that.',
    decimals: 1,
  }),
  def({
    tagName: 'AGC.OUTPUT',
    description: 'AGC gap command (controller output)',
    unit: 'mm',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No HAGC controller output word in the extract.',
    decimals: 3,
  }),
  def({
    tagName: 'AGC.GAP.CORRECTION',
    description: 'AGC gap correction term',
    unit: 'mm',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'Computed inside the thickness model and consumed immediately; never published as a value.',
    decimals: 3,
  }),
  def({
    tagName: 'HYD.FLOW',
    description: 'Hydraulic system flow',
    unit: 'LPM',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No hydraulic flow instrument on the CRM04 extract.',
    decimals: 0,
  }),
  def({
    tagName: 'HYD.TEMPERATURE',
    description: 'Hydraulic oil temperature',
    unit: '°C',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No temperature instrumentation reaches this twin — see §22.',
    decimals: 1,
  }),
  def({
    tagName: 'COOLANT.TEMPERATURE',
    description: 'Roll coolant temperature',
    unit: '°C',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No temperature instrumentation reaches this twin — see §22.',
    decimals: 1,
  }),
  def({
    tagName: 'COOLANT.FLOW',
    description: 'Roll coolant flow',
    unit: 'LPM',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Only a coolant health word is published, never the flow itself.',
    decimals: 0,
  }),
  def({
    tagName: 'COOLANT.PRESSURE',
    description: 'Roll coolant header pressure',
    unit: 'bar',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Only a coolant health word is published, never the pressure itself.',
    decimals: 1,
  }),
  def({
    tagName: 'COOLANT.TANK.LEVEL',
    description: 'Coolant tank level',
    unit: '%',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No tank level instrument on the CRM04 extract.',
    decimals: 0,
  }),
  def({
    tagName: 'LUBRICATION.FLOW',
    description: 'Drive lubrication flow',
    unit: 'LPM',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'Only a lubrication health word is published, never the flow itself.',
    decimals: 0,
  }),
  def({
    tagName: 'LUBRICATION.TEMPERATURE',
    description: 'Drive lubrication oil temperature',
    unit: '°C',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote: 'No temperature instrumentation reaches this twin — see §22.',
    decimals: 1,
  }),
  def({
    tagName: 'MILL.ENERGY.COIL',
    description: 'Energy consumed on the current coil',
    unit: 'kWh',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'Requires integrating power across the whole coil. A browser can only measure how long its own tab has been open, so this must come from the historian.',
    decimals: 1,
  }),
  def({
    tagName: 'MILL.ENERGY.TODAY',
    description: 'Energy consumed since 00:00',
    unit: 'kWh',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'A day total cannot be reconstructed by a client that was not running all day — this must come from the historian.',
    decimals: 0,
  }),
  def({
    tagName: 'MILL.TIME.ROLLING.DAY',
    description: 'Mill rolling time since 00:00',
    unit: 's',
    simulationProvenance: 'UNAVAILABLE',
    liveAvailability: 'UNAVAILABLE',
    liveNote:
      'A day total cannot be reconstructed by a client that was not running all day — this must come from the historian.',
    decimals: 0,
  }),
]

/**
 * Reel tag block. POR carries LAYERS instead of THICKNESS, per the §7.2
 * namespace.
 */
function buildReelTags(reel: 'DTR' | 'ETR' | 'POR', name: string): TagDefinition[] {
  const isPor = reel === 'POR'
  const tags: TagDefinition[] = [
    def({
      tagName: `${reel}.TENSION`,
      description: `${name} tension`,
      unit: 'kN',
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'MEASURED',
      decimals: 1,
    }),
    def({
      tagName: `${reel}.DIAMETER`,
      description: `${name} coil diameter`,
      unit: 'mm',
      simulationProvenance: 'CALCULATED',
      liveAvailability: 'MEASURED',
      decimals: 0,
    }),
    def({
      tagName: `${reel}.LENGTH`,
      description: `${name} strip length`,
      unit: 'm',
      simulationProvenance: 'CALCULATED',
      liveAvailability: 'MEASURED',
      decimals: 0,
    }),
    def({
      tagName: `${reel}.TORQUE`,
      description: `${name} torque`,
      unit: 'kNm',
      simulationProvenance: 'CALCULATED',
      liveAvailability: 'MEASURED',
      decimals: 1,
    }),
    def({
      tagName: `${reel}.CURRENT`,
      description: `${name} current`,
      unit: 'A',
      simulationProvenance: 'CALCULATED',
      liveAvailability: 'MEASURED',
      decimals: 0,
    }),
    def({
      tagName: `${reel}.RPM`,
      description: `${name} speed`,
      unit: 'rpm',
      simulationProvenance: 'CALCULATED',
      liveAvailability: 'CALCULATED',
      liveNote: 'No reel speed tag; derived from line speed and the measured reel diameter.',
      decimals: 1,
    }),
    def({
      tagName: `${reel}.BRAKE`,
      description: `${name} brake`,
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'UNAVAILABLE',
      liveNote: 'No brake status word in the extract.',
    }),
    def({
      tagName: `${reel}.STATUS`,
      description: `${name} status`,
      simulationProvenance: 'SIMULATED',
      liveAvailability: 'CALCULATED',
      liveNote: 'Derived from the reel torque and length rate of change.',
    }),
  ]

  if (isPor) {
    tags.push(
      def({
        tagName: 'POR.LAYERS',
        description: 'Payoff reel wraps on mandrel',
        simulationProvenance: 'CALCULATED',
        liveAvailability: 'CALCULATED',
        liveNote: 'Derived from the measured POR diameter and strip thickness.',
        decimals: 0,
      }),
    )
  } else {
    tags.push(
      def({
        tagName: `${reel}.THICKNESS`,
        description: `${name} strip thickness`,
        unit: 'mm',
        simulationProvenance: 'SIMULATED',
        liveAvailability: 'MEASURED',
        decimals: 3,
      }),
    )
    tags.push(
      def({
        tagName: `${reel}.ROLE`,
        description: `${name} logical role this pass`,
        simulationProvenance: 'CALCULATED',
        liveAvailability: 'CALCULATED',
        liveNote: 'Derived from rolling direction — never hardcoded to a side (§1).',
      }),
    )
  }

  return tags
}

/** Indexed lookup. Built once; every module reads through this. */
export const tagDefinitionMap: ReadonlyMap<string, TagDefinition> = new Map(
  tagDefinitions.map((d) => [d.tagName, d]),
)

export function getTagDefinition(tagName: string): TagDefinition | undefined {
  return tagDefinitionMap.get(tagName)
}

/** §7.4 summary counts, shown on the tag inventory page. */
export const tagInventory = {
  total: tagDefinitions.length,
  measuredOnLiveFeed: tagDefinitions.filter((d) => d.liveAvailability === 'MEASURED').length,
  referenceOnLiveFeed: tagDefinitions.filter((d) => d.liveAvailability === 'REFERENCE').length,
  calculatedOnLiveFeed: tagDefinitions.filter((d) => d.liveAvailability === 'CALCULATED').length,
  estimatedOnLiveFeed: tagDefinitions.filter((d) => d.liveAvailability === 'ESTIMATED').length,
  unavailableOnLiveFeed: tagDefinitions.filter((d) => d.liveAvailability === 'UNAVAILABLE').length,
}
