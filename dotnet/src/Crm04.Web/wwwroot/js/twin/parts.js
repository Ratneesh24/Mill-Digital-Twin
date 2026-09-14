/**
 * THE MILL, built from primitives.
 *
 * Port of src/components/digitalTwin/*.tsx. Every part exports the same shape - a group, an
 * update(v) that runs per rendered frame, and a dispose() - which mirrors the React components
 * one for one: what was the body of a useTwinFrame callback is now the body of update().
 *
 * NOT A SINGLE HAND-PLACED DIMENSION. Every radius, length and position comes from SCENE and LINE,
 * which are derived from the mill configuration the API serves. Changing a roll diameter in
 * millConfig moves the picture and the physics together.
 *
 * No external assets and no custom shaders: the whole mill is boxes, cylinders and planes. That
 * is what makes it portable to an isolated network and what made this port tractable at all.
 */
import * as THREE from 'three';
import {
  mmToScene,
  stripThicknessToScene,
  rollGapToScene,
  workRollCentreY,
  backupRollCentreY,
  clamp,
} from './config.js';
import { SCENE_COLORS } from './materials.js';

/** Dispose every geometry and material under a subtree. Called on teardown. */
export function disposeSubtree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    // Materials are shared and owned by materials.js, so they are NOT disposed here - doing so
    // would blank every other mesh using them.
  });
}

const mesh = (geometry, material, castShadow = true) => {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
};

// =============================================================================================
// MILL STAND - housings, Mae-west blocks, roll force cylinders
// =============================================================================================

export function createMillStand(ctx) {
  const { SCENE, M } = ctx;
  const group = new THREE.Group();
  group.name = 'MILL_STAND';

  const height = SCENE.housingTop - SCENE.housingBottom;
  const midY = (SCENE.housingTop + SCENE.housingBottom) / 2;
  const postWidth = 0.26;

  // Two housings, one per side of the barrel, each a pair of posts joined top and bottom.
  for (const side of [1, -1]) {
    const z = SCENE.housingZ * side;

    for (const sx of [1, -1]) {
      const post = mesh(new THREE.BoxGeometry(postWidth, height, 0.34), M.housing);
      post.position.set(SCENE.housingPostX * sx, midY, z);
      group.add(post);
    }

    const capHeight = 0.22;
    const cap = mesh(
      new THREE.BoxGeometry(SCENE.housingPostX * 2 + postWidth, capHeight, 0.34),
      M.housingTrim,
    );
    cap.position.set(0, SCENE.housingTop - capHeight / 2, z);
    group.add(cap);

    const sill = mesh(
      new THREE.BoxGeometry(SCENE.housingPostX * 2 + postWidth, 0.3, 0.4),
      M.housingTrim,
    );
    sill.position.set(0, SCENE.housingBottom + 0.15, z);
    group.add(sill);
  }

  // Roll force cylinders: ram type, one per housing, at the top (§6.2 Table I item 19).
  for (const side of [1, -1]) {
    const body = mesh(
      new THREE.CylinderGeometry(SCENE.rollForceRamRadius, SCENE.rollForceRamRadius, 0.34, 24),
      M.hydraulic,
    );
    body.position.set(0, SCENE.housingTop - 0.38, SCENE.housingZ * side);
    group.add(body);
  }

  // Mae-west blocks - the cast inserts the chocks slide in.
  for (const sx of [1, -1]) {
    for (const side of [1, -1]) {
      const block = mesh(new THREE.BoxGeometry(0.14, 1.5, 0.3), M.maeWest);
      block.position.set(SCENE.housingPostX * sx * 0.74, 0, SCENE.chockZ * side);
      group.add(block);
    }
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

// =============================================================================================
// ROLLS
// =============================================================================================

/**
 * One roll: barrel, two necks, two chocks, and a surface marker.
 *
 * THE MARKER IS NOT DECORATION. A featureless cylinder of revolution looks completely static no
 * matter how fast it spins, so without a marker the operator has no way to see that the mill is
 * turning - or which way. The stripe is the rotation made visible.
 */
function createRoll(ctx, { radius, neckRadius, material, chockMaterial, side, isWorkRoll }) {
  const { SCENE, M } = ctx;
  const group = new THREE.Group();

  const barrel = mesh(
    new THREE.CylinderGeometry(radius, radius, SCENE.barrelLength, 40),
    material,
  );
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);

  const marker = mesh(
    new THREE.BoxGeometry(radius * 0.16, radius * 0.9, SCENE.barrelLength * 1.002),
    M.rollMarker,
  );
  marker.position.y = radius * 0.55;
  group.add(marker);

  const neckLength = 0.34;
  for (const z of [1, -1]) {
    const neck = mesh(
      new THREE.CylinderGeometry(neckRadius, neckRadius, neckLength, 20),
      material,
    );
    neck.rotation.x = Math.PI / 2;
    neck.position.z = z * (SCENE.barrelLength / 2 + neckLength / 2);
    group.add(neck);

    const chock = mesh(new THREE.BoxGeometry(0.38, 0.38, 0.22), chockMaterial);
    chock.position.z = z * (SCENE.barrelLength / 2 + neckLength + 0.09);
    group.add(chock);
  }

  // Work roll bending actuators, on the chocks. Hidden unless the feed carries a bending tag.
  const bendActuators = [];
  if (isWorkRoll) {
    for (const z of [1, -1]) {
      const actuator = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.16), M.bendingActuator);
      actuator.position.set(0, side === 'UPPER' ? 0.24 : -0.24, z * (SCENE.barrelLength / 2 + 0.44));
      actuator.visible = false;
      group.add(actuator);
      bendActuators.push(actuator);
    }
  }

  return { group, marker, bendActuators };
}

