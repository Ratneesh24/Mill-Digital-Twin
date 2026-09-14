/**
 * SCENE MATERIALS & GEOMETRY CONSTANTS — §10.5.
 *
 * Blue-painted housings, contrasting steel rolls and a light industrial floor.
 * PBR reflections are generated locally; alarm colours remain independent of
 * the equipment palette. No external textures or decorative animation.
 *
 * All scene colours are declared here so no mesh introduces its own. Geometry
 * positions are DERIVED from millConfig — there is not a single hand-placed
 * dimension in the scene.
 */
import { millConfig } from '../../config/millConfig';
import { mmToScene } from '../../config/unitConversion';
/*
 * A note on metalness. A material at `metalness: 1` has NO diffuse response —
 * it renders purely as what it reflects. In a dark industrial environment that
 * makes a "polished steel" roll come out almost black, which is the classic way
 * a PBR mill scene ends up as an unreadable slab. The values below keep enough
 * diffuse term for the geometry to read, while the environment map supplies the
 * specular that makes it look like ground steel rather than plastic.
 */
export const MATERIALS = {
    backupRoll: { color: '#8b9daa', metalness: 0.7, roughness: 0.5 },
    backupRollChock: { color: '#64839b', metalness: 0.6, roughness: 0.62 },
    workRoll: { color: '#cbd6de', metalness: 0.72, roughness: 0.26 },
    workRollChock: { color: '#66727d', metalness: 0.65, roughness: 0.5 },
    rollMarker: { color: '#e0a32e', metalness: 0.4, roughness: 0.6 },
    strip: { color: '#cdd8e0', metalness: 0.78, roughness: 0.24 },
    coil: { color: '#98a6b1', metalness: 0.72, roughness: 0.42 },
    coilEdge: { color: '#7b8994', metalness: 0.7, roughness: 0.55 },
    mandrel: { color: '#4e5860', metalness: 0.7, roughness: 0.45 },
    housing: { color: '#1670b6', metalness: 0.3, roughness: 0.48 },
    housingTrim: { color: '#14538a', metalness: 0.35, roughness: 0.55 },
    hydraulic: { color: '#6696b6', metalness: 0.6, roughness: 0.48 },
    hydraulicRod: { color: '#9aa7b1', metalness: 0.95, roughness: 0.18 },
    bendingActuator: { color: '#8a9eac', metalness: 0.7, roughness: 0.5 },
    gaugeFrame: { color: '#4688b5', metalness: 0.4, roughness: 0.6 },
    gaugeHead: { color: '#8196a6', metalness: 0.5, roughness: 0.6 },
    floor: { color: '#e3ebf2', metalness: 0.05, roughness: 0.92 },
    // Line equipment — §5 of the manual. Painted plant blue like the stand, with
    // the working rolls kept in the same steel family as the mill rolls so the
    // line reads as one machine.
    /** Mae-west block — §6.3, cast housing insert, darker than the housing paint. */
    maeWest: { color: '#4d6d88', metalness: 0.5, roughness: 0.55 },
    /** Pinch rolls, Ø250 hardened steel — §5.4. */
    pinchRoll: { color: '#b9c5cf', metalness: 0.7, roughness: 0.34 },
    /** Leveller rolls, Ø200 hardened steel — §5.4. */
    levellerRoll: { color: '#aab7c2', metalness: 0.7, roughness: 0.38 },
    /** Deflector roll, Ø300 alloy steel — §5.6. */
    deflectorRoll: { color: '#9fb0bc', metalness: 0.68, roughness: 0.4 },
    /** Crop shear blade — §5.7, ground edges. */
    shearBlade: { color: '#dfe7ec', metalness: 0.9, roughness: 0.14 },
    shearFrame: { color: '#3f6f95', metalness: 0.35, roughness: 0.58 },
    /** Coil car carriage and Vee-platten elevator — §5.1. */
    coilCar: { color: '#2f7fb8', metalness: 0.35, roughness: 0.55 },
    /** Nylon facing on the Vee plattens — §5.1, "hard nylon facings". */
    nylonFacing: { color: '#d9d2bc', metalness: 0.05, roughness: 0.75 },
    /** Coil storage saddle — §5.1, welded steel. */
    saddle: { color: '#7d8b96', metalness: 0.4, roughness: 0.68 },
    /** Neoprene covering on the snubber roll — §5.2. */
    snubberRubber: { color: '#3a3f44', metalness: 0.05, roughness: 0.85 },
    /** Air knife wiper header — §5.9. */
    airKnife: { color: '#5e8ba8', metalness: 0.5, roughness: 0.5 },
    /** Hardwood pressure board — §6.8. */
    hardwood: { color: '#a8875c', metalness: 0.02, roughness: 0.86 },
    /** Mill enclosure and hood — §6.10. Transparent so it never hides the bite. */
    enclosure: { color: '#8fb4cd', metalness: 0.2, roughness: 0.6 },
    /** Ducting to the fume stack — §9.4. */
    duct: { color: '#93a3ad', metalness: 0.45, roughness: 0.62 },
    /** Motors, gearboxes and pinion stands across the line. */
    drive: { color: '#546b7d', metalness: 0.45, roughness: 0.58 },
};
/** Status colours reused in the scene, matching the light workspace language. */
export const SCENE_COLORS = {
    normal: '#005a9c',
    healthy: '#187447',
    warning: '#976000',
    alarm: '#c13335',
    entry: '#005a9c',
    exit: '#976000',
    force: '#c13335',
    dim: '#5a6b78',
};
const g = millConfig.geometry;
const r = millConfig.ratings;
const L = millConfig.lineLayout;
/** Barrel half-length — the plane the chocks, housings and bearings work off. */
const halfBarrel = mmToScene(g.barrelLength / 2);
/**
 * Fixed scene geometry, all derived from millConfig (§10.1: "All geometry
 * dimension-driven from millConfig.ts").
 *
 * The pass line is y = 0 and the floor is `passLineHeight` below it, so the
 * stand now stands ON the floor rather than floating through it: with Ø550
 * back-ups the bottom of the lower BUR sits at about -0.765, clear of -0.9.
 */
