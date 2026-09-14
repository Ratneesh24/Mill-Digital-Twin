/**
 * THE ENVIRONMENT MAP, and the direct lights.
 *
 * This is the single most easily-lost piece of the whole scene. Every roll, coil and strip
 * surface is a MeshStandardMaterial at metalness 0.7-0.95, and a metal in a physically-based
 * renderer has almost NO diffuse response - it renders as what it reflects. With no environment
 * to reflect, the entire mill comes out near-black and looks broken rather than dark.
 *
 * The React app got this from drei's <Environment resolution={256} frames={1}> wrapping four
 * <Lightformer> planes. There is no drei here, so the recipe is done by hand: build a throwaway
 * scene of four emissive planes, render it ONCE through PMREMGenerator into a cube map, keep the
 * texture, and throw the scene away. "Once" is the point - it is a startup cost, not a per-frame
 * one.
 *
 * Deliberately no HDRI file. An isolated plant network should not need to fetch a 2 MB
 * environment texture for the twin to light itself.
 */
import * as THREE from 'three';

/**
 * Render the four-plane light rig into a cube map.
 *
 * @returns {{texture: THREE.Texture, dispose: () => void}}
 */
export function buildEnvironment(renderer, LINE) {
  const lightScene = new THREE.Scene();
  const temporary = [];

  const addPanel = (color, intensity, position, rotation, size) => {
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.DoubleSide,
    });

    // A Lightformer is an emissive plane; multiplying the colour past 1 is how its intensity is
    // expressed to a basic material feeding a PMREM pass.
    material.color.multiplyScalar(intensity);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    lightScene.add(mesh);
    temporary.push(geometry, material);
  };

  // Sized and placed from the line extent, so a longer line gets a proportionally larger rig
  // rather than a hard-coded box that would clip at one end.
  const centreX = (LINE.maxX + LINE.minX) / 2;
  const halfSpan = (LINE.maxX - LINE.minX) / 2 + 2;

  // Overhead: the dominant source, standing in for a plant roof line.
  addPanel('#f2f7fc', 2.40, [centreX, 8, 0], [Math.PI / 2, 0, 0], [halfSpan * 2, 12]);
  // Key from one side, cool, so the rolls pick up a readable highlight along the barrel.
  addPanel('#c4e0f5', 1.10, [centreX - halfSpan - 1, 2.5, 3], [0, Math.PI / 2, 0], [11, 7]);
  // Fill from the other, weaker, to keep the far side from going solid black.
  addPanel('#dce5ee', 0.85, [centreX + halfSpan + 1, 2, -4], [0, -Math.PI / 2, 0], [11, 7]);
  // Bounce off the floor, weakest, so undersides are not voids.
  addPanel('#d4e0eb', 0.35, [centreX, -5, 0], [-Math.PI / 2, 0, 0], [halfSpan * 2, 12]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(lightScene, 0.04);
  pmrem.dispose();

  for (const item of temporary) item.dispose();
  lightScene.clear();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/**
 * The direct lights, on top of the environment.
 *
 * The environment gives the metals something to reflect; these give the scene its shadows and its
 * sense of a single overhead source. The shadow camera is sized FROM THE LINE EXTENT and centred
 * on the line - not on the origin. Sizing it from the origin is a real and easy mistake: the line
 * runs from about -8.6 m to +4.2 m, so an origin-centred frustum would drop shadows off the
 * pay-off end entirely.
 */
export function addLights(scene, LINE, SCENE) {
  const centreX = (LINE.maxX + LINE.minX) / 2;
  const halfSpan = (LINE.maxX - LINE.minX) / 2 + 2;

  const hemisphere = new THREE.HemisphereLight('#dfeaf3', '#8f9aa4', 0.55);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(centreX + 4, 9, 7);
  key.castShadow = true;
  // 1024, not 2048: a 13 m-wide frustum at 1024 still resolves ~13 mm texels, and the
  // smaller depth target halves the GPU memory that most often costs a context on a
  // modest control-room GPU.
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -halfSpan;
  key.shadow.camera.right = halfSpan;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0008;
  key.target.position.set(centreX, 0, 0);
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight('#cfe0ef', 0.45);
  fill.position.set(centreX - 6, 4, -8);
  scene.add(fill);

  // Straight up the barrel axis, so the roll bite is not a black slot from the stand camera -
  // which is the one view an engineer actually walks round to get.
  const bite = new THREE.DirectionalLight('#ffffff', 0.35);
  bite.position.set(0, 1.2, SCENE.cameraSideZ * 6);
  scene.add(bite);

  return [hemisphere, key, key.target, fill, bite];
}
