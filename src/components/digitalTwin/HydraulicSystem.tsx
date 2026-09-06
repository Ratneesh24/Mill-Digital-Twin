/**
 * HYDRAULIC SYSTEM — HAGC capsules and work roll bending actuators.
 *
 * The capsule rod extension follows the roll gap: closing the gap extends the
 * capsule. It is driven from the same `rollGap.actual` the work rolls use, so
 * the cylinder and the rolls can never disagree about where the stack is.
 *
 * BENDING IS DIFFERENT, and deliberately so (§7.4): on the 46-tag CRM04 feed
 * there is no bending force tag. When the tag is absent the bending actuators
 * are rendered in an inert "no data" grey and do not move. The twin must not
 * animate a bend it cannot measure.
 */

import { useRef } from 'react'
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { rollGapToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { backupRollCentreY, MATERIALS, SCENE, SCENE_COLORS, workRollCentreY } from './twinMaterials'

/** Colour a bending actuator moves towards as bending force rises. */
const BENDING_TINT = new Color(SCENE_COLORS.normal)

export function HydraulicSystem() {
  return (
    <group>
      {[-1, 1].map((z) => (
        <HagcCapsule key={z} z={z as -1 | 1} />
      ))}
      {[-1, 1].map((z) =>
        (['UPPER', 'LOWER'] as const).map((side) =>
          [-1, 1].map((x) => (
            <BendingActuator
              key={`${z}-${side}-${x}`}
              z={z as -1 | 1}
              x={x as -1 | 1}
              side={side}
            />
          )),
        ),
      )}
    </group>
  )
}

/**
 * Top-mounted HAGC capsule sitting between the housing top beam and the upper
 * backup roll chock.
 */
function HagcCapsule({ z }: { z: -1 | 1 }) {
  const rodRef = useRef<Mesh>(null)
  const bodyY = SCENE.housingTop - 0.42

  useTwinFrame((v) => {
    const rod = rodRef.current
    if (!rod) return

    const chockTop = backupRollCentreY(rollGapToScene(v.rollGap), 'UPPER') + SCENE.burRadius * 0.75
    const stroke = Math.max(bodyY - 0.16 - chockTop, 0.02)
    // The rod is modelled at unit length and scaled, so the capsule visibly
    // extends as the stack is pressed down onto the strip.
    rod.scale.y = stroke
    rod.position.y = bodyY - 0.16 - stroke / 2
  })

  return (
    <group position={[0, 0, z * SCENE.chockZ]}>
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.34, 24]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
      <mesh ref={rodRef} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 1, 20]} />
        <meshStandardMaterial {...MATERIALS.hydraulicRod} />
      </mesh>
      {/* Feed line stub, purely structural context. */}
      <mesh position={[0.26, bodyY + 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.3, 12]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
    </group>
  )
}

/**
 * Work roll bending actuator on the WR chock.
 *
 * Colour is the honest part: green-tinted when a bending force is being
 * reported, inert grey when the tag does not exist on this feed.
 */
function BendingActuator({
  z,
  x,
  side,
}: {
  z: -1 | 1
  x: -1 | 1
  side: 'UPPER' | 'LOWER'
}) {
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
      // subtle tint, not a glowing block. The actuator has to read as part of
      // the machine, not as a UI element parked inside it.
      material.color.set(MATERIALS.bendingActuator.color)
      material.color.lerp(BENDING_TINT, 0.35 + v.bendingNormalised * 0.3)
      material.emissiveIntensity = 0.02 + v.bendingNormalised * 0.1
    }
  })

  return (
    <group ref={groupRef}>
      <mesh
        ref={bodyRef}
        position={[x * SCENE.wrRadius * 1.7, 0, z * (SCENE.chockZ + 0.05)]}
        castShadow
      >
        <boxGeometry args={[0.1, 0.14, 0.11]} />
        <meshStandardMaterial
          {...MATERIALS.bendingActuator}
          emissive={SCENE_COLORS.normal}
          emissiveIntensity={0}
        />
      </mesh>
    </group>
  )
}
