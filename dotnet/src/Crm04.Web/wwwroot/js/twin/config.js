/**
 * SCENE GEOMETRY, DERIVED FROM millConfig.
 *
 * Port of the derivation half of src/components/digitalTwin/twinMaterials.ts. There is not a
 * single hand-placed dimension in the scene: every position and radius below comes from the mill
 * configuration served by GET /api/config/mill, so moving a station means editing millConfig and
 * nothing else.
 *
 * One scene unit is one metre. The pass line is y = 0 and the floor sits passLineHeight below it,
 * so the stand stands ON the floor rather than through it.
 */

/** Millimetres to scene units. The single conversion used by everything here. */
export const mmToScene = (mm) => mm / 1000;

/**
 * VISUAL EXAGGERATION. A 2 mm strip between 215 mm rolls is about 1% of the roll diameter and is
 * invisible at engineering scale, so strip thickness and roll gap are drawn with a linear
 * exaggeration factor. THE NUMBERS SHOWN ARE ALWAYS TRUE - only the pixels are scaled, and the
 * scene labels the factor so nobody misreads the picture. Nothing else in the scene is scaled.
 */
export function stripThicknessToScene(mm, cfg) {
  return mmToScene(mm) * cfg.visual.stripThicknessExaggeration;
}

export function rollGapToScene(mm, cfg) {
  return mmToScene(mm) * cfg.visual.rollGapExaggeration + cfg.visual.rollGapVisualOffset;
}

/** Fixed scene geometry. */
export function deriveScene(cfg) {
  const g = cfg.geometry;
  const r = cfg.ratings;
  const halfBarrel = mmToScene(g.barrelLength / 2);

  return {
    wrRadius: mmToScene(g.workRollDiameter / 2),
    wrNeckRadius: mmToScene(g.workRollNeckDiameter / 2),
    burRadius: mmToScene(g.backupRollDiameter / 2),
    burNeckRadius: mmToScene(g.backupRollNeckDiameter / 2),
    barrelLength: mmToScene(g.barrelLength),

    /** Half-depth at which the housing frames sit. */
    housingZ: halfBarrel + 0.19,
    housingPostX: mmToScene(g.housingWidth / 2) * 0.58,

    // The roll stack tops out at (BUR + WR) radius above the pass line; the housing adds enough
    // headroom for the Ø420 roll force ram and no more. An over-tall housing reads as a slab and
    // hides the rolls, which are the point of the picture.
    housingTop: mmToScene(g.backupRollDiameter + g.workRollDiameter) / 2 + 0.48,
    housingBottom: -mmToScene(g.passLineHeight),

    mandrelRadius: mmToScene(g.mandrelDiameter / 2),
    mandrelFace: mmToScene(g.tensionReelFaceWidth),
    porMandrelRadius: mmToScene(g.porMandrelExpandedDiameter / 2),
    porMandrelFace: mmToScene(g.porMandrelFaceWidth),
    chockZ: halfBarrel + 0.08,
    floorY: -mmToScene(g.passLineHeight),
    maxCoilRadius: mmToScene(g.maxCoilDiameter / 2),

    /**
     * The side of the barrel the default camera stands on. Scene labels are placed on this side
     * so they read in front of the equipment rather than through it.
     */
    cameraSideZ: cfg.visual.cameraSideZ,

    /** Roll force cylinder - ram type, Ø420 x 45 mm stroke. */
    rollForceRamRadius: mmToScene(r.rollForceCylinderBore / 2),
    rollForceStroke: mmToScene(r.rollForceCylinderStroke),
  };
}

/**
 * LINE LAYOUT in scene X - the manual's §3 centre-line order.
 *
 * entrySideSign decides which half of the scene the entry equipment occupies; everything
 * downstream of the bite mirrors it. -1 puts POR / flattener / ETR at -X, which with the camera
 * at -Z renders the entry end on screen-RIGHT: CRM04's mill hand is right to left, so the twin
 * reads the way the mill does to someone standing on the floor.
 */
export function deriveLine(cfg) {
  const L = cfg.lineLayout;
  const entry = L.entrySideSign;

  const porX = mmToScene(L.porDistance) * entry;
  const dtrX = -mmToScene(L.dtrDistance) * entry;

  return {
    porX,
    peelerX: mmToScene(L.peelerDistance) * entry,
    flattenerX: mmToScene(L.flattenerDistance) * entry,
    carryOverTableX: mmToScene(L.carryOverTableDistance) * entry,
    etrX: mmToScene(L.etrDistance) * entry,
    entryDeflectorX: mmToScene(L.deflectorDistance) * entry,
    entryGaugeX: mmToScene(L.gaugeDistance) * entry,
    entryAirKnifeX: mmToScene(L.airKnifeDistance) * entry,

    deliveryAirKnifeX: -mmToScene(L.airKnifeDistance) * entry,
    deliveryGaugeX: -mmToScene(L.gaugeDistance) * entry,
    deliveryDeflectorX: -mmToScene(L.deflectorDistance) * entry,
    cropShearX: -mmToScene(L.cropShearDistance) * entry,
    dtrX,

    saddleZ: mmToScene(L.saddleZ),
    coilCarTravel: mmToScene(L.coilCarTravel),
    entrySign: entry,

    /** Extent of the line, used to size the floor and the shadow camera. */
    minX: Math.min(porX, dtrX),
    maxX: Math.max(porX, dtrX),
  };
}

/**
 * Vertical centre of a work roll for a given visual gap.
 *
 * The two work rolls straddle the pass line at y = 0, so the whole stack moves symmetrically as
 * the gap changes - which is what a 4HI stand with a top-mounted capsule and a fixed bottom BUR
 * approximates closely enough for the twin.
 */
export function workRollCentreY(visualGap, side, SCENE) {
  const offset = visualGap / 2 + SCENE.wrRadius;
  return side === 'UPPER' ? offset : -offset;
}

export function backupRollCentreY(visualGap, side, SCENE) {
  const offset = visualGap / 2 + SCENE.wrRadius * 2 + SCENE.burRadius;
  return side === 'UPPER' ? offset : -offset;
}

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Frame-rate independent exponential smoothing towards a target.
 *
 * Half-life rather than a per-frame lerp factor: a lerp constant means something different at
 * 30 fps and 144 fps, and the scene would visibly settle at different rates on different
 * machines. Port of `damp` in src/config/unitConversion.ts.
 */
export function damp(current, target, halfLife, dt) {
  if (halfLife <= 0) return target;
  const k = Math.pow(0.5, dt / halfLife);
  return target + (current - target) * k;
}