export function createWorkRoll(ctx, side) {
  const { SCENE, M, cfg } = ctx;
  const roll = createRoll(ctx, {
    radius: SCENE.wrRadius,
    neckRadius: SCENE.wrNeckRadius,
    material: M.workRoll,
    chockMaterial: M.workRollChock,
    side,
    isWorkRoll: true,
  });

  roll.group.name = `WORK_ROLL_${side}`;

  return {
    group: roll.group,
    update(v) {
      const gap = rollGapToScene(v.rollGap, cfg);
      roll.group.position.y = workRollCentreY(gap, side, SCENE);
      roll.group.rotation.z = v.wrAngle * (side === 'UPPER' ? 1 : -1);

      // §7.4: bending is NULL on the real feed, and the twin must not animate a deflection it
      // cannot see. The actuators simply do not appear rather than sitting at zero, which would
      // imply a measured zero bend. When present, bending is an inert tint — never a scale or
      // position change, which would imply a measured deflection the feed withholds.
      const bend = v.bendingNormalised;
      const show = bend !== null && bend !== undefined;
      for (const actuator of roll.bendActuators) actuator.visible = show;
      M.bendingActuator.emissive.setScalar(show ? 0.02 + Math.min(bend, 1) * 0.1 : 0);
    },
    dispose: () => disposeSubtree(roll.group),
  };
}

export function createBackupRoll(ctx, side) {
  const { SCENE, M, cfg } = ctx;
  const roll = createRoll(ctx, {
    radius: SCENE.burRadius,
    neckRadius: SCENE.burNeckRadius,
    material: M.backupRoll,
    chockMaterial: M.backupRollChock,
    side,
    isWorkRoll: false,
  });

  roll.group.name = `BACKUP_ROLL_${side}`;

  return {
    group: roll.group,
    update(v) {
      const gap = rollGapToScene(v.rollGap, cfg);
      roll.group.position.y = backupRollCentreY(gap, side, SCENE);
      roll.group.rotation.z = v.burAngle * (side === 'UPPER' ? 1 : -1);
    },
    dispose: () => disposeSubtree(roll.group),
  };
}

// =============================================================================================
// STRIP
// =============================================================================================

/**
 * The strip, in two halves.
 *
 * ENTRY AND EXIT ARE SEPARATE MESHES AT DIFFERENT THICKNESSES AND SPEEDS, and that is the whole
 * point. Mass flow means the entry side runs slower than the exit side by exactly the reduction
 * ratio; drawing one continuous strip at one speed would put a visible contradiction of §8.1 in
 * the middle of the screen. The surface markers scroll at each side's own rate.
 */
export function createStrip(ctx) {
  const { SCENE, M, LINE, cfg } = ctx;
  const group = new THREE.Group();
  group.name = 'STRIP';

  const halfLength = Math.max(Math.abs(LINE.minX), Math.abs(LINE.maxX));

  const makeSide = (sign) => {
    // Pivot at the bite (x=0): children keep mill-centred coordinates, and a small rotation.z
    // droops the reel end while the bite end stays on the pass line, exactly like the reference.
    const pivot = new THREE.Group();
    group.add(pivot);

    const geometry = new THREE.BoxGeometry(halfLength, 1, 1);
    const m = mesh(geometry, M.strip, false);
    m.position.x = (sign * halfLength) / 2;
    pivot.add(m);

    // Surface markers: without them a smooth strip at constant thickness shows no motion at all.
    const markers = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const marker = mesh(new THREE.BoxGeometry(0.05, 1, 1), M.rollMarker, false);
      marker.material = M.rollMarker;
      markers.push(marker);
      pivot.add(marker);
    }

    return { pivot, plate: m, markers, sign, halfLength, spacing: halfLength / count };
  };

  // entrySign is the side the entry equipment sits on, so the entry strip lives there.
  const entry = makeSide(LINE.entrySign);
  const exit = makeSide(-LINE.entrySign);

  const applySide = (sideObj, thicknessMm, scrollQ, tensionNorm, widthScene, visible) => {
    const t = Math.max(stripThicknessToScene(thicknessMm, cfg), 0.004);
    sideObj.plate.scale.set(1, t, widthScene);
    sideObj.plate.visible = visible;

    // Tautness: a fully tensioned span is straight, a slack one droops at the reel end. The bite
    // end stays on the pass line because the rolls hold it (§10.3).
    const sag = 0.07 * (1 - Math.min(Math.max(tensionNorm ?? 1, 0), 1));
    sideObj.pivot.rotation.z =
      sideObj.sign === -1 ? -Math.atan2(sag, sideObj.halfLength) : Math.atan2(sag, sideObj.halfLength);

    for (let i = 0; i < sideObj.markers.length; i++) {
      const marker = sideObj.markers[i];
      marker.visible = visible;
      if (!visible) continue;

      // Markers scroll along the strip and wrap. scrollQ is already signed for THIS side:
      // decreasing on the entry side (markers run toward the bite) and increasing on the
      // exit side (markers run away toward the winder), each at its own mass-flow speed
      // (§8.1 — entry runs slower by the reduction ratio, like the reference texture).
      const offset = ((i * sideObj.spacing + scrollQ) % sideObj.halfLength + sideObj.halfLength)
        % sideObj.halfLength;
      marker.position.set(sideObj.sign * offset, 0, 0);
      marker.scale.set(1, t * 1.05, widthScene * 0.96);
    }
  };

  return {
    group,
    update(v) {
      const width = mmToScene(v.stripWidth);

      // The strip is only threaded through the mill when there is a coil on the line. Width is
      // the honest proxy: no coil, no width, nothing to draw.
      const threaded = v.stripWidth > 1;

      // Which half of the line is the entry span is decided every frame from the rolling
      // direction — never hardcoded (§1). directionSign is damped, so the scroll eases
      // through zero at a reversal instead of teleporting.
      const fwd = v.direction !== 'REVERSE';
      const s = v.directionSign;
      const entryObj = fwd ? entry : exit;
      const exitObj = fwd ? exit : entry;
      applySide(entryObj, v.entryThickness, -s * v.stripTravelEntry, v.entryTensionNormalised, width, threaded);
      applySide(exitObj, v.stripThickness, s * v.stripTravel, v.exitTensionNormalised, width, threaded);
    },
    dispose: () => disposeSubtree(group),
  };
}

