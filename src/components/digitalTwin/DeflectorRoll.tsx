/**
 * DEFLECTOR ROLL AND THREADING TABLE — §5.6, drawings EU 10 5 A1 / EU 28 5 A1.
 *
 * Single Ø300 x 600 alloy steel roll each side of the stand, on spherical roller
 * bearings in blocks fixed to the entry/exit table frame. It turns the strip from
 * the reel onto the pass line and back.
 *
 * This is the ONE new part on the line that animates, and it earns it twice over:
 *
 *  1. The strip wraps it, so its surface speed IS the strip speed. Rotating it
 *     from `stripTravel` is not decoration, it is the same binding the work rolls
 *     use — zero speed necessarily means a stationary roll.
 *  2. §5.6 puts ENCODERS on both the operator side and the drive side of this
 *     roll, and those encoders are a speed feedback into the AGC. Of everything
 *     on the auxiliary line this is the part the control system actually reads.
 *
 * Which side is entry and which is delivery swaps with rolling direction, but the
 * rolls themselves do not move — both are driven by the same strip, so both are
 * rotated from the same travel.
 */

import { useRef } from 'react'
import type { Group } from 'three'
import { mmToScene } from '../../config/unitConversion'
import { useTwinFrame } from './TwinContext'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

/** §5.6: single deflector roll, Ø300 x 600 barrel, alloy steel. */
const ROLL_RADIUS = mmToScene(300 / 2)
const ROLL_BARREL = mmToScene(600)

interface Props {
  /** Which physical station — not which process role. */
  station: 'ENTRY' | 'DELIVERY'
}

export function DeflectorRoll({ station }: Props) {
  const spinRef = useRef<Group>(null)
  const x = station === 'ENTRY' ? LINE.entryDeflectorX : LINE.deliveryDeflectorX

  useTwinFrame((v) => {
    const spin = spinRef.current
    if (!spin) return
    // Surface speed = strip speed. `stripTravel` is metres of strip, already
    // signed by direction and damped by the twin engine, so the roll reverses
    // with the mill and never snaps.
    const travel = station === 'ENTRY' ? v.stripTravelEntry : v.stripTravel
    spin.rotation.y = travel / ROLL_RADIUS
  })

  return (
    <group position={[x, 0, 0]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={spinRef}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[ROLL_RADIUS, ROLL_RADIUS, ROLL_BARREL, 32]} />
            <meshStandardMaterial {...MATERIALS.deflectorRoll} />
          </mesh>
          {/* Marker so the rotation reads on a smooth barrel, as on the rolls. */}
          <mesh position={[0, ROLL_BARREL / 2 + 0.001, ROLL_RADIUS * 0.6]} castShadow>
            <boxGeometry args={[0.028, 0.008, ROLL_RADIUS * 0.5]} />
            <meshStandardMaterial {...MATERIALS.rollMarker} />
          </mesh>
        </group>
      </group>

      {/* Bearing blocks — spherical roller, fixed to the table frame. */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          position={[0, 0, z * (ROLL_BARREL / 2 + 0.09)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[ROLL_RADIUS * 1.5, ROLL_RADIUS * 1.5, 0.18]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
        </mesh>
      ))}

      {/*
        Encoders on BOTH operator and drive side (§5.6). Two of them, because the
        AGC reads both — the same OS/DS split the mill carries everywhere else.
      */}
      {[-1, 1].map((z) => (
        <mesh
          key={`enc-${z}`}
          position={[0, 0, z * (ROLL_BARREL / 2 + 0.24)]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.05, 0.05, 0.12, 14]} />
          <meshStandardMaterial {...MATERIALS.gaugeHead} />
        </mesh>
      ))}

      {/* Table frame down to the floor. */}
      {[-1, 1].map((z) => (
        <mesh
          key={`leg-${z}`}
          position={[0, SCENE.floorY / 2 - ROLL_RADIUS / 2, z * (ROLL_BARREL / 2 + 0.09)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.16, Math.abs(SCENE.floorY) - ROLL_RADIUS, 0.16]} />
          <meshStandardMaterial {...MATERIALS.housing} />
        </mesh>
      ))}

      {/*
        Threading table, lowered. It is raised to the pass line only while
        threading (§12.2 step 3, §12.5 step 8) and lowered for rolling.
      */}
      <mesh position={[0, -ROLL_RADIUS * 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[ROLL_RADIUS * 3.5, 0.05, ROLL_BARREL * 0.9]} />
        <meshStandardMaterial {...MATERIALS.coilCar} />
      </mesh>
    </group>
  )
}
