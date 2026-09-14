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
import { LINE, MATERIALS, SCENE, SCENE_COLORS } from './twinMaterials'

/**
 * §6.1: "Operator-side and drive-side housings are made SEPARATELY; each has a
 * central window for inserting the rolls. Both housings connected by a separator
 * at the top and back-up roll change rails at the bottom."
 *
 * That is the structure this component now draws: two independent frames, joined
 * only at the top and at floor level, with replaceable liners on the inner faces
 * of each window.
 */
export function MillStand() {
  const postHeight = SCENE.housingTop - SCENE.housingBottom
  const postCentreY = (SCENE.housingTop + SCENE.housingBottom) / 2
  const postWidth = SCENE.burRadius * 0.52
  const postDepth = SCENE.barrelLength * 0.42
  const beamHeight = SCENE.burRadius * 0.5
  const windowSpan = SCENE.housingPostX * 2 + postWidth

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

      {/*
        Replaceable steel plate liners on the inner faces of each housing window
        (§6.1 item 3) — the surfaces the roll chocks actually slide on, and the
        ones the weekly grease schedule (§11.1) exists for.

        Only as tall as the chocks actually travel. Running them the full height
        of the post makes them read as dark slabs across the window, which hides
        the roll stack the view exists to show.
      */}
      {[-1, 1].map((z) =>
        [-1, 1].map((x) => (
          <mesh
            key={`liner-${z}-${x}`}
            position={[
              x * (SCENE.housingPostX - postWidth / 2 - 0.008),
              0,
              z * SCENE.housingZ,
            ]}
            castShadow
          >
            <boxGeometry args={[0.016, SCENE.burRadius * 3.4, postDepth * 0.55]} />
            <meshStandardMaterial {...MATERIALS.workRollChock} />
          </mesh>
        )),
      )}

      {/* Top and bottom cross beams closing each housing window. */}
      {[-1, 1].map((z) =>
        [SCENE.housingTop, SCENE.housingBottom].map((y) => (
          <mesh key={`${z}-${y}`} position={[0, y, z * SCENE.housingZ]} castShadow receiveShadow>
            <boxGeometry args={[windowSpan, beamHeight, postDepth]} />
            <meshStandardMaterial {...MATERIALS.housingTrim} />
          </mesh>
        )),
      )}

      {/*
        Separator at the top (§6.1 item 2) — the single member tying the two
        otherwise separate housings together, spanning the full barrel.
      */}
      <mesh position={[0, SCENE.housingTop + beamHeight * 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[windowSpan * 0.8, beamHeight * 0.7, SCENE.housingZ * 2 + postDepth]} />
        <meshStandardMaterial {...MATERIALS.housingTrim} />
      </mesh>

      {/*
        Back-up roll change rails at the bottom (§6.1 item 2, §6.9). They run out
        of the housing on the operator side, which is the direction the roll
        changing car travels.
      */}
      {[-1, 1].map((z) => (
        <mesh
          key={`rail-${z}`}
          position={[0, SCENE.housingBottom + beamHeight * 0.62, z * SCENE.housingZ * 0.66]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[windowSpan * 2.6, 0.05, 0.09]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
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
    <mesh ref={ref} position={[0, 0, -SCENE.housingZ - 0.18]} visible={false}>
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
 * Light mill floor, spanning the whole line from the pay-off reel to the delivery
 * tension reel with a margin either end. It is not a selectable machine part.
 *
 * The floor is at `passLineHeight` below the pass line, so the reels, the coil
 * cars and the stand all stand on one surface rather than each choosing its own
 * ground.
 */
function Floor() {
  const width = LINE.maxX - LINE.minX + 5
  const centreX = (LINE.maxX + LINE.minX) / 2
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[centreX, SCENE.floorY, 0]}
      receiveShadow
      raycast={() => {}}
    >
      <planeGeometry args={[width, 9]} />
      <meshStandardMaterial {...MATERIALS.floor} />
    </mesh>
  )
}