// =============================================================================================
// TENSION SYSTEM
// =============================================================================================

/**
 * Strip tension, drawn as two floating markers over the entry and exit spans (§10.3).
 *
 * Size and opacity follow the normalised tension on each span; the markers only exist while
 * the mill is genuinely moving with meaningful tension, so a threaded-but-idle mill shows a
 * taut strip and no decoration. Sides follow the rolling direction like everything else (§1).
 */
export function createTensionSystem(ctx) {
  const { LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'TENSION';

  const mk = (colorHex) => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      metalness: 0.2,
      roughness: 0.5,
      transparent: true,
    });
    const m = mesh(new THREE.OctahedronGeometry(0.09), mat, false);
    group.add(m);
    return m;
  };

  const entryMark = mk(SCENE_COLORS.entry);
  const exitMark = mk(SCENE_COLORS.exit);

  const place = (mark, sideSign, tension, animate) => {
    const t = clamp(tension ?? 0, 0, 1);
    mark.visible = animate && t > 0.02;
    if (!mark.visible) return;
    mark.position.set(sideSign * 2.2, 0.62, 0);
    const k = 0.5 + t;
    mark.scale.set(k, k, k);
    mark.material.opacity = 0.35 + 0.5 * t;
  };

  return {
    group,
    update(v) {
      const fwd = v.direction !== 'REVERSE';
      const entrySide = fwd ? LINE.entrySign : -LINE.entrySign;
      place(entryMark, entrySide, v.entryTensionNormalised, v.animate);
      place(exitMark, -entrySide, v.exitTensionNormalised, v.animate);
    },
    dispose: () => disposeSubtree(group),
  };
}

// =============================================================================================
// REELS
// =============================================================================================

/**
 * A reel: mandrel, the coil wound on it, and a drive box.
 *
 * The coil RADIUS is driven from the feed, so the payoff coil visibly shrinks and the winding
 * coil visibly grows across a pass. That single behaviour is what makes the scene read as a
 * reversing mill rather than a diagram.
 */
export function createReel(ctx, { x, mandrelRadius, faceWidth, name }) {
  const { M, SCENE } = ctx;
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;

  const mandrel = mesh(
    new THREE.CylinderGeometry(mandrelRadius, mandrelRadius, faceWidth, 28),
    M.mandrel,
  );
  mandrel.rotation.x = Math.PI / 2;

  // Unit radius, scaled per frame. Rebuilding the geometry every frame to change a radius would
  // allocate and upload a new buffer 60 times a second for no visual gain.
  const coil = mesh(new THREE.CylinderGeometry(1, 1, faceWidth * 0.94, 36), M.coil);
  coil.rotation.x = Math.PI / 2;

  // A radial stripe so the coil's rotation is visible, exactly as on the rolls.
  const marker = mesh(new THREE.BoxGeometry(0.06, 1, faceWidth * 0.95), M.rollMarker);

  // Spin about the barrel axis via a NESTED group: the tilt lives on the meshes, the spin on
  // the parent, so they compose instead of tumbling. Setting rotation.x at build and
  // rotation.z per frame on the SAME object is Euler (PI/2, 0, angle) = Rx*Rz, which swings
  // the barrel axis around instead of spinning the coil.
  const spin = new THREE.Group();
  spin.add(mandrel, coil, marker);
  group.add(spin);

  const drive = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.6), M.drive);
  drive.position.set(0, SCENE.floorY + 0.25, -(faceWidth / 2 + 0.4));
  group.add(drive);

  const spindle = mesh(
    new THREE.CylinderGeometry(mandrelRadius * 0.35, mandrelRadius * 0.35, 0.6, 16),
    M.mandrel,
  );
  spindle.rotation.x = Math.PI / 2;
  spindle.position.z = -(faceWidth / 2 + 0.3);
  group.add(spindle);

  return {
    group,
    /**
     * @param radiusMm outside coil radius in mm
     * @param angle    integrated rotation, radians
     */
    updateReel(radiusMm, angle) {
      const radius = Math.max(mmToScene(radiusMm), mandrelRadius * 1.01);
      coil.scale.set(radius, 1, radius);
      spin.rotation.z = angle;

      marker.position.y = radius * 0.55;
      marker.scale.set(1, radius * 0.85, 1);

      // A coil at mandrel diameter is an empty reel. Showing a wrap of steel that is not there
      // would be a fabricated reading, so it is simply not drawn.
      const hasCoil = radius > mandrelRadius * 1.05;
      coil.visible = hasCoil;
      marker.visible = hasCoil;
    },
    dispose: () => disposeSubtree(group),
  };
}

