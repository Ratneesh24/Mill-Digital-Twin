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
  const neckR = SCENE.wrNeckRadius
  const neckLength = neckR * 2.4

  return (
    <group ref={liftRef}>
      {/* Lay the cylinder axis along Z (the barrel axis), then spin about it. */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[r, r, SCENE.barrelLength, 48, 1]} />
            <meshStandardMaterial {...MATERIALS.workRoll} />
          </mesh>

          {/*
            Neck extensions into the chocks. The neck diameter is the bore of the
            Timken TQO 4-row taper roller bearing the roll actually runs in
            (Ø120.650, §10.4 item 19) rather than a fraction of the barrel — on a
            Ø215 work roll that is a genuinely thick neck, and it should look it.
          */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * (halfBarrel + neckLength / 2), 0]} castShadow>
              <cylinderGeometry args={[neckR, neckR, neckLength, 24]} />
              <meshStandardMaterial {...MATERIALS.workRollChock} />
            </mesh>
          ))}

          {/*
            Rotation marker on the drive-side end face. Without a visible
            feature a smooth cylinder appears stationary at any speed, which
            would hide the single most important thing the scene has to show.
          */}
          <mesh position={[0, halfBarrel + neckLength + 0.001, neckR * 0.6]} castShadow>
            <boxGeometry args={[0.03, 0.01, neckR * 0.8]} />
            <meshStandardMaterial {...MATERIALS.rollMarker} />
          </mesh>
        </group>
      </group>

      {/*
        Chocks — static, they do not rotate with the roll. Both work rolls are
        held together by pins on the bottom chock and change as one stack (§6.5),
        which is why the roll changing car handles them as a single assembly.
      */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, 0, s * (halfBarrel + neckLength / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[neckR * 2.6, neckR * 2.6, neckLength]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
        </mesh>
      ))}
    </group>
  )
}
