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

  return (
    <group ref={liftRef}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[r, r, SCENE.barrelLength, 56, 1]} />
            <meshStandardMaterial {...MATERIALS.backupRoll} />
          </mesh>

          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, s * (halfBarrel + 0.13), 0]} castShadow>
              <cylinderGeometry args={[r * 0.46, r * 0.46, 0.26, 28]} />
              <meshStandardMaterial {...MATERIALS.backupRollChock} />
            </mesh>
          ))}

          <mesh position={[0, halfBarrel + 0.261, r * 0.4]} castShadow>
            <boxGeometry args={[0.05, 0.014, r * 0.42]} />
            <meshStandardMaterial {...MATERIALS.rollMarker} />
          </mesh>
        </group>
      </group>

      {/* Chocks are kept trim: outboard of the barrel they sit directly in the
          operator's line of sight into the roll stack, and an oversized chock
          hides the one thing the scene exists to show. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * (halfBarrel + 0.26)]} castShadow receiveShadow>
          <boxGeometry args={[r * 1.05, r * 1.2, 0.24]} />
          <meshStandardMaterial {...MATERIALS.backupRollChock} />
        </mesh>
      ))}
    </group>
  )
}
