/**
 * COILER — DTR, ETR and POR.
 *
 * §10.3 binding: `coil.remainingLength` -> coil diameters on both reels.
 *
 * The diameter shown is the one the coil model computed from the wound length
 * (r = √(r_m² + h·L/π)), so the payoff coil visibly shrinks and the tension reel
 * visibly grows at the correct, decelerating rate — and both reels slow down as
 * they fill, because rpm = v / 2πr.
 *
 * Which reel pays off and which winds is read from the direction-derived role.
 * After a reversal the same two meshes swap behaviour without either of them
 * knowing which side of the mill it is on.
 */

import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { mmToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { MATERIALS, SCENE } from './twinMaterials'

interface Props {
  reel: 'DTR' | 'ETR' | 'POR'
}

export function Coiler({ reel }: Props) {
  const spinRef = useRef<Group>(null)
  const coilRef = useRef<Mesh>(null)

  const positionX = reel === 'ETR' ? SCENE.reelX : -SCENE.reelX
  const positionZ = reel === 'POR' ? SCENE.porZ : 0

  useTwinFrame((v) => {
    const spin = spinRef.current
    const coil = coilRef.current
    if (!spin || !coil) return

    const radiusMm = reel === 'DTR' ? v.dtrRadius : reel === 'ETR' ? v.etrRadius : v.porRadius
    const radius = Math.max(mmToScene(radiusMm), SCENE.mandrelRadius * 1.02)

    // The cylinder is built at unit radius, so scaling in the two radial axes
    // resizes the coil without rebuilding geometry every frame.
    coil.scale.x = radius
    coil.scale.z = radius
    coil.scale.y = Math.max(mmToScene(v.stripWidth), 0.05)

    // POR is parked with its brake applied — it does not turn.
    if (reel !== 'POR') {
      spin.rotation.y = reel === 'DTR' ? v.dtrAngle : v.etrAngle
    }
  })

  return (
    <group position={[positionX, 0, positionZ]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          {/* Wound coil — radius driven by the coil model. */}
          <mesh ref={coilRef} castShadow receiveShadow>
            <cylinderGeometry args={[1, 1, 1, 48, 1]} />
            <meshStandardMaterial {...MATERIALS.coil} />
          </mesh>

          {/* Mandrel. */}
          <mesh castShadow>
            <cylinderGeometry
              args={[SCENE.mandrelRadius, SCENE.mandrelRadius, SCENE.barrelLength * 0.85, 28]}
            />
            <meshStandardMaterial {...MATERIALS.mandrel} />
          </mesh>

          {/* Wrap marker so reel rotation is visible even on a smooth coil. */}
          <CoilMarker reel={reel} />
        </group>
      </group>

      {/* Reel pedestal. */}
      <mesh position={[0, SCENE.floorY / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, Math.abs(SCENE.floorY), 0.6]} />
        <meshStandardMaterial {...MATERIALS.housing} />
      </mesh>
    </group>
  )
}

function CoilMarker({ reel }: { reel: 'DTR' | 'ETR' | 'POR' }) {
  const ref = useRef<Mesh>(null)

  useTwinFrame((v) => {
    const mesh = ref.current
    if (!mesh) return
    const radiusMm = reel === 'DTR' ? v.dtrRadius : reel === 'ETR' ? v.etrRadius : v.porRadius
    const radius = Math.max(mmToScene(radiusMm), SCENE.mandrelRadius * 1.02)
    // Ride the marker on the coil's outer surface as the diameter changes.
    mesh.position.z = radius * 0.99
    mesh.scale.y = Math.max(mmToScene(v.stripWidth), 0.05) * 0.98
  })

  return (
    <mesh ref={ref} position={[0, 0, 0.5]}>
      <boxGeometry args={[0.035, 1, 0.012]} />
      <meshStandardMaterial {...MATERIALS.coilEdge} />
    </mesh>
  )
}