// =============================================================================================
// GAUGES, DEFLECTORS, AIR KNIVES
// =============================================================================================

/** X-ray thickness gauge: a C-frame with a head above and below the pass line (§5.8). */
export function createGauge(ctx, x, name) {
  const { M, SCENE } = ctx;
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;

  const column = mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), M.gaugeFrame);
  column.position.set(0, 0.2, SCENE.housingZ + 0.5);
  group.add(column);

  for (const y of [0.34, -0.34]) {
    const head = mesh(new THREE.BoxGeometry(0.26, 0.16, 0.5), M.gaugeHead);
    head.position.set(0, y, SCENE.housingZ * 0.2);
    group.add(head);

    const arm = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), M.gaugeFrame);
    arm.position.set(0, y, SCENE.housingZ * 0.35);
    group.add(arm);
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/** Deflector roll and threading table (§5.6). */
export function createDeflector(ctx, x, name) {
  const { M, SCENE, cfg } = ctx;
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;

  const radius = mmToScene(300 / 2);
  const spin = new THREE.Group();
  spin.position.y = -radius - 0.06;
  group.add(spin);

  const roll = mesh(
    new THREE.CylinderGeometry(radius, radius, SCENE.barrelLength * 0.9, 24),
    M.deflectorRoll,
  );
  roll.rotation.x = Math.PI / 2;
  spin.add(roll);

  const marker = mesh(
    new THREE.BoxGeometry(radius * 0.2, radius * 0.9, SCENE.barrelLength * 0.902),
    M.rollMarker,
  );
  marker.position.y = radius * 0.5;
  spin.add(marker);

  for (const z of [1, -1]) {
    const bearing = mesh(new THREE.BoxGeometry(0.22, 0.22, 0.14), M.shearFrame);
    bearing.position.set(0, spin.position.y, z * (SCENE.barrelLength * 0.45 + 0.09));
    group.add(bearing);
  }

  return {
    group,
    update(v) {
      // The deflector is an idler: it turns because the strip drags it, so its angle follows the
      // strip rather than a drive. The ENTRY idler runs on the entry span — slower by the
      // reduction ratio (§8.1) — and both turn WITH the strip (+travel/R, travel already signed).
      const travel = name === 'DEFLECTOR_ENTRY' ? v.stripTravelEntry : v.stripTravel;
      spin.rotation.z = travel / radius;
    },
    dispose: () => disposeSubtree(group),
  };
}