export const SCENE = {
    wrRadius: mmToScene(g.workRollDiameter / 2),
    wrNeckRadius: mmToScene(g.workRollNeckDiameter / 2),
    burRadius: mmToScene(g.backupRollDiameter / 2),
    burNeckRadius: mmToScene(g.backupRollNeckDiameter / 2),
    barrelLength: mmToScene(g.barrelLength),
    /** Half-depth at which the housing frames sit, scene units. */
    housingZ: halfBarrel + 0.19,
    housingPostX: mmToScene(g.housingWidth / 2) * 0.58,
    // The roll stack tops out at (BUR + WR) radius above the pass line; the
    // housing adds enough headroom above that for the Ø420 roll force ram and no
    // more. An over-tall housing reads as a slab and hides the rolls.
    housingTop: mmToScene(g.backupRollDiameter + g.workRollDiameter) / 2 + 0.48,
    housingBottom: -mmToScene(g.passLineHeight),
    mandrelRadius: mmToScene(g.mandrelDiameter / 2),
    mandrelFace: mmToScene(g.tensionReelFaceWidth),
    porMandrelRadius: mmToScene(g.porMandrelExpandedDiameter / 2),
    porMandrelFace: mmToScene(g.porMandrelFaceWidth),
    chockZ: halfBarrel + 0.08,
    floorY: -mmToScene(g.passLineHeight),
    /**
     * The side of the barrel the default camera stands on. Scene labels are placed
     * on this side so they read in front of the equipment rather than through it,
     * and they follow the camera automatically if the preset is ever flipped.
     */
    cameraSideZ: millConfig.visual.cameraSideZ,
    /** Roll force cylinder — ram type, Ø420 × 45 mm stroke (§6.2, Table I item 19). */
    rollForceRamRadius: mmToScene(r.rollForceCylinderBore / 2),
    rollForceStroke: mmToScene(r.rollForceCylinderStroke),
    /**
     * The 3 mm offset between back-up and work roll centres, produced by making
     * the entry-side and delivery-side Mae-west block widths different (§6.3
     * item 3). Its SIGN relative to the first pass is not stated in the manual —
     * open item 6 — so the scene applies it symmetrically as a block-width
     * difference and claims nothing about direction.
     */
    maeWestOffset: mmToScene(3),
};
/**
 * LINE LAYOUT in scene X — the §3 centre-line order.
 *
 * `entrySideSign` decides which half of the scene the entry equipment occupies;
 * everything downstream of the bite mirrors it. Nothing here is hand-placed, so
 * moving a station means editing `millConfig.lineLayout` and nothing else.
 */
const entry = L.entrySideSign;
export const LINE = {
    porX: mmToScene(L.porDistance) * entry,
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
    dtrX: -mmToScene(L.dtrDistance) * entry,
    /** Coil storage saddles sit off the pass line, behind each reel. */
    saddleZ: mmToScene(L.saddleZ),
    coilCarTravel: mmToScene(L.coilCarTravel),
    /** Extent of the line, used to size the floor and the shadow camera. */
    minX: Math.min(mmToScene(L.porDistance) * entry, -mmToScene(L.dtrDistance) * entry),
    maxX: Math.max(mmToScene(L.porDistance) * entry, -mmToScene(L.dtrDistance) * entry),
};
/**
 * Vertical centre of a work roll for a given visual gap.
 * The two work rolls straddle the pass line at y = 0, so the whole stack moves
 * symmetrically as the gap changes — which is what a 4HI stand with a top-mounted
 * capsule and a fixed bottom BUR approximates closely enough for the twin.
 */
export function workRollCentreY(visualGap, side) {
    const offset = visualGap / 2 + SCENE.wrRadius;
    return side === 'UPPER' ? offset : -offset;
}
export function backupRollCentreY(visualGap, side) {
    const offset = visualGap / 2 + SCENE.wrRadius * 2 + SCENE.burRadius;
    return side === 'UPPER' ? offset : -offset;
}
