/**
 * PLANT REFERENCE CONFIGURATION — §2 of the master spec.
 * CRM04 / CRM06 4HI reversing cold rolling mill, Tata Steel CRM Sahibabad,
 * Narrow Complex.
 *
 * SINGLE SOURCE for every machine dimension, rating and identity string.
 * No component may hardcode a mill dimension. `PLANT_PARAMETERS` below is built
 * BY REFERENCE from this object so the config page and the physics can never
 * drift apart.
 *
 * Parameters marked `verified: false` are PLACEHOLDERS. They are rendered with an
 * UNVERIFIED badge everywhere they appear and are listed in the assumptions
 * register (docs/ASSUMPTIONS.md). They must not be presented as mill technology
 * data.
 */

export type ParameterProvenanceNote = 'Confirmed' | 'Assumed — CONFIRM with mill engineering'

export interface PlantParameter {
  key: string
  label: string
  value: number | string
  unit?: string
  note: ParameterProvenanceNote
  verified: boolean
  /** Owner responsible for closing the gap — §22 open items. */
  owner?: string
}

export const millConfig = {
  identity: {
    plant: 'Tata Steel CRM Sahibabad — Narrow Complex',
    mill: 'CRM04',
    alternateMill: 'CRM06',
    type: '4HI reversing, single stand',
    hmiReference: 'ABB MillPilot',
    driveSystem: 'ABB MillPilotDrives / MillRollGap',
  },

  /**
   * Geometry, mm. WR/BUR diameters and barrel length are PLACEHOLDERS (§2).
   * They drive both the physics (contact length, roll rpm) and the 3D scene,
   * so replacing them here updates the model and the render together.
   */
  geometry: {
    workRollDiameter: 400,
    workRollDiameterMin: 360,
    workRollDiameterMax: 420,
    backupRollDiameter: 1150,
    backupRollDiameterMin: 1050,
    backupRollDiameterMax: 1200,
    barrelLength: 1300,
    /** Housing window width, mm — scene only. */
    housingWidth: 2600,
    housingHeight: 4200,
    /** Distance from mill centreline to each reel centre, mm. */
    reelCentreDistance: 3400,
    /** Reel mandrel diameter (expanded), mm. */
    mandrelDiameter: 508,
    /** Maximum coil outside diameter the reels accept, mm. */
    maxCoilDiameter: 1600,
    /** Distance from mill centreline to each X-ray gauge, mm. */
    gaugeDistance: 1500,
    /** Pass line height above floor, mm — scene only. */
    passLineHeight: 900,
  },

  /** Ratings and process capability. */
  ratings: {
    /** Maximum roll separating force, t. Confirmed. */
    maxRollingForce: 700,
    /** Maximum mill speed, m/min. Confirmed. */
    maxMillSpeed: 500,
    /** Threading speed, m/min. */
    threadingSpeed: 30,
    /** Mill modulus M, t/mm — PLACEHOLDER, gaugemeter anchor (§8.1). */
    millModulus: 500,
    /**
     * Main drive rating, kW — PLACEHOLDER.
     *
     * The four drive placeholders below are mutually consistent:
     * P_rated = T_rated × ω_base, i.e. 2000 kW = 80 kNm × 25 rad/s (239 rpm).
     * Sized so the demo schedule peaks around 75% of rating rather than sitting
     * on the current limit. All four must be replaced together with the real
     * nameplate data (§22 item 1) — changing one alone breaks the relation.
     */
    mainDriveRating: 2000,
    /** Main drive base speed, rpm — PLACEHOLDER. */
    mainDriveBaseRpm: 240,
    /** Main drive rated torque, kNm — PLACEHOLDER. */
    mainDriveRatedTorque: 80,
    /** Main drive rated armature current, A — PLACEHOLDER. */
    mainDriveRatedCurrent: 2600,
    /** Reel drive rated torque, kNm — PLACEHOLDER. */
    reelRatedTorque: 45,
    /** Reel drive rated current, A — PLACEHOLDER. */
    reelRatedCurrent: 1200,
    /** Thickness tolerance target, µm. Confirmed. */
    thicknessToleranceUm: 5,
    /** Maximum strip width, mm. */
    maxStripWidth: 1250,
  },

  /** Automatic gauge control — §2, confirmed. */
  agc: {
    type: 'HAGC',
    servoValveBandwidthHz: 100,
    positionFeedback: 'LVDT per side (OS / DS)',
    thicknessFeedback: 'Entry + exit X-ray gauges',
    law: 'Gaugemeter h = S0 + F/M with mass-flow trim',
    /**
     * Standing plant issue (§2): Mill 4 BUR barrel taper (DS > OS) compounded by
     * a -9 t AGC differential force reference. Carried in the data model from
     * day one so OS/DS split is never retrofitted.
     */
    differentialForceReference: -9,
    differentialForceIssueOpen: true,
  },

  /** Reels present on the line. */
  reels: {
    dtr: { id: 'DTR', name: 'Decoiler / entry tension reel', side: 'LEFT' },
    etr: { id: 'ETR', name: 'Exit tension reel', side: 'RIGHT' },
    por: { id: 'POR', name: 'Payoff reel (line charge)', side: 'LEFT_UPSTREAM' },
  },

  /** Coolant / rolling oil, confirmed per mill (§2). */
  media: {
    CRM04: { coolant: 'Bamerol Aquarol 411B' },
    CRM06: { coolant: 'Servosteeroll C105' },
  },

  passSchedule: {
    source: 'ABP / plant pass schedule system',
  },

  /**
   * 3D scene presentation constants.
   *
   * VISUAL EXAGGERATION NOTICE: a 2 mm strip between 400 mm rolls is ~0.5% of the
   * roll diameter and is invisible at engineering scale. The strip thickness and
   * roll gap are therefore drawn with a linear exaggeration factor. The *numbers*
   * shown are always true; only the pixels are scaled, and the scene labels the
   * factor so nobody misreads the picture. Nothing else in the scene is scaled.
   */
  visual: {
    stripThicknessExaggeration: 30,
    rollGapExaggeration: 30,
    /** Extra separation always applied between WR surfaces, scene units. */
    rollGapVisualOffset: 0.004,
    /** Length of the entry/exit strip spans, mm (scene only). */
    stripSpanLength: 3400,
    /** Interpolation half-life for scene damping, seconds (§10.4). */
    dampingHalfLife: 0.12,
    /**
     * Camera home — the engineering 3/4 isometric of §10.7, framed so the whole
     * line from payoff reel to tension reel is in shot at the default zoom.
     */
    cameraHome: [5.8, 2.7, 7.4] as [number, number, number],
    cameraTarget: [0, 0.05, 0] as [number, number, number],
    /**
     * Close view on the roll stack. The housing necessarily hides the bite from
     * the line view — that is true of the real machine too — so the twin offers
     * the view an engineer would walk round to get.
     */
    cameraStand: [4.4, 1.6, 5.2] as [number, number, number],
    cameraStandTarget: [0, 0.15, 0] as [number, number, number],
    cameraFov: 36,
    cameraMinDistance: 2.4,
    cameraMaxDistance: 24,
  },
} as const