/** Air knife wiper header (§5.9), immediately outboard of the bite. */
export function createAirKnife(ctx, x, name) {
  const { M, SCENE } = ctx;
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;

  for (const y of [0.16, -0.16]) {
    const header = mesh(new THREE.BoxGeometry(0.1, 0.08, SCENE.barrelLength * 0.85), M.airKnife);
    header.position.y = y;
    group.add(header);
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

// =============================================================================================
// FORCE VISUALISATION
// =============================================================================================

/**
 * Roll separating force, drawn as arrows pushing the housings apart.
 *
 * Scaled and coloured from forceNormalised, which is force over the mill's rated maximum - so an
 * arrow near full length genuinely means the stand is near its rating, and the colour crosses to
 * amber and red at the same thresholds the alarm engine uses.
 */
export function createForceArrows(ctx) {
  const { M, SCENE, cfg } = ctx;
  const group = new THREE.Group();
  group.name = 'FORCE';

  const shafts = [];
  const heads = [];

  for (const side of [1, -1]) {
    const shaft = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 12), M.hydraulicRod);
    const head = mesh(new THREE.ConeGeometry(0.11, 0.22, 14), M.hydraulicRod);

    // Cloned so each arrow can carry its own colour without tinting every shared material.
    shaft.material = M.hydraulicRod.clone();
    head.material = shaft.material;

    shaft.position.z = SCENE.housingZ * 0.55;
    head.position.z = SCENE.housingZ * 0.55;
    shaft.userData.side = side;
    head.userData.side = side;

    group.add(shaft, head);
    shafts.push(shaft);
    heads.push(head);
  }

  const colour = new THREE.Color();

  return {
    group,
    update(v) {
      const f = clamp(v.forceNormalised ?? 0, 0, 1);
      const visible = f > 0.005;

      // Anchored just outside the work roll surface at the bite, so the arrows ride the gap as
      // it moves; length scaled to the Ø215 work roll so near-rating reads near-full-length.
      const gap = rollGapToScene(v.rollGap, cfg);
      const base = Math.abs(workRollCentreY(gap, 'UPPER', SCENE)) + SCENE.wrRadius * 0.15;
      const length = SCENE.wrRadius * (0.7 + f * 4.0);
      const shaftW = 0.4 + f * 0.9;
      const headW = 0.5 + f * 0.9;

      // Same thresholds as the alarm engine: 80% warning, 92% alarm. Normal load is brand blue;
      // red is reserved for a genuinely alarming force.
      const estimated = !!v.forceEstimated;
      colour.set(f >= 0.92 ? SCENE_COLORS.alarm : f >= 0.8 ? SCENE_COLORS.warning : SCENE_COLORS.normal);

      for (let i = 0; i < shafts.length; i++) {
        const side = shafts[i].userData.side;

        shafts[i].visible = visible;
        heads[i].visible = visible;
        if (!visible) continue;

        shafts[i].scale.set(shaftW, length, shaftW);
        shafts[i].position.y = base + side * length / 2;
        heads[i].scale.set(headW, headW, headW);
        heads[i].position.y = base + side * (length + 0.11 * headW);
        heads[i].rotation.z = side > 0 ? 0 : Math.PI;

        shafts[i].material.color.copy(colour);
        shafts[i].material.emissive.copy(colour).multiplyScalar(0.25);
        // An estimated force is drawn hollow: an estimate must never wear a measurement's body.
        shafts[i].material.wireframe = estimated;
        shafts[i].material.transparent = estimated;
        shafts[i].material.opacity = estimated ? 0.42 : 1;
      }
    },
    dispose() {
      for (const s of shafts) s.material.dispose();
      disposeSubtree(group);
    },
  };
}

// =============================================================================================
// FLOOR
// =============================================================================================

/**
 * CROP SHEAR — delivery-side down-cut shear, drawn OPEN with the top knife raised. A shear is
 * never drawn closed unless something is actually cutting. Static: no position feedback on
 * this feed. Port of CropShear.tsx (EU 28 4 A1).
 */
