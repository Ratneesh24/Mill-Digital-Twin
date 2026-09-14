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
 * PROVENANCE. Most of the machine data here now comes from the OEM manual —
 * Flat Products Equipments (I) Ltd., CRM04 Operation & Maintenance Manual,
 * reproduced in docs/CRM04_MECHANICAL_DATA_BOOK.md. Those values carry the note
 * 'Confirmed — FPE O&M manual' and a section reference in the comment.
 *
 * Parameters marked `verified: false` are still PLACEHOLDERS. They are rendered
 * with an UNVERIFIED badge everywhere they appear and are listed in the
 * assumptions register (docs/ASSUMPTIONS.md). They must not be presented as mill
 * technology data. Two kinds remain: values the manual simply does not state
 * (mill modulus, armature currents) and values its own §14 register flags as
 * illegible in the scanned drawings (every centre-line spacing).
 */

export type ParameterProvenanceNote =
  | 'Confirmed'
  | 'Confirmed — FPE O&M manual'
  | 'Assumed — CONFIRM with mill engineering'

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
   * Geometry, mm — FPE O&M manual §1.3 (rolls) and §7.1 (reel mandrels).
   *
   * These drive both the physics (contact length, roll rpm) and the 3D scene, so
   * changing one here updates the model and the render together. CRM04 is a
   * NARROW mill: 215 mm work rolls on a 600 mm barrel, not the 400/1300 wide-mill
   * placeholders this file used to carry.
   */
  geometry: {
    /** Working Ø max, §1.3. The mill runs the roll down to `Min` before scrapping. */
    workRollDiameter: 215,
    workRollDiameterMin: 202,
    workRollDiameterMax: 215,
    /** Work roll neck Ø — Timken TQO cone bore, §10.4 item 19. */
    workRollNeckDiameter: 120.65,
    backupRollDiameter: 550,
    backupRollDiameterMin: 520,
    backupRollDiameterMax: 550,
    /** BUR neck Ø — Timken TQO cone bore, §10.4 item 20. */
    backupRollNeckDiameter: 317.5,
    barrelLength: 600,
    /** Housing window width, mm — scene only, NOT stated in the manual (§14 item 2). */
    housingWidth: 1600,
    /** Housing height, mm — scene only, NOT stated in the manual (§14 item 2). */
    housingHeight: 3500,
    /** Tension reel mandrel Ø, expanded / true circle, §7.1. */
    mandrelDiameter: 508,
    /** Tension reel mandrel Ø, collapsed, §7.1. */
    tensionReelCollapsedDiameter: 497,
    /** Tension reel drum face width, mm — §7.1. */
    tensionReelFaceWidth: 620,
    /** Pay-off reel mandrel barrel length, mm — §5.2. */
    porMandrelFaceWidth: 680,
    /** Pay-off reel mandrel Ø, expanded, §5.2. Its true circle is also 508. */
    porMandrelExpandedDiameter: 530,
    /** Pay-off reel mandrel Ø, collapsed, §5.2. */
    porMandrelCollapsedDiameter: 460,
    /** Maximum coil outside diameter, mm — outgoing, §1.2. */
    maxCoilDiameter: 1900,
    /** Coil inside diameter, mm — §1.2, equal to the mandrel true circle. */
    coilInnerDiameter: 508,
    /**
     * Pass line height above floor, mm — scene only. The manual dimensions this
     * on EU 01 1 A1 but the scan is not legible (§14 item 2).
     */
    passLineHeight: 900,
  },

  /**
   * LINE LAYOUT — distances from the mill centreline, mm.
   *
   * The ORDER is confirmed by the manual §3:
   *   POR -> pinch roll/flattener -> ETR -> entry deflector -> MILL ->
   *   delivery deflector -> DTR
   * which puts the pay-off reel and the flattener OUTBOARD of the entry tension
   * reel, on the same side of the stand.
   *
   * The MAGNITUDES are not confirmed. They are dimensioned on EU 01 1 A1 but the
   * manual's own §14 item 1 records that the scan is illegible, so every distance
   * below is a plausible reconstruction and is carried as `verified: false`. They
   * must be measured off the original drawing before any use beyond the picture.
   */
  lineLayout: {
    /**
     * Which side of the stand the entry equipment occupies, in scene X.
     * -1 puts POR / flattener / ETR at -X, which the default camera renders on
     * screen-RIGHT — the manual's right-to-left mill hand (§1.1).
     */
    entrySideSign: -1,
    /** Air knife wiper, §5.9 — immediately outboard of the roll bite. */
    airKnifeDistance: 450,
    /** Isotope thickness gauge, §5.8. */
    gaugeDistance: 900,
    /** Deflector roll and threading table, §5.6. */
    deflectorDistance: 1500,
    /** Crop shear, §5.7 — delivery side only. */
    cropShearDistance: 2400,
    /** Entry tension reel, §7. */
    etrDistance: 4200,
    /** Delivery tension reel, §7. */
    dtrDistance: 4200,
    /** Carry-over table at the flattener exit, §5.5. */
    carryOverTableDistance: 5600,
    /** Pinch roll cum flattener unit, §5.4. */
    flattenerDistance: 6700,
    /** Peeler table on the flattener frame, §5.3. */
    peelerDistance: 7500,
    /** Pay-off reel, §5.2. */
    porDistance: 8600,
    /** Coil car travel length, mm — §5.1, confirmed. */
    coilCarTravel: 3400,
    /** Coil storage saddle offset from the pass line, mm — scene only. */
    saddleZ: -2200,
  },

  /** Ratings and process capability — FPE O&M manual §1 and §2 unless noted. */
  ratings: {
    /** Maximum roll separating force, T — §1.1. */
    maxRollingForce: 360,
    /** Maximum mill speed, m/min — §1.1 (0 - 170 - 450). */
    maxMillSpeed: 450,
    /** Base (field-weakening knee) mill speed, m/min — §1.1. */
    baseMillSpeed: 170,
    /** Threading speed, m/min — §5.4. */
    threadingSpeed: 30,
    /**
     * Mill modulus M, t/mm — PLACEHOLDER, gaugemeter anchor (§8.1).
     * The FPE manual does not state it; it has to be measured on the stand.
     */
    millModulus: 500,
    /**
     * Main drive — Kirloskar KLDC 630-L, §2.1. Confirmed nameplate.
     *
     * Rated torque is DERIVED from the other two and must stay that way:
     *   T_rated = P_rated / ω_base = 750 kW / (350 rpm) = 20.5 kNm.
     * Changing the kW or the base rpm without recomputing the torque breaks the
     * relation the drive model depends on.
     */
    mainDriveRating: 750,
    mainDriveBaseRpm: 350,
    mainDriveMaxRpm: 710,
    mainDriveRatedTorque: 20.5,
    /**
     * Main drive rated armature current, A — PLACEHOLDER. The manual gives kW
     * and rpm for every drive but no armature current anywhere.
     */
    mainDriveRatedCurrent: 1400,
    /** ETR / DTR drive — BSSL DC, §2.1. Confirmed nameplate. */
    reelDriveRating: 500,
    reelDriveBaseRpm: 438,
    reelDriveMaxRpm: 1350,
    /** ETR / DTR gearbox ratio — §2.3. */
    reelGearRatio: 4.3333,
    /**
     * Reel rated torque at the mandrel, kNm — DERIVED:
     *   500 kW / (438 rpm) x 4.3333 = 47 kNm.
     */
    reelRatedTorque: 47,
    /** Reel drive rated current, A — PLACEHOLDER, as above. */
    reelRatedCurrent: 1100,
    /** Pay-off reel drive — BSSL DC, §2.1, through a 99.37:1 gearbox (§2.3). */
    porDriveRating: 70,
    porGearRatio: 99.37,
    /** Mill pinion stand ratio — FLENDER SPL 260-2, §2.3. */
    millPinionRatio: 1,
    /** Flattener reducer ratio — §2.3. */
    flattenerReducerRatio: 20,
    /**
     * Reel tension envelope, kgf — §1.4. Converted to kN once, in
     * engineeringConfig, so there is a single conversion point.
     */
    reelTensionMaxKg: 6900,
    /** Tension available above 350 m/min, kgf — §1.4. */
    reelTensionMaxHighSpeedKg: 5300,
    /** Minimum controllable reel tension, kgf — §1.4. */
    reelTensionMinKg: 690,
    /** Pay-off reel tension, kgf, up to 170 m/min — §1.4. */
    porTensionMaxKg: 2500,
    /** Roll force cylinder, §1.4 / §6.2 / Table I item 19. */
    rollForceCylinderBore: 420,
    rollForceCylinderStroke: 45,
    /** Roll force cylinder working / test pressure, kg/cm² — §1.4. */
    rollForceWorkingPressure: 210,
    rollForceTestPressure: 250,
    /** All other hydraulic cylinders, working / test pressure, kg/cm² — §1.4. */
    auxCylinderWorkingPressure: 105,
    auxCylinderTestPressure: 160,
    /** Pay-off reel axial shift, ± mm — §1.4. */
    porAxialShift: 75,
    /** Thickness tolerance target, µm. Confirmed. */
    thicknessToleranceUm: 5,
    /** Strip width envelope, mm — §1.2. */
    maxStripWidth: 500,
    minStripWidth: 250,
    /** Incoming strip thickness envelope, mm — §1.2. */
    entryThicknessMin: 1.6,
    entryThicknessMax: 4.5,
    /** Outgoing strip thickness envelope, mm — §1.2. */
    exitThicknessMin: 0.3,
    exitThicknessMax: 3.0,
    /** Carbon range of the grades rolled, % — §1.1. */
    carbonMin: 0.05,
    carbonMax: 1.03,
    /** Coil weight limits — §1.2. */
    maxCoilWeightT: 10,
    maxCoilWeightPerMmKg: 20,
    /** Roll coolant flow, LPM — §9.1. */
    coolantFlowLpm: 1200,
    /** Drive lubrication system capacity, LPM — §9.2. */
    driveLubeFlowLpm: 180,
    /** Fume exhaust blower capacity, m³/hr — §9.4. */
    fumeExhaustCapacity: 40_000,
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

  /**
   * Reels present on the line, named as the OEM names them (§3, §7).
   *
   * ETR is the ENTRY tension reel and shares the entry side with the pay-off reel
   * and the flattener; DTR is the DELIVERY tension reel. `side` here is the
   * physical station, not the process role — which reel is paying off at any
   * moment is derived from direction in `reversingEngine.payoffReel`.
   */
  reels: {
    etr: { id: 'ETR', name: 'Entry tension reel', side: 'ENTRY' },
    dtr: { id: 'DTR', name: 'Delivery tension reel', side: 'DELIVERY' },
    por: { id: 'POR', name: 'Pay-off reel (line charge)', side: 'ENTRY_UPSTREAM' },
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
   * VISUAL EXAGGERATION NOTICE: a 2 mm strip between 215 mm rolls is ~1% of the
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
    /** Interpolation half-life for scene damping, seconds (§10.4). */
    dampingHalfLife: 0.12,
    /**
     * WHICH SIDE OF THE BARREL THE CAMERA STANDS ON, in scene Z.
     *
     * This is not a taste decision. The entry equipment is at -X, so a camera on
     * +Z renders the line with the entry end on the LEFT and the first pass
     * running left to right. CRM04's mill hand is RIGHT TO LEFT (§1.1). Standing
     * the camera at -Z instead puts the entry end on screen-right, so the twin
     * reads the way the mill does to someone on the floor.
     *
     * Every camera preset below and every scene label sits on this side; flipping
     * the sign moves them all together.
     */
    cameraSideZ: -1,
    /**
     * Camera home — the engineering 3/4 isometric of §10.7, framed so the whole
     * line is in shot. The line now spans POR at -8.6 m to DTR at +4.2 m, so the
     * target is offset towards the entry end rather than sitting on the stand.
     */
    cameraHome: [4.5, 5.0, -13.5] as [number, number, number],
    cameraTarget: [-2.2, 0.1, 0] as [number, number, number],
    /**
     * Close view on the roll stack. The housing necessarily hides the bite from
     * the line view — that is true of the real machine too — so the twin offers
     * the view an engineer would walk round to get.
     *
     * That view is down the BARREL AXIS, through the housing window: the two
     * housings are frames in the X-Y plane and the rolls run between them, so
     * looking along Z is the one angle where the whole stack is visible at once.
     * A more oblique angle puts a housing post and a Mae-west block in front of
     * the rolls and shows the operator the outside of the stand.
     */
    cameraStand: [1.1, 0.6, -2.9] as [number, number, number],
    cameraStandTarget: [0, 0.05, 0] as [number, number, number],
    /**
     * The entry end — pay-off reel, peeler, pinch roll cum flattener, carry-over
     * table and ETR. At line zoom this equipment is small and far from the stand,
     * and it is where the whole first-pass threading sequence (§12.1-12.2)
     * happens, so it earns a preset of its own.
     */
    cameraEntry: [-4.2, 3.2, -7.5] as [number, number, number],
    cameraEntryTarget: [-6.6, 0, 0] as [number, number, number],
    cameraFov: 36,
    cameraMinDistance: 1.2,
    cameraMaxDistance: 40,
  },
} as const

