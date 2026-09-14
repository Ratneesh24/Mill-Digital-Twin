/**
 * PINCH ROLL CUM FLATTENER UNIT — §5.4, drawings EU 06 0..5 A1.
 *
 * Sits on the entry side between the pay-off reel and the entry tension reel, so
 * the first pass runs POR -> peeler -> flattener -> carry-over table -> over an
 * idle ETR -> mill (§3, §12.2). It flattens the coil nose and feeds it forward at
 * threading speed.
 *
 * STATIC. There is no flattener tag on the CRM04 feed — no roll speed, no
 * penetration, no coupler position — so nothing here moves. §10.3's rule is that
 * every moving object represents a machine parameter, and inventing a spin for
 * this unit would be exactly the kind of decorative animation the twin refuses.
 * It is drawn in its parked state: top rolls raised, coupler disengaged, which is
 * where it sits during normal rolling (§12.4 steps 5-6).
 */

import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

/** §5.4: 2 pinch rolls Ø250 x 600 barrel, 3 leveller rolls Ø200 x 600. */
const PINCH_ROLL_RADIUS = mmToScene(250 / 2)
const LEVELLER_ROLL_RADIUS = mmToScene(200 / 2)
const ROLL_BARREL = mmToScene(600)

export function PinchRollFlattener() {
  const housingHeight = Math.abs(SCENE.floorY) + PINCH_ROLL_RADIUS * 3
  const housingDepth = ROLL_BARREL + 0.5

  return (
    <group position={[LINE.flattenerX, 0, 0]}>
      {/* Fabricated steel housing, foundation mounted (§5.4). */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          position={[0, SCENE.floorY / 2 + PINCH_ROLL_RADIUS, z * (housingDepth / 2 - 0.1)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[PINCH_ROLL_RADIUS * 5.4, housingHeight, 0.2]} />
          <meshStandardMaterial {...MATERIALS.housing} />
        </mesh>
      ))}

      {/*
        Pinch rolls, Ø250. The top roll is hydraulically raised and lowered; the
        bottom roll is fixed in position (§5.4). Drawn with the top roll raised,
        its threading-complete position.
      */}
      <Roll x={-PINCH_ROLL_RADIUS * 1.6} y={PINCH_ROLL_RADIUS * 1.5} radius={PINCH_ROLL_RADIUS} material="pinchRoll" />
      <Roll x={-PINCH_ROLL_RADIUS * 1.6} y={-PINCH_ROLL_RADIUS} radius={PINCH_ROLL_RADIUS} material="pinchRoll" />

      {/*
        Three leveller rolls, Ø200 — two bottom, one top, the top one on coarse
        hydraulic penetration plus a hand-wheel screw jack for fine adjustment.
      */}
      <Roll x={PINCH_ROLL_RADIUS * 0.6} y={-LEVELLER_ROLL_RADIUS} radius={LEVELLER_ROLL_RADIUS} material="levellerRoll" />
      <Roll x={PINCH_ROLL_RADIUS * 2.2} y={-LEVELLER_ROLL_RADIUS} radius={LEVELLER_ROLL_RADIUS} material="levellerRoll" />
      <Roll x={PINCH_ROLL_RADIUS * 1.4} y={LEVELLER_ROLL_RADIUS * 1.6} radius={LEVELLER_ROLL_RADIUS} material="levellerRoll" />

      {/*
        5T jactuator (EU 06 2 A1) — the hand wheel that sets fine penetration on
        the top flattening roll. Hand-operated, so it is genuinely static
        equipment rather than something the twin is declining to animate.
      */}
      <group position={[PINCH_ROLL_RADIUS * 1.4, PINCH_ROLL_RADIUS * 3.4, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.18, 0.26, 0.18]} />
          <meshStandardMaterial {...MATERIALS.drive} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.12, 0.014, 8, 24]} />
          <meshStandardMaterial {...MATERIALS.drive} />
        </mesh>
      </group>

      {/*
        Drive train (§5.4): 11 kW AC motor -> 20:1 splash-lubricated reducer ->
        hydraulically engaging gear coupler -> multi-output pinion stand ->
        propeller shafts to each roll. Threading speed about 30 m/min.
      */}
      <group position={[0, -0.1, -housingDepth / 2 - 0.45]}>
        {/* Pinion stand, forced lubrication. */}
        <mesh position={[0, 0, 0.2]} castShadow receiveShadow>
          <boxGeometry args={[PINCH_ROLL_RADIUS * 4.4, 0.44, 0.34]} />
          <meshStandardMaterial {...MATERIALS.drive} />
        </mesh>
        {/* Gear coupler — drawn disengaged, as it is during rolling. */}
        <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.2, 16]} />
          <meshStandardMaterial {...MATERIALS.hydraulicRod} />
        </mesh>
        {/* 20:1 reducer. */}
        <mesh position={[0, -0.02, -0.34]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.4, 0.34]} />
          <meshStandardMaterial {...MATERIALS.drive} />
        </mesh>
        {/* 11 kW AC motor. */}
        <mesh position={[0, -0.02, -0.68]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.36, 20]} />
          <meshStandardMaterial {...MATERIALS.drive} />
        </mesh>
      </group>

      {/*
        Side guide (EU 05 3 A1) — steel rolls in brackets that move toward and
        away from centre SIMULTANEOUSLY by a hand-wheel screw and nut, keeping the
        strip centred during initial threading from POR to the delivery reel.
      */}
      {[-1, 1].map((z) => (
        <mesh
          key={`guide-${z}`}
          position={[PINCH_ROLL_RADIUS * 3.2, 0, z * mmToScene(500 / 2 + 40)]}
          castShadow
        >
          <cylinderGeometry args={[0.05, 0.05, 0.2, 14]} />
          <meshStandardMaterial {...MATERIALS.levellerRoll} />
        </mesh>
      ))}
    </group>
  )
}

/** One roll on the unit, laid along the barrel axis with its bearing housings. */
function Roll({
  x,
  y,
  radius,
  material,
}: {
  x: number
  y: number
  radius: number
  material: 'pinchRoll' | 'levellerRoll'
}) {
  return (
    <group position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, ROLL_BARREL, 28]} />
        <meshStandardMaterial {...MATERIALS[material]} />
      </mesh>
      {/* Necks into the antifriction bearing housings. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (ROLL_BARREL / 2 + 0.07), 0]} castShadow>
          <cylinderGeometry args={[radius * 0.42, radius * 0.42, 0.14, 16]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
        </mesh>
      ))}
    </group>
  )
}