export function createCropShear(ctx) {
  const { M, SCENE, LINE, cfg } = ctx;
  const group = new THREE.Group();
  group.name = 'CROP_SHEAR';
  group.position.x = LINE.cropShearX;

  const FRAME_WIDTH = mmToScene(760);
  const BLADE_LENGTH = mmToScene(700);
  const FRAME_HEIGHT = mmToScene(1200);
  void cfg; void SCENE;

  for (const z of [1, -1]) {
    const upright = mesh(new THREE.BoxGeometry(0.22, FRAME_HEIGHT, 0.2), M.shearFrame);
    upright.position.set(0, FRAME_HEIGHT / 2 - mmToScene(300), z * (FRAME_WIDTH / 2));
    group.add(upright);
  }

  const beam = mesh(new THREE.BoxGeometry(0.24, 0.22, FRAME_WIDTH + 0.2), M.shearFrame);
  beam.position.set(0, FRAME_HEIGHT - mmToScene(300), 0);
  group.add(beam);

  const cylinder = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 16), M.hydraulic);
  cylinder.position.set(0, FRAME_HEIGHT - mmToScene(520), 0);
  group.add(cylinder);

  // Upper carrier with the top blade, raised, blade at a rake angle.
  const carrier = new THREE.Group();
  carrier.position.set(0, mmToScene(340), 0);
  const carrierBeam = mesh(new THREE.BoxGeometry(0.2, 0.16, BLADE_LENGTH + 0.1), M.shearFrame);
  carrier.add(carrierBeam);
  const topBlade = mesh(new THREE.BoxGeometry(0.05, 0.05, BLADE_LENGTH), M.shearBlade);
  topBlade.position.set(0, -0.1, 0);
  topBlade.rotation.x = 0.05;
  carrier.add(topBlade);
  group.add(carrier);

  const bottomBlade = mesh(new THREE.BoxGeometry(0.05, 0.05, BLADE_LENGTH), M.shearBlade);
  bottomBlade.position.set(0, -0.05, 0);
  group.add(bottomBlade);
  const holder = mesh(new THREE.BoxGeometry(0.24, 0.18, BLADE_LENGTH + 0.1), M.shearFrame);
  holder.position.set(0, -0.16, 0);
  group.add(holder);

  for (const z of [1, -1]) {
    const leg = mesh(new THREE.BoxGeometry(0.26, Math.abs(SCENE.floorY) - mmToScene(300), 0.24), M.shearFrame);
    leg.position.set(0, SCENE.floorY / 2 - mmToScene(150), z * (FRAME_WIDTH / 2));
    group.add(leg);
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/**
 * COIL CARS AND STORAGE SADDLES at POR, ETR and DTR. Drawn RETRACTED with elevators down —
 * the machine's rule is that cars are retracted during rolling, so anything else would show a
 * condition that cannot coexist with a running mill. Port of CoilHandling.tsx.
 */
export function createCoilHandling(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'COIL_HANDLING';

  const CAR_WIDTH = mmToScene(900);
  const CAR_LENGTH = mmToScene(1100);
  const SADDLE_WIDTH = mmToScene(1400);
  const pitDepth = mmToScene(700);
  const carY = SCENE.floorY - mmToScene(180);

  for (const stationX of [LINE.porX, LINE.etrX, LINE.dtrX]) {
    const station = new THREE.Group();
    station.position.x = stationX;
    group.add(station);

    const car = new THREE.Group();
    car.position.z = LINE.saddleZ * 0.42;
    station.add(car);

    const pit = mesh(new THREE.BoxGeometry(CAR_LENGTH + 0.4, pitDepth, LINE.coilCarTravel), M.floor);
    pit.position.set(0, SCENE.floorY - pitDepth / 2, 0);
    car.add(pit);

    const carriage = mesh(new THREE.BoxGeometry(CAR_LENGTH, mmToScene(300), CAR_WIDTH), M.saddle);
    carriage.position.set(0, carY, 0);
    car.add(carriage);

    for (const z of [1, -1]) {
      const track = mesh(new THREE.BoxGeometry(0.06, 0.06, LINE.coilCarTravel), M.workRollChock);
      track.position.set(0, carY - mmToScene(170), z * CAR_WIDTH * 0.42);
      car.add(track);

      const vee = mesh(new THREE.BoxGeometry(CAR_LENGTH * 0.8, 0.04, mmToScene(360)), M.coilEdge);
      vee.position.set(0, carY + mmToScene(200), z * mmToScene(220));
      vee.rotation.x = z * 0.6;
      car.add(vee);
    }

    const elevatorCyl = mesh(new THREE.CylinderGeometry(0.08, 0.08, mmToScene(240), 14), M.hydraulicRod);
    elevatorCyl.position.set(0, carY + mmToScene(90), 0);
    car.add(elevatorCyl);

    const saddle = new THREE.Group();
    saddle.position.z = LINE.saddleZ;
    station.add(saddle);

    const saddleBase = mesh(new THREE.BoxGeometry(SADDLE_WIDTH, mmToScene(400), mmToScene(900)), M.saddle);
    saddleBase.position.set(0, SCENE.floorY + mmToScene(200), 0);
    saddle.add(saddleBase);

    for (const x of [1, -1]) {
      for (const z of [1, -1]) {
        const plat = mesh(new THREE.BoxGeometry(mmToScene(520), 0.04, mmToScene(420)), M.coilEdge);
        plat.position.set(x * SADDLE_WIDTH * 0.26, SCENE.floorY + mmToScene(490), z * mmToScene(210));
        plat.rotation.x = z * 0.7;
        saddle.add(plat);
      }
    }
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/**
 * PEELER UNIT / COIL OPENER on the flattener frame, drawn RETRACTED — its position during
 * rolling. No position feedback on this feed, so nothing animates. Port of PeelerUnit.tsx.
 */
export function createPeeler(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'PEELER';
  group.position.set(LINE.peelerX, SCENE.floorY * 0.35, 0);

  const TABLE_WIDTH = mmToScene(700);
  const TABLE_LENGTH = mmToScene(900);

  const table = new THREE.Group();
  table.rotation.z = -0.35;
  group.add(table);

  const plate = mesh(new THREE.BoxGeometry(TABLE_LENGTH, 0.05, TABLE_WIDTH), M.saddle);
  table.add(plate);

  const knife = mesh(new THREE.BoxGeometry(0.09, 0.022, TABLE_WIDTH * 0.94), M.shearBlade);
  knife.position.set(TABLE_LENGTH / 2 + 0.04, 0.008, 0);
  table.add(knife);

  for (const z of [1, -1]) {
    const cyl = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 12), M.hydraulic);
    cyl.position.set(-TABLE_LENGTH * 0.3, -0.22, z * TABLE_WIDTH * 0.36);
    cyl.rotation.z = 0.5;
    group.add(cyl);
  }

  const bracket = mesh(new THREE.BoxGeometry(0.16, 0.5, TABLE_WIDTH * 0.8), M.housing);
  bracket.position.set(-TABLE_LENGTH * 0.55, -0.12, 0);
  group.add(bracket);

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/**
 * PINCH ROLL CUM FLATTENER — parked state: top rolls raised, coupler disengaged, as during
 * normal rolling. Static: no flattener tag exists on the feed. Port of PinchRollFlattener.tsx.
 */
export function createFlattener(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'FLATTENER';
  group.position.x = LINE.flattenerX;

  const PINCH_R = mmToScene(250 / 2);
  const LEV_R = mmToScene(200 / 2);
  const BARREL = mmToScene(600);
  const housingHeight = Math.abs(SCENE.floorY) + PINCH_R * 3;
  const housingDepth = BARREL + 0.5;

  const roll = (x, y, radius, material, necks = true) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.rotation.x = Math.PI / 2;
    const body = mesh(new THREE.CylinderGeometry(radius, radius, BARREL, 28), material);
    g.add(body);
    if (necks) {
      for (const s of [1, -1]) {
        const neck = mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.14, 16), M.workRollChock);
        neck.position.set(0, s * (BARREL / 2 + 0.07), 0);
        g.add(neck);
      }
    }
    group.add(g);
    return g;
  };

  for (const z of [1, -1]) {
    const housing = mesh(new THREE.BoxGeometry(PINCH_R * 5.4, housingHeight, 0.2), M.housing);
    housing.position.set(0, SCENE.floorY / 2 + PINCH_R, z * (housingDepth / 2 - 0.1));
    group.add(housing);
  }

  // Pinch rolls, Ø250 — top raised (threading-complete position).
  roll(-PINCH_R * 1.6, PINCH_R * 1.5, PINCH_R, M.pinchRoll);
  roll(-PINCH_R * 1.6, -PINCH_R, PINCH_R, M.pinchRoll);
  // Leveller rolls, Ø200.
  roll(PINCH_R * 0.6, -LEV_R, LEV_R, M.levellerRoll);
  roll(PINCH_R * 2.2, -LEV_R, LEV_R, M.levellerRoll);
  roll(PINCH_R * 1.4, LEV_R * 1.6, LEV_R, M.levellerRoll);

  // 5T jactuator with hand wheel.
  const jack = mesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), M.drive);
  jack.position.set(PINCH_R * 1.4, PINCH_R * 3.4, 0);
  group.add(jack);
  const wheel = mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 24), M.drive);
  wheel.position.set(PINCH_R * 1.4, PINCH_R * 3.4 + 0.2, 0);
  group.add(wheel);

  // Drive train: pinion stand, disengaged coupler, reducer, 11 kW motor.
  const train = new THREE.Group();
  train.position.set(0, -0.1, -housingDepth / 2 - 0.45);
  group.add(train);
  const pinion = mesh(new THREE.BoxGeometry(PINCH_R * 4.4, 0.44, 0.34), M.drive);
  pinion.position.set(0, 0, 0.2);
  train.add(pinion);
  const coupler = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16), M.hydraulicRod);
  coupler.position.set(0, 0, -0.08);
  train.add(coupler);
  const reducer = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.34), M.drive);
  reducer.position.set(0, -0.02, -0.34);
  train.add(reducer);
  const motor = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 20), M.drive);
  motor.position.set(0, -0.02, -0.68);
  motor.rotation.x = Math.PI / 2;
  train.add(motor);

  for (const z of [1, -1]) {
    const guide = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 14), M.levellerRoll);
    guide.position.set(PINCH_R * 3.2, 0, z * mmToScene(500 / 2 + 40));
    group.add(guide);
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/**
 * CARRY-OVER TABLE, lowered to parking — its position during rolling. Port of
 * CarryOverTable.tsx.
 */
