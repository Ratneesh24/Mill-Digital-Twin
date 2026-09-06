/**
 * MILL HOUSING / STAND — the static structure the roll stack sits in.
 *
 * Nothing here animates: the housing is the one part of a mill that genuinely
 * does not move, and §10.3's rule is "no meaningless animation — every moving
 * object represents a machine parameter".
 *
 * It does react to one thing: when an alarm names the STAND or ROLL_BITE, the
 * structure picks up an alarm-coloured emissive tint so the operator's eye is
 * taken to the right part of the machine (§17 test 7).
 */

import { useRef } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
import { useFrame } from '@react-three/fiber'
import { useAlarmStore } from '../../store/alarmStore'
import { MATERIALS, SCENE, SCENE_COLORS } from './twinMaterials'

export function MillStand() {
  const postHeight = SCENE.housingTop - SCENE.housingBottom
  const postCentreY = (SCENE.housingTop + SCENE.housingBottom) / 2
  const postWidth = 0.34
  const postDepth = 0.4

  return (
    <group>
      {/* Two housings, one on the operator side and one on the drive side. */}
      {[-1, 1].map((z) =>
        [-1, 1].map((x) => (
          <mesh
            key={`${z}-${x}`}
            position={[x * SCENE.housingPostX, postCentreY, z * SCENE.housingZ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[postWidth, postHeight, postDepth]} />
            <meshStandardMaterial {...MATERIALS.housing} />
          </mesh>
        )),
      )}

      {/* Top and bottom cross beams closing each housing window. */}
      {[-1, 1].map((z) =>
        [SCENE.housingTop, SCENE.housingBottom].map((y) => (
          <mesh key={`${z}-${y}`} position={[0, y, z * SCENE.housingZ]} castShadow receiveShadow>
            <boxGeometry args={[SCENE.housingPostX * 2 + postWidth, 0.36, postDepth]} />
            <meshStandardMaterial {...MATERIALS.housingTrim} />
          </mesh>
        )),
      )}

      {/* Tie beams front-to-back across the top of the stand. */}
      {[-1, 1].map((x) => (
        <mesh
          key={x}
          position={[x * SCENE.housingPostX, SCENE.housingTop, 0]}
          castShadow
        >
          <boxGeometry args={[postWidth * 0.8, 0.22, SCENE.housingZ * 2]} />
          <meshStandardMaterial {...MATERIALS.housingTrim} />
        </mesh>
      ))}

      <StandAlarmGlow />
      <Floor />
    </group>
  )
}

/**
 * A dim panel behind the roll stack that lifts to alarm colour when the stand or
 * the roll bite is in alarm. Subtle by design — §10.5 forbids excessive glow.
 */
function StandAlarmGlow() {
  const ref = useRef<Mesh>(null)
  const sections = useAlarmStore((s) => s.highlightedSections)
  const active = sections.includes('STAND') || sections.includes('ROLL_BITE')

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const material = mesh.material as MeshStandardMaterial
    const target = active ? 0.16 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06 : 0
    material.opacity += (target - material.opacity) * 0.08
    mesh.visible = material.opacity > 0.005
  })

  return (
    <mesh ref={ref} position={[0, 0, -SCENE.housingZ - 0.22]} visible={false}>
      <planeGeometry args={[SCENE.housingPostX * 2.4, SCENE.housingTop - SCENE.housingBottom]} />
      <meshStandardMaterial
        color={SCENE_COLORS.alarm}
        emissive={SCENE_COLORS.alarm}
        emissiveIntensity={0.8}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * Light mill floor, sized just past the reels to ground the equipment without
 * hiding the pass-line silhouette. It is not a selectable machine part.
 */
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SCENE.floorY, 0]} receiveShadow raycast={() => {}}>
      <planeGeometry args={[SCENE.reelX * 2 + 4, 9]} />
      <meshStandardMaterial {...MATERIALS.floor} />
    </mesh>
  )
}
