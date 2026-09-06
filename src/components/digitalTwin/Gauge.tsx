/**
 * X-RAY THICKNESS GAUGE — the C-frames either side of the stand.
 *
 * Both gauges exist on the real CRM04 feed, which makes them one of the few
 * parts of the twin whose readings are genuinely MEASURED. The frame lights when
 * the gauge is ready and goes inert when it is not — the GAUGE_NOT_READY
 * scenario is visible in the scene, not only in the interlock panel (§13.2).
 */

import { useRef } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
import { useFrame } from '@react-three/fiber'
import { useMachineStore } from '../../store/machineStore'
import { MATERIALS, SCENE, SCENE_COLORS } from './twinMaterials'

interface Props {
  gauge: 'DTR' | 'ETR'
}

export function Gauge({ gauge }: Props) {
  const headRef = useRef<Mesh>(null)
  const x = gauge === 'ETR' ? SCENE.gaugeX : -SCENE.gaugeX

  // Gauge readiness changes rarely, so a selector subscription is the right
  // tool here — this is not a per-frame value.
  const ready = useMachineStore((s) =>
    gauge === 'ETR' ? s.state.gauges.etr.ready : s.state.gauges.dtr.ready,
  )

  useFrame(() => {
    const head = headRef.current
    if (!head) return
    const material = head.material as MeshStandardMaterial
    // `null` means NO TAG: neither ready nor not-ready is claimed.
    const target = ready === true ? 0.45 : 0
    material.emissiveIntensity += (target - material.emissiveIntensity) * 0.1
    material.color.set(
      ready === true ? SCENE_COLORS.healthy : ready === false ? SCENE_COLORS.warning : MATERIALS.gaugeHead.color,
    )
  })

  const frameHeight = 0.95
  const armDepth = SCENE.barrelLength * 0.75

  return (
    <group position={[x, 0, 0]}>
      {/* C-frame: upright plus upper and lower arms straddling the pass line. */}
      <mesh position={[0, 0, -armDepth / 2 - 0.16]} castShadow receiveShadow>
        <boxGeometry args={[0.16, frameHeight, 0.18]} />
        <meshStandardMaterial {...MATERIALS.gaugeFrame} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * frameHeight * 0.4, -0.08]} castShadow>
          <boxGeometry args={[0.14, 0.12, armDepth * 0.55]} />
          <meshStandardMaterial {...MATERIALS.gaugeFrame} />
        </mesh>
      ))}

      {/* Source / detector heads above and below the strip. */}
      <mesh ref={headRef} position={[0, frameHeight * 0.26, 0]} castShadow>
        <boxGeometry args={[0.12, 0.1, 0.14]} />
        <meshStandardMaterial
          {...MATERIALS.gaugeHead}
          emissive={SCENE_COLORS.healthy}
          emissiveIntensity={0}
        />
      </mesh>
      <mesh position={[0, -frameHeight * 0.26, 0]} castShadow>
        <boxGeometry args={[0.12, 0.1, 0.14]} />
        <meshStandardMaterial {...MATERIALS.gaugeHead} />
      </mesh>
    </group>
  )
}