export function createCarryOverTable(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'CARRY_OVER_TABLE';
  group.position.x = LINE.carryOverTableX;

  const TABLE_LENGTH = mmToScene(1100);
  const TABLE_WIDTH = mmToScene(700);

  const bed = new THREE.Group();
  bed.position.set(0, -0.16, 0);
  bed.rotation.z = 0.28;
  group.add(bed);

  const deck = mesh(new THREE.BoxGeometry(TABLE_LENGTH, 0.06, TABLE_WIDTH), M.saddle);
  bed.add(deck);
  for (const z of [1, -1]) {
    const rail = mesh(new THREE.BoxGeometry(TABLE_LENGTH, 0.07, 0.04), M.housing);
    rail.position.set(0, 0.06, z * TABLE_WIDTH * 0.47);
    bed.add(rail);
  }

  for (const z of [1, -1]) {
    const block = mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), M.housing);
    block.position.set(-TABLE_LENGTH / 2, -0.16, z * TABLE_WIDTH * 0.42);
    group.add(block);
    const lift = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 12), M.hydraulic);
    lift.position.set(TABLE_LENGTH * 0.2, -0.42, z * TABLE_WIDTH * 0.42);
    lift.rotation.z = 0.2;
    group.add(lift);
    const leg = mesh(
      new THREE.BoxGeometry(0.12, Math.abs(SCENE.floorY) - 0.6, 0.12), M.housing);
    leg.position.set(TABLE_LENGTH * 0.3, SCENE.floorY / 2 - 0.3, z * TABLE_WIDTH * 0.42);
    group.add(leg);
  }

  return { group, update() {}, dispose: () => disposeSubtree(group) };
}

/**
 * PAY-OFF REEL SNUBBER, lowered onto the coil. The arm angle follows the POR coil diameter,
 * which the twin knows from the coil model — a snubber floating over a part-used coil would
 * be a visible lie. Port of Snubber.tsx.
 */
