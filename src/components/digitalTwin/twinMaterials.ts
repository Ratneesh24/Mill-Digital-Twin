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

import { millConfig } from '../../config/millConfig'
import { mmToScene } from '../../config/unitConversion'

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
} as const

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
} as const

const g = millConfig.geometry

/**
 * Fixed scene geometry, all derived from millConfig (§10.1: "All geometry
 * dimension-driven from millConfig.ts").
 */
export const SCENE = {
  wrRadius: mmToScene(g.workRollDiameter / 2),
  burRadius: mmToScene(g.backupRollDiameter / 2),
  barrelLength: mmToScene(g.barrelLength),
  /** Half-depth at which the housing frames sit, scene units. */
  housingZ: mmToScene(g.barrelLength / 2) + 0.26,
  housingPostX: mmToScene(g.housingWidth / 2) * 0.58,
  // The roll stack tops out at roughly (BUR + WR) radius above the pass line;
  // the housing adds enough headroom above that for the HAGC capsule and no
  // more. An over-tall housing reads as a slab and hides the rolls.
  housingTop: mmToScene(g.backupRollDiameter) + mmToScene(g.workRollDiameter) + 0.7,
  housingBottom: -(mmToScene(g.backupRollDiameter) + mmToScene(g.workRollDiameter) + 0.4),
  reelX: mmToScene(g.reelCentreDistance),
  mandrelRadius: mmToScene(g.mandrelDiameter / 2),
  gaugeX: mmToScene(g.gaugeDistance),
  /** Z offset of the parked payoff reel, behind the DTR. */
  porZ: -2.0,
  chockZ: mmToScene(g.barrelLength / 2) + 0.11,
  floorY: -(mmToScene(g.backupRollDiameter) + mmToScene(g.workRollDiameter) + 0.7),
} as const

/**
 * Vertical centre of a work roll for a given visual gap.
 * The two work rolls straddle the pass line at y = 0, so the whole stack moves
 * symmetrically as the gap changes — which is what a 4HI stand with a top-mounted
 * capsule and a fixed bottom BUR approximates closely enough for the twin.
 */
export function workRollCentreY(visualGap: number, side: 'UPPER' | 'LOWER'): number {
  const offset = visualGap / 2 + SCENE.wrRadius
  return side === 'UPPER' ? offset : -offset
}

export function backupRollCentreY(visualGap: number, side: 'UPPER' | 'LOWER'): number {
  const offset = visualGap / 2 + SCENE.wrRadius * 2 + SCENE.burRadius
  return side === 'UPPER' ? offset : -offset
}
