/**
 * SCENE MATERIALS - port of the palette half of src/components/digitalTwin/twinMaterials.ts.
 *
 * Blue-painted housings, contrasting steel rolls, a light industrial floor. All scene colours are
 * declared here so no mesh introduces its own, and alarm colours stay independent of the
 * equipment palette.
 *
 * A NOTE ON METALNESS, because it is the thing that goes wrong. A material at metalness 1 has no
 * diffuse response at all - it renders purely as what it reflects. Without an environment map
 * that makes a "polished steel" roll come out almost black, which is the classic way a PBR mill
 * scene ends up an unreadable slab. The values below keep enough diffuse term for the geometry to
 * read, and environment.js supplies the specular that makes it look like ground steel rather than
 * plastic. If the scene ever renders dark, the environment map is missing - not these numbers.
 */
import * as THREE from 'three';

const SPEC = {
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

  maeWest: { color: '#4d6d88', metalness: 0.5, roughness: 0.55 },
  pinchRoll: { color: '#b9c5cf', metalness: 0.7, roughness: 0.34 },
  levellerRoll: { color: '#aab7c2', metalness: 0.7, roughness: 0.38 },
  deflectorRoll: { color: '#9fb0bc', metalness: 0.68, roughness: 0.4 },
  shearBlade: { color: '#dfe7ec', metalness: 0.9, roughness: 0.14 },
  shearFrame: { color: '#3f6f95', metalness: 0.35, roughness: 0.58 },
  saddle: { color: '#7d8b96', metalness: 0.4, roughness: 0.68 },
  snubberRubber: { color: '#3a3f44', metalness: 0.05, roughness: 0.85 },
  airKnife: { color: '#5e8ba8', metalness: 0.5, roughness: 0.5 },
  duct: { color: '#93a3ad', metalness: 0.45, roughness: 0.62 },
  drive: { color: '#546b7d', metalness: 0.45, roughness: 0.58 },
};

/** Status colours reused in the scene, matching the workspace language. */
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

/**
 * Build the materials once and share them.
 *
 * Sharing matters: ~95 meshes drawn from ~30 materials means the renderer sorts by a handful of
 * shader programs instead of recompiling per mesh. It also makes disposal tractable - there are
 * thirty things to dispose, not ninety-five.
 */
export function createMaterials() {
  const materials = {};
  for (const [name, spec] of Object.entries(SPEC)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.color),
      metalness: spec.metalness,
      roughness: spec.roughness,
    });
  }
  return materials;
}

export function disposeMaterials(materials) {
  for (const m of Object.values(materials)) m.dispose();
}