export type MillConfig = typeof millConfig

/**
 * Assumptions register source (§2, §20.8). Values are taken BY REFERENCE from
 * `millConfig` above — there is no second literal to fall out of step.
 *
 * Rows carrying 'Confirmed — FPE O&M manual' cite the OEM Operation & Maintenance
 * Manual reproduced in docs/CRM04_MECHANICAL_DATA_BOOK.md. Rows still marked
 * `verified: false` are the two categories the manual cannot close: values it does
 * not state at all, and the centre-line spacings its own §14 records as illegible
 * in the scanned general arrangement.
 */
const MANUAL: ParameterProvenanceNote = 'Confirmed — FPE O&M manual'
const ASSUMED: ParameterProvenanceNote = 'Assumed — CONFIRM with mill engineering'

export const PLANT_PARAMETERS: PlantParameter[] = [
  {
    key: 'millType',
    label: 'Mill type',
    value: millConfig.identity.type,
    note: 'Confirmed',
    verified: true,
  },
  {
    key: 'millHand',
    label: 'Mill hand',
    value: 'Right to left',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'material',
    label: 'Material rolled',
    value: `Low, medium and high carbon steel — ${millConfig.ratings.carbonMin}% to ${millConfig.ratings.carbonMax}% C`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'maxRollingForce',
    label: 'Max roll separating force',
    value: millConfig.ratings.maxRollingForce,
    unit: 'T',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'maxMillSpeed',
    label: 'Mill speed',
    value: `0 — ${millConfig.ratings.baseMillSpeed} — ${millConfig.ratings.maxMillSpeed}`,
    unit: 'm/min',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'stripWidth',
    label: 'Strip width',
    value: `${millConfig.ratings.minStripWidth} — ${millConfig.ratings.maxStripWidth}`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'entryThickness',
    label: 'Incoming thickness',
    value: `${millConfig.ratings.entryThicknessMin} — ${millConfig.ratings.entryThicknessMax}`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'exitThickness',
    label: 'Outgoing thickness',
    value: `${millConfig.ratings.exitThicknessMin} — ${millConfig.ratings.exitThicknessMax}`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'coilWeight',
    label: 'Coil weight',
    value: `${millConfig.ratings.maxCoilWeightT} T (${millConfig.ratings.maxCoilWeightPerMmKg} kg/mm max)`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'workRollDiameter',
    label: 'Work roll working diameter',
    value: `${millConfig.geometry.workRollDiameterMin} — ${millConfig.geometry.workRollDiameter}`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'backupRollDiameter',
    label: 'Back-up roll working diameter',
    value: `${millConfig.geometry.backupRollDiameterMin} — ${millConfig.geometry.backupRollDiameter}`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'barrelLength',
    label: 'Roll barrel length',
    value: millConfig.geometry.barrelLength,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'rollBearings',
    label: 'Roll neck bearings',
    value: 'Timken TQO 4-row taper roller, grease packed (WR and BUR)',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'mandrelDiameter',
    label: 'Tension reel mandrel diameter',
    value: `${millConfig.geometry.tensionReelCollapsedDiameter} collapsed / ${millConfig.geometry.mandrelDiameter} expanded`,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'maxCoilDiameter',
    label: 'Maximum coil outside diameter',
    value: millConfig.geometry.maxCoilDiameter,
    unit: 'mm',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'rollForceCylinder',
    label: 'Roll force cylinder',
    value: `Ram type, Ø${millConfig.ratings.rollForceCylinderBore} × ${millConfig.ratings.rollForceCylinderStroke} mm stroke, one per housing`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'rollForcePressure',
    label: 'Roll force working / test pressure',
    value: `${millConfig.ratings.rollForceWorkingPressure} / ${millConfig.ratings.rollForceTestPressure}`,
    unit: 'kg/cm²',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'reelTension',
    label: 'Tension reel maximum tension',
    value: `${millConfig.ratings.reelTensionMaxKg} kg to 350 m/min · ${millConfig.ratings.reelTensionMaxHighSpeedKg} kg to ${millConfig.ratings.maxMillSpeed} m/min · ${millConfig.ratings.reelTensionMinKg} kg minimum`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'porTension',
    label: 'Pay-off reel tension',
    value: millConfig.ratings.porTensionMaxKg,
    unit: 'kg',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'mainDriveRating',
    label: 'Main drive rating',
    value: `${millConfig.ratings.mainDriveRating} kW, 0 — ${millConfig.ratings.mainDriveBaseRpm} — ${millConfig.ratings.mainDriveMaxRpm} rpm (Kirloskar KLDC 630-L)`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'reelDriveRating',
    label: 'Tension reel drive rating',
    value: `${millConfig.ratings.reelDriveRating} kW, 0 — ${millConfig.ratings.reelDriveBaseRpm} — ${millConfig.ratings.reelDriveMaxRpm} rpm (BSSL)`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'gearRatios',
    label: 'Gear ratios',
    value: `POR ${millConfig.ratings.porGearRatio}:1 · ETR/DTR ${millConfig.ratings.reelGearRatio}:1 · mill pinion stand ${millConfig.ratings.millPinionRatio}:1 · flattener ${millConfig.ratings.flattenerReducerRatio}:1`,
    note: MANUAL,
    verified: true,
  },
  {
    key: 'lineOrder',
    label: 'Line centre-line order',
    value: 'POR → pinch roll/flattener → ETR → entry deflector → MILL → delivery deflector → DTR',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'coolantFlow',
    label: 'Roll coolant flow',
    value: millConfig.ratings.coolantFlowLpm,
    unit: 'LPM',
    note: MANUAL,
    verified: true,
  },
  {
    key: 'fumeExhaust',
    label: 'Fume exhaust blower',
    value: millConfig.ratings.fumeExhaustCapacity,
    unit: 'm³/hr',
    note: MANUAL,
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
    value: `${millConfig.reels.etr.name} (ETR) · ${millConfig.reels.dtr.name} (DTR) · ${millConfig.reels.por.name} (POR)`,
    note: MANUAL,
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

  // ---------------------------------------------------------------------------
  // Still unverified. Two kinds only: what the manual does not state, and what
  // its own §14 register records as illegible in the scanned drawings.
  // ---------------------------------------------------------------------------
  {
    key: 'millModulus',
    label: 'Mill modulus M',
    value: millConfig.ratings.millModulus,
    unit: 't/mm',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — not stated in the FPE manual; must be measured on the stand',
  },
  {
    key: 'mainDriveRatedCurrent',
    label: 'Main drive rated armature current',
    value: millConfig.ratings.mainDriveRatedCurrent,
    unit: 'A',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — the manual gives kW and rpm for every drive but no current',
  },
  {
    key: 'reelRatedCurrent',
    label: 'Reel drive rated current',
    value: millConfig.ratings.reelRatedCurrent,
    unit: 'A',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — as above',
  },
  {
    key: 'lineSpacings',
    label: 'Line centre-line spacings',
    value: `POR ${millConfig.lineLayout.porDistance} · flattener ${millConfig.lineLayout.flattenerDistance} · ETR ${millConfig.lineLayout.etrDistance} · deflectors ${millConfig.lineLayout.deflectorDistance} · DTR ${millConfig.lineLayout.dtrDistance} mm from mill C/L`,
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — §14 item 1: dimensioned on EU 01 1 A1 but illegible in the scan. Order is confirmed, magnitudes are not',
  },
  {
    key: 'passLineHeight',
    label: 'Pass line height above floor',
    value: millConfig.geometry.passLineHeight,
    unit: 'mm',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — §14 item 2: take from EU 01 1 A1',
  },
  {
    key: 'housingWindow',
    label: 'Mill housing window dimensions',
    value: `${millConfig.geometry.housingWidth} × ${millConfig.geometry.housingHeight}`,
    unit: 'mm',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — §14 item 2: take from EU 15 1 A1',
  },
  {
    key: 'differentialForceReference',
    label: 'AGC differential force reference',
    value: millConfig.agc.differentialForceReference,
    unit: 't',
    note: ASSUMED,
    verified: false,
    owner: 'Mill engineering — §14 item 11 / §22 item 5, audit before force-model baselining',
  },
]

export const UNVERIFIED_PARAMETER_COUNT = PLANT_PARAMETERS.filter((p) => !p.verified).length

/**
 * Open items to resolve before Phase 1 sign-off.
 *
 * Items 1-8 are the FPE manual's own §14 register — gaps and contradictions the
 * OEM document could not resolve about itself. Items 9-11 are integration
 * questions for the twin. None of them is a defect in this codebase; they are
 * the reasons specific numbers here carry an UNVERIFIED badge.
 */
export const OPEN_ITEMS = [
  {
    id: 1,
    item: 'Centre-line spacings POR — pinch roll — ETR — entry deflector — mill — delivery deflector — DTR. Dimensioned on EU 01 1 A1 but not legible in the scan; ordering is confirmed, magnitudes are not',
    owner: 'Mill engineering',
  },
  {
    id: 2,
    item: 'Pass-line elevation and mill housing window dimensions — take from EU 01 1 A1 and EU 15 1 A1',
    owner: 'Mill engineering',
  },
  {
    id: 3,
    item: 'Coil car lift height — spec line degraded in the source. Travel 3400 mm and cylinder stroke 800 mm are confirmed',
    owner: 'Mill engineering',
  },
  {
    id: 4,
    item: 'Incoming coil OD — spec line garbled in the source. Outgoing OD 1900 mm max is confirmed',
    owner: 'Mill engineering',
  },
  {
    id: 5,
    item: 'Crop shear quantity — Chapter 2 lists one shear at delivery, Chapter 5 heading says two, and the §12.5 tail-transfer sequence requires an entry-side cut. The twin models one, at delivery. Resolve against the plant',
    owner: 'Mill engineering',
  },
  {
    id: 6,
    item: 'Mae-west 3 mm offset direction — the manual states the offset between back-up and work roll centres and how it is produced, but not its sign relative to the first-pass direction',
    owner: 'Mill engineering',
  },
  {
    id: 7,
    item: 'Roll force cylinder effective area — Chapter 1 gives Ø420 × 45 stroke, Table I gives Ø420 × Ø380 × 45. Confirm the area used in the force calculation',
    owner: 'Mill engineering',
  },
  {
    id: 8,
    item: 'Mill modulus M, and armature currents for the main and reel drives — not stated anywhere in the FPE manual',
    owner: 'Mill engineering',
  },
  {
    id: 9,
    item: 'Actual force / speed / tension limits per grade family for alarm thresholds',
    owner: 'Process',
  },
  {
    id: 10,
    item: 'Which additional PLC tags OEM can expose at higher sampling (priority: roll separating force, LVDT OS/DS, WR bending, WR RPM). No AGC or MMS mechanical drawing exists in the register — the sensors are the deflector-roll encoders, the roll force cylinder linear detectors and the entry/exit isotope gauges',
    owner: 'OEM + automation',
  },
  {
    id: 11,
    item: 'Whether the twin runs on live edge feed, historian replay, or both in v1',
    owner: 'Digital',
  },
  {
    id: 12,
    item: 'AGC differential force reference audit (standing -9 t issue, with the Mill 4 back-up roll barrel taper DS > OS) before any force-model baselining',
    owner: 'Mill engineering',
  },
] as const