export function createSnubber(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'SNUBBER';

  const ROLL_RADIUS = mmToScene(200 / 2);
  const ROLL_LENGTH = mmToScene(200);
  const ARM_LENGTH = mmToScene(1500);
  const PIVOT_Y = mmToScene(1500);

  group.position.set(LINE.porX, PIVOT_Y, 0);

  const bracket = mesh(new THREE.BoxGeometry(0.18, 0.18, ROLL_LENGTH + 0.24), M.housing);
  group.add(bracket);
  const column = mesh(
    new THREE.BoxGeometry(0.16, PIVOT_Y - SCENE.floorY, 0.16), M.housing);
  column.position.set(0, -(PIVOT_Y - SCENE.floorY) / 2, -(ROLL_LENGTH / 2 + 0.3));
  group.add(column);
  const brace = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.34), M.housing);
  brace.position.set(0, 0, -(ROLL_LENGTH / 2 + 0.15));
  group.add(brace);

  const arm = new THREE.Group();
  group.add(arm);
  const armBar = mesh(new THREE.BoxGeometry(0.12, ARM_LENGTH, 0.14), M.housing);
  armBar.position.set(0, -ARM_LENGTH / 2, 0);
  arm.add(armBar);

  const rollG = new THREE.Group();
  rollG.position.set(0, -ARM_LENGTH, 0);
  rollG.rotation.x = Math.PI / 2;
  arm.add(rollG);
  const snubRoll = mesh(new THREE.CylinderGeometry(ROLL_RADIUS, ROLL_RADIUS, ROLL_LENGTH, 24), M.snubberRubber);
  rollG.add(snubRoll);
  for (const s of [1, -1]) {
    const flange = mesh(
      new THREE.CylinderGeometry(ROLL_RADIUS * 0.5, ROLL_RADIUS * 0.5, 0.1, 14), M.workRollChock);
    flange.position.set(0, s * (ROLL_LENGTH / 2 + 0.05), 0);
    rollG.add(flange);
  }

  const armCyl = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 12), M.hydraulic);
  armCyl.position.set(0.28, -0.42, 0);
  armCyl.rotation.z = -0.5;
  group.add(armCyl);

  return {
    group,
    update(v) {
      const coilRadius = Math.max(mmToScene(v.porRadius), SCENE.porMandrelRadius);
      const reach = coilRadius + ROLL_RADIUS;
      const cos = Math.min(1, Math.max(-1, (PIVOT_Y - reach) / ARM_LENGTH));
      arm.rotation.z = Math.acos(cos) * 0.55;
    },
    dispose: () => disposeSubtree(group),
  };
}

/**
 * MILL ENCLOSURE, HOOD AND FUME DUCTING — drawn as GLASS. On the real mill the shutter is
 * closed during rolling and the bite is invisible; reproducing that faithfully would defeat
 * the twin's purpose, so containment reads as structure without becoming opaque. Hidden in
 * the STAND view. Port of MillEnclosure.tsx.
 */
export function createMillEnclosure(ctx) {
  const { M, SCENE, LINE } = ctx;
  const group = new THREE.Group();
  group.name = 'ENCLOSURE';

  const width = Math.abs(LINE.entryAirKnifeX) * 2 + mmToScene(1400);
  const depth = SCENE.housingZ * 2 + mmToScene(900);
  const top = SCENE.housingTop + mmToScene(700);
  const midY = (top + SCENE.floorY) / 2;
  const height = top - SCENE.floorY;

  const glass = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9db8cc'),
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });

  for (const z of [1, -1]) {
    const wall = mesh(new THREE.BoxGeometry(width, height, 0.02), glass, false);
    wall.position.set(0, midY, z * (depth / 2));
    group.add(wall);
  }
  for (const x of [1, -1]) {
    const wall = mesh(new THREE.BoxGeometry(0.02, height, depth), glass, false);
    wall.position.set(x * (width / 2), midY, 0);
    group.add(wall);
  }
  for (const x of [1, -1]) {
    for (const z of [1, -1]) {
      const post = mesh(new THREE.BoxGeometry(0.07, height, 0.07), M.housingTrim);
      post.position.set(x * (width / 2), midY, z * (depth / 2));
      group.add(post);
    }
  }
  for (const x of [1, -1]) {
    const hood = mesh(new THREE.BoxGeometry(width * 0.3, mmToScene(400), depth * 0.7), M.duct);
    hood.position.set(x * (width * 0.3), top, 0);
    group.add(hood);
    const duct = mesh(
      new THREE.CylinderGeometry(mmToScene(280), mmToScene(280), mmToScene(1000), 16), M.duct);
    duct.position.set(x * (width * 0.3), top + mmToScene(700), 0);
    group.add(duct);
  }
  const cross = mesh(
    new THREE.CylinderGeometry(mmToScene(300), mmToScene(300), width * 0.65, 16), M.duct);
  cross.position.set(0, top + mmToScene(1200), 0);
  cross.rotation.z = Math.PI / 2;
  group.add(cross);

  return {
    group,
    update() {},
    setStandView(isStand) { group.visible = !isStand; },
    dispose() {
      glass.dispose();
      disposeSubtree(group);
    },
  };
}

// =============================================================================================
// FLOOR
// =============================================================================================

export function createFloor(ctx) {
  const { M, SCENE, LINE } = ctx;
  const width = (LINE.maxX - LINE.minX) + 8;
  const centreX = (LINE.maxX + LINE.minX) / 2;

  const geometry = new THREE.PlaneGeometry(width, 14);
  const floor = new THREE.Mesh(geometry, M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centreX, SCENE.floorY, 0);
  floor.receiveShadow = true;
  floor.name = 'FLOOR';

  return { group: floor, update() {}, dispose: () => geometry.dispose() };
}
