/**
 * ROLL FORCE CYLINDERS AND MAE-WEST BLOCKS — §6.2 and §6.3.
 *
 * Two machines share this file because they share one binding.
 *
 * ROLL FORCE CYLINDER (§6.2): ram type, Ø420 x 45 mm stroke, one at the TOP of
 * each housing, operator side and drive side independently. Its extension
 * follows the roll gap — closing the gap extends the ram — and it is driven from
 * the same `rollGap.actual` the work rolls use, so the cylinder and the rolls can
 * never disagree about where the stack is.
 *
 * The 45 mm stroke is worth noticing: it is the ENTIRE working travel of the
 * screwdown on this mill. The scene draws the ram at its true proportions, so
 * the visible movement is small — which is honest. Pass-line correction is done
 * with shims on a trolley (§6.4), not by winding this cylinder out.
 *
 * MAE-WEST BLOCKS (§6.3): four blocks, at the entry and delivery sides on both
 * operator and drive side. Each carries a work roll bending / balancing cylinder
 * and a back-up roll balancing cylinder. The manual records a 3 mm offset between
 * back-up and work roll centres, produced by making the entry-side and
 * delivery-side block widths different — but not its sign relative to the first
 * pass (open item 6), so the scene draws the width difference and claims nothing
 * about direction.
 *
 * BENDING IS DIFFERENT, and deliberately so (§7.4): on the 46-tag CRM04 feed
 * there is no bending force tag. When the tag is absent the bending cylinders are
 * rendered in an inert "no data" grey and do not move. The twin must not animate
 * a bend it cannot measure.
 */

