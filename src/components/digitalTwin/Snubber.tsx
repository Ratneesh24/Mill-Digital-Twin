/**
 * PAY-OFF REEL SNUBBER — §5.2, drawing EU 03 3 A1.
 *
 * A hollow steel roll Ø200 x 200 long with a neoprene rubber covering, on an arm
 * mounted to the POR gearbox casing and hydraulically lowered onto the coil. It
 * holds the outer wrap down while the coil is opened and driven by its own
 * Danfoss OMP-315 hydraulic motor to assist feeding and prevent thrown loops
 * (§12.1 steps 7 and 14).
 *
 * STATIC, drawn LOWERED onto the coil — its position while a coil is charged.
 * It is retracted before the strip is fed to the mill (§12.2 step 4), but with no
 * snubber tag on the feed the twin cannot know which of the two it is at any
 * moment, so it draws the state that is true for most of a coil's life.
 *
 * The arm angle follows the POR coil diameter, which the twin DOES know from the
 * coil model — a snubber resting in mid-air above a part-used coil would be a
 * visible lie about a value the scene already has.
 */

import { useRef } from 'react'
import type { Group } from 'three'
import { mmToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

/** §5.2: hollow steel roll Ø200 x 200 long, neoprene covered. */
const ROLL_RADIUS = mmToScene(200 / 2)
const ROLL_LENGTH = mmToScene(200)
/** Arm pivot, up and back from the mandrel on the gearbox casing. */
const ARM_LENGTH = mmToScene(1500)
const PIVOT_Y = mmToScene(1500)

export function Snubber() {
  const armRef = useRef<Group>(null)

  useTwinFrame((v) => {
    const arm = armRef.current
    if (!arm) return
    // Rest the roll on the coil surface: the arm swings as the coil is paid off.
    const coilRadius = Math.max(mmToScene(v.porRadius), SCENE.porMandrelRadius)
    const reach = coilRadius + ROLL_RADIUS
    // Angle of the arm from vertical that puts the roll on the coil surface.
    const cos = Math.min(1, Math.max(-1, (PIVOT_Y - reach) / ARM_LENGTH))
    arm.rotation.z = Math.acos(cos) * 0.55
  })

  return (
    <group position={[LINE.porX, PIVOT_Y, 0]}>
      {/*
        Pivot bracket, and the column carrying it down to the reel's own base.
        §5.2 mounts the snubber arm on the POR gearbox casing — without the
        column the bracket reads as a pivot floating in mid-air above the coil.
      */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.18, ROLL_LENGTH + 0.24]} />
        <meshStandardMaterial {...MATERIALS.housing} />
      </mesh>
      <mesh
        position={[0, -(PIVOT_Y - SCENE.floorY) / 2, -(ROLL_LENGTH / 2 + 0.3)]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.16, PIVOT_Y - SCENE.floorY, 0.16]} />
        <meshStandardMaterial {...MATERIALS.housing} />
      </mesh>
      {/* Brace from the column head out to the pivot, over the coil. */}
      <mesh position={[0, 0, -(ROLL_LENGTH / 2 + 0.15)]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.34]} />
        <meshStandardMaterial {...MATERIALS.housing} />
      </mesh>

      <group ref={armRef}>
        {/* Arm. */}
        <mesh position={[0, -ARM_LENGTH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, ARM_LENGTH, 0.14]} />
          <meshStandardMaterial {...MATERIALS.housing} />
        </mesh>

        {/* Snubber roll — steel core under a neoprene covering. */}
        <group position={[0, -ARM_LENGTH, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[ROLL_RADIUS, ROLL_RADIUS, ROLL_LENGTH, 24]} />
            <meshStandardMaterial {...MATERIALS.snubberRubber} />
          </mesh>
          {/* Flange cartridge bearings, MFC-40 (§10.4 item 6). */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * (ROLL_LENGTH / 2 + 0.05), 0]} castShadow>
              <cylinderGeometry args={[ROLL_RADIUS * 0.5, ROLL_RADIUS * 0.5, 0.1, 14]} />
              <meshStandardMaterial {...MATERIALS.workRollChock} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Arm cylinder, Ø80 × 300 stroke (Table I item 4). */}
      <mesh position={[0.28, -0.42, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.62, 12]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>
    </group>
  )
}
