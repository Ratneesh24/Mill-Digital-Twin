/**
 * BACKUP ROLL — dark steel, larger, carries the separating force into the
 * housing through the chocks and the HAGC capsule.
 *
 * The BUR is not independently driven: it is turned by contact with the work
 * roll, so its surface speed equals the WR surface speed and its rpm is lower in
 * proportion to its diameter. That relationship is computed in the machine layer
 * (BUR.TOP.RPM) — this component only renders the angle the twin engine
 * integrated from it.
 */

import { useRef } from 'react'
import type { Group } from 'three'
import { rollGapToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { backupRollCentreY, MATERIALS, SCENE } from './twinMaterials'

interface Props {
  side: 'UPPER' | 'LOWER'
}

export function BackupRoll({ side }: Props) {
  const liftRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)

  useTwinFrame((v) => {
    const lift = liftRef.current
    const spin = spinRef.current
    if (!lift || !spin) return
    lift.position.y = backupRollCentreY(rollGapToScene(v.rollGap), side)
    spin.rotation.y = side === 'UPPER' ? v.burAngle : -v.burAngle
  })

  const r = SCENE.burRadius
  const halfBarrel = SCENE.barrelLength / 2
  const neckR = SCENE.burNeckRadius
  const neckLength = neckR * 1.1

  return (
    <group ref={liftRef}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[r, r, SCENE.barrelLength, 56, 1]} />
            <meshStandardMaterial {...MATERIALS.backupRoll} />
          </mesh>

          {/*
            Necks sized to the Timken TQO bore the roll runs in (Ø317.500,
            §10.4 item 20) rather than a fraction of the barrel. On a Ø550
            back-up that is well over half the barrel diameter, which is exactly
            why these bearings are the ones with a 1500-hour turn-the-cones
            regime (§11.4).
          */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * (halfBarrel + neckLength / 2), 0]} castShadow>
              <cylinderGeometry args={[neckR, neckR, neckLength, 28]} />
              <meshStandardMaterial {...MATERIALS.backupRollChock} />
            </mesh>
          ))}

          <mesh position={[0, halfBarrel + neckLength + 0.001, neckR * 0.55]} castShadow>
            <boxGeometry args={[0.04, 0.012, neckR * 0.6]} />
            <meshStandardMaterial {...MATERIALS.rollMarker} />
          </mesh>
        </group>
      </group>

      {/* Chocks are kept trim: outboard of the barrel they sit directly in the
          operator's line of sight into the roll stack, and an oversized chock
          hides the one thing the scene exists to show. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, 0, s * (halfBarrel + neckLength / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[neckR * 2.1, neckR * 2.4, neckLength]} />
          <meshStandardMaterial {...MATERIALS.backupRollChock} />
        </mesh>
      ))}

      {/*
        Felt back-up roll wipers (§6.6) — spring loaded onto the barrel from a
        holder on cross beams bolted to the chock inner faces. They ride the roll
        surface, so they move up and down with the stack.
      */}
      {[-1, 1].map((s) => (
        <mesh
          key={`wiper-${s}`}
          position={[s * r * 0.72, side === 'UPPER' ? r * 0.72 : -r * 0.72, 0]}
          castShadow
        >
          <boxGeometry args={[0.05, 0.04, SCENE.barrelLength * 0.96]} />
          <meshStandardMaterial {...MATERIALS.backupRollChock} />
        </mesh>
      ))}
    </group>
  )
}