import { useRef } from 'react'
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { rollGapToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { backupRollCentreY, MATERIALS, SCENE, SCENE_COLORS, workRollCentreY } from './twinMaterials'

/** Colour a bending cylinder moves towards as bending force rises. */
const BENDING_TINT = new Color(SCENE_COLORS.normal)

export function HydraulicSystem() {
  return (
    <group>
      {/* One roll force cylinder per housing — operator side and drive side. */}
      {[-1, 1].map((z) => (
        <RollForceCylinder key={z} z={z as -1 | 1} />
      ))}
      {/* Four Mae-west blocks: entry and delivery, on each side of the barrel. */}
      {[-1, 1].map((z) =>
        [-1, 1].map((x) => (
          <MaeWestBlock key={`${z}-${x}`} z={z as -1 | 1} x={x as -1 | 1} />
        )),
      )}
    </group>
  )
}

/**
 * Top-mounted ram-type roll force cylinder, between the housing top beam and the
 * rocker plate the upper back-up roll chock is balanced against (§6.3 item 6).
 */
function RollForceCylinder({ z }: { z: -1 | 1 }) {
  const ramRef = useRef<Mesh>(null)
  const bodyHeight = SCENE.rollForceRamRadius * 1.5
  const bodyY = SCENE.housingTop - bodyHeight * 0.55

  useTwinFrame((v) => {
    const ram = ramRef.current
    if (!ram) return

    const chockTop = backupRollCentreY(rollGapToScene(v.rollGap), 'UPPER') + SCENE.burRadius * 0.82
    const stroke = Math.max(bodyY - bodyHeight / 2 - chockTop, 0.01)
    // The ram is modelled at unit length and scaled, so the cylinder visibly
    // extends as the stack is pressed down onto the strip.
    ram.scale.y = stroke
    ram.position.y = bodyY - bodyHeight / 2 - stroke / 2
  })

  const r = SCENE.rollForceRamRadius

  return (
    <group position={[0, 0, z * SCENE.chockZ]}>
      {/* Cylinder body, seated in the housing top. */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, bodyHeight, 28]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
      {/* Ram — full bore, not a slender rod: this is a ram cylinder, not a piston. */}
      <mesh ref={ramRef} castShadow>
        <cylinderGeometry args={[r * 0.9, r * 0.9, 1, 24]} />
        <meshStandardMaterial {...MATERIALS.hydraulicRod} />
      </mesh>
      {/*
        Air vent (§6.2). Trapped air prevents smooth rolling and the cylinder is
        de-aerated by stroking it through ~40 mm at both ends — a detail worth
        having in the picture because it is the first thing to check when the
        gap will not hold.
      */}
      <mesh position={[r * 0.75, bodyY + bodyHeight * 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, r * 0.9, 12]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
      {/* Feed line stub, purely structural context. */}
      <mesh position={[-r * 0.75, bodyY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, r * 0.9, 12]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
    </group>
  )
}

/**
 * One Mae-west block and the two cylinders it houses.
 *
 * `x = -1` is the entry side of the stand, `x = +1` the delivery side. The block
 * widths differ by the 3 mm the manual records; the sign of the resulting roll
 * centre offset is an open item, so nothing here asserts which way it goes.
 */
function MaeWestBlock({ z, x }: { z: -1 | 1; x: -1 | 1 }) {
  const blockWidth = SCENE.wrRadius * 0.75 + (x === -1 ? SCENE.maeWestOffset : 0)
  // The blocks are bolted to the INNER FACE of each housing window (§6.3) — they
  // are what the roll chocks slide against. Placing them by roll radius instead
  // buries them inside the Ø550 back-up roll, which is where they were.
  const windowFace = SCENE.housingPostX - SCENE.burRadius * 0.26
  const blockX = x * (windowFace - blockWidth / 2)
  const blockHeight = SCENE.burRadius * 2.6

  return (
    <group position={[blockX, 0, z * SCENE.chockZ]}>
      {/* The block itself — bolted to the housing, static. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[blockWidth, blockHeight, SCENE.wrRadius * 1.5]} />
        <meshStandardMaterial {...MATERIALS.maeWest} />
      </mesh>

      {/*
        Replaceable steel plate liners on the faces contacting the work roll
        chock (§6.3 item 4) — changed with the work rolls.
      */}
      <mesh position={[-x * (blockWidth / 2 + 0.006), 0, 0]}>
        <boxGeometry args={[0.012, blockHeight * 0.7, SCENE.wrRadius * 1.35]} />
        <meshStandardMaterial {...MATERIALS.workRollChock} />
      </mesh>

      {/*
        Back-up roll balancing cylinders, which press the top back-up roll against
        the rocker plate of the roll force cylinder during both rolling and roll
        change (§6.3 item 6). They hold a constant load, so they do not animate.
      */}
      {(['UPPER', 'LOWER'] as const).map((side) => (
        <BackupBalanceCylinder key={side} side={side} width={blockWidth} />
      ))}

      {/*
        Work roll bending cylinders. §6.3 item 5: they "operate in co-operation
        with each other and apply an equal bending force to the upper and lower
        work rolls together" — which is why both sides read the same normalised
        value rather than each having its own.
      */}
      {(['UPPER', 'LOWER'] as const).map((side) => (
        <BendingCylinder key={side} side={side} width={blockWidth} />
      ))}
    </group>
  )
}

function BackupBalanceCylinder({
  side,
  width,
}: {
  side: 'UPPER' | 'LOWER'
  width: number
}) {
  const ref = useRef<Group>(null)

  useTwinFrame((v) => {
    const group = ref.current
    if (!group) return
    group.position.y = backupRollCentreY(rollGapToScene(v.rollGap), side)
  })

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[width * 0.8, SCENE.burRadius * 0.4, SCENE.wrRadius * 0.9]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
    </group>
  )
}

/**
 * Work roll bending cylinder.
 *
 * Colour is the honest part: tinted when a bending force is being reported,
 * inert grey when the tag does not exist on this feed.
 */
function BendingCylinder({ side, width }: { side: 'UPPER' | 'LOWER'; width: number }) {
  const groupRef = useRef<Group>(null)
  const bodyRef = useRef<Mesh>(null)

  useTwinFrame((v) => {
    const group = groupRef.current
    const body = bodyRef.current
    if (!group || !body) return

    group.position.y = workRollCentreY(rollGapToScene(v.rollGap), side)

    const material = body.material as MeshStandardMaterial
    if (v.bendingNormalised === null) {
      // NO TAG — inert. No colour, no movement, nothing implied.
      material.emissiveIntensity = 0
      material.color.set(MATERIALS.bendingActuator.color)
    } else {
      // Bending force IS machine state, so it earns colour (§11.2) — but a
      // subtle tint, not a glowing block. The cylinder has to read as part of
      // the machine, not as a UI element parked inside it.
      material.color.set(MATERIALS.bendingActuator.color)
      material.color.lerp(BENDING_TINT, 0.35 + v.bendingNormalised * 0.3)
      material.emissiveIntensity = 0.02 + v.bendingNormalised * 0.1
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={bodyRef} castShadow>
        <boxGeometry args={[width * 0.8, SCENE.wrRadius * 0.7, SCENE.wrRadius * 0.9]} />
        <meshStandardMaterial
          {...MATERIALS.bendingActuator}
          emissive={SCENE_COLORS.normal}
          emissiveIntensity={0}
        />
      </mesh>
    </group>
  )
}
