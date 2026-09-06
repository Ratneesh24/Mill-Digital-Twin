/**
 * WORK ROLL — polished steel, driven, straddling the pass line.
 *
 * Two bindings from §10.3 land here:
 *   `speed.actual`     -> rotation rate (via the twin engine's integrated angle)
 *   `rollGap.actual`   -> work-roll separation
 *
 * Rotation is DERIVED (§8.4): the angle comes from the roll rpm the machine
 * state reports, which itself comes from mill speed. There is no animation
 * timer anywhere in this file, so zero speed necessarily means a stationary
 * roll.
 *
 * Bending is deliberately NOT animated unless a bending tag exists (§7.4).
 */

import { useRef } from 'react'
import type { Group } from 'three'
import { rollGapToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { MATERIALS, SCENE, workRollCentreY } from './twinMaterials'

interface Props {
  side: 'UPPER' | 'LOWER'
}

export function WorkRoll({ side }: Props) {
  const liftRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)

  useTwinFrame((v) => {
    const lift = liftRef.current
    const spin = spinRef.current
    if (!lift || !spin) return

    // Gap -> vertical position. `rollGap` is already damped by the twin engine,
    // so the roll never snaps to a new position (§10.4).
    lift.position.y = workRollCentreY(rollGapToScene(v.rollGap), side)

    // Upper and lower work rolls counter-rotate. A single sign flip here is what
    // makes them still counter-rotate correctly after a direction reversal.
    spin.rotation.y = side === 'UPPER' ? v.wrAngle : -v.wrAngle
  })

  const r = SCENE.wrRadius
  const halfBarrel = SCENE.barrelLength / 2

  return (
    <group ref={liftRef}>
      {/* Lay the cylinder axis along Z (the barrel axis), then spin about it. */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[r, r, SCENE.barrelLength, 48, 1]} />
            <meshStandardMaterial {...MATERIALS.workRoll} />
          </mesh>

          {/* Neck extensions into the chocks. */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * (SCENE.barrelLength / 2 + 0.09), 0]} castShadow>
              <cylinderGeometry args={[r * 0.58, r * 0.58, 0.18, 24]} />
              <meshStandardMaterial {...MATERIALS.workRollChock} />
            </mesh>
          ))}

          {/*
            Rotation marker on the drive-side end face. Without a visible
            feature a smooth cylinder appears stationary at any speed, which
            would hide the single most important thing the scene has to show.
          */}
          <mesh position={[0, halfBarrel + 0.181, r * 0.34]} castShadow>
            <boxGeometry args={[0.035, 0.012, r * 0.5]} />
            <meshStandardMaterial {...MATERIALS.rollMarker} />
          </mesh>
        </group>
      </group>

      {/* Chocks — static, they do not rotate with the roll. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * (halfBarrel + 0.19)]} castShadow receiveShadow>
          <boxGeometry args={[r * 1.7, r * 1.7, 0.18]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
        </mesh>
      ))}
    </group>
  )
}