export type MillConfig = typeof millConfig

/**
 * Assumptions register source (§2, §20.8). Values are taken BY REFERENCE from
 * `millConfig` above — there is no second literal to fall out of step.
 */
export const PLANT_PARAMETERS: PlantParameter[] = [
  {
    key: 'millType',
    label: 'Mill type',
    value: millConfig.identity.type,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'maxRollingForce',
    label: 'Max rolling force',
    value: millConfig.ratings.maxRollingForce,
    unit: 't',
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'maxMillSpeed',
    label: 'Max mill speed',
    value: millConfig.ratings.maxMillSpeed,
    unit: 'm/min',
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'thicknessTolerance',
    label: 'Thickness tolerance target',
    value: `±${millConfig.ratings.thicknessToleranceUm}`,
    unit: 'µm',
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'agc',
    label: 'AGC',
    value: `${millConfig.agc.type} · servo valves ${millConfig.agc.servoValveBandwidthHz} Hz+ · ${millConfig.agc.positionFeedback} · ${millConfig.agc.thicknessFeedback}`,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'thicknessLaw',
    label: 'Thickness law',
    value: millConfig.agc.law,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'reels',
    label: 'Reels',
    value: 'DTR (entry / decoiler) · ETR (exit / tension reel) · POR (payoff reel)',
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'coolantCRM04',
    label: 'CRM04 coolant',
    value: millConfig.media.CRM04.coolant,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'coolantCRM06',
    label: 'CRM06 coolant',
    value: millConfig.media.CRM06.coolant,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'passScheduleSource',
    label: 'Pass schedule source',
    value: millConfig.passSchedule.source,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'workRollDiameter',
    label: 'Work roll diameter',
    value: millConfig.geometry.workRollDiameter,
    unit: 'mm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'backupRollDiameter',
    label: 'Backup roll diameter',
    value: millConfig.geometry.backupRollDiameter,
    unit: 'mm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'barrelLength',
    label: 'Roll barrel length',
    value: millConfig.geometry.barrelLength,
    unit: 'mm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'millModulus',
    label: 'Mill modulus M',
    value: millConfig.ratings.millModulus,
    unit: 't/mm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'mainDriveRating',
    label: 'Main drive rating',
    value: millConfig.ratings.mainDriveRating,
    unit: 'kW',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'mainDriveRatedTorque',
    label: 'Main drive rated torque',
    value: millConfig.ratings.mainDriveRatedTorque,
    unit: 'kNm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'mainDriveRatedCurrent',
    label: 'Main drive rated current',
    value: millConfig.ratings.mainDriveRatedCurrent,
    unit: 'A',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'mandrelDiameter',
    label: 'Reel mandrel diameter',
    value: millConfig.geometry.mandrelDiameter,
    unit: 'mm',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering',
  },
  {
    key: 'differentialForceReference',
    label: 'AGC differential force reference',
    value: millConfig.agc.differentialForceReference,
    unit: 't',
    note: 'Assumed — CONFIRM with mill engineering',
    verified: false,
    owner: 'Mill engineering — §22 item 5, audit before force-model baselining',
  },
]

export const UNVERIFIED_PARAMETER_COUNT = PLANT_PARAMETERS.filter((p) => !p.verified).length

/** §22 — open items to resolve before Phase 1 sign-off. */
export const OPEN_ITEMS = [
  {
    id: 1,
    item: 'WR / BUR diameters, barrel length, mill modulus M, main drive rating',
    owner: 'Mill engineering',
  },
  {
    id: 2,
    item: 'Actual force / speed / tension limits per grade family for alarm thresholds',
    owner: 'Process',
  },
  {
    id: 3,
    item: 'Which additional PLC tags OEM can expose at higher sampling (priority: roll separating force, LVDT OS/DS, WR bending, WR RPM)',
    owner: 'OEM + automation',
  },
  {
    id: 4,
    item: 'Whether the twin runs on live edge feed, historian replay, or both in v1',
    owner: 'Digital',
  },
  {
    id: 5,
    item: 'AGC differential force reference audit (standing -9 t issue) before any force-model baselining',
    owner: 'Mill engineering',
  },
] as const
