/**
 * TENSION VISUALISATION — §10.3: `tension.entry/exit -> strip tautness`.
 *
 * The strip mesh itself carries the tautness (droop). This component adds the
 * directional cue: a run of chevrons along each span pointing the way the strip
 * is being pulled, with intensity from the tension and direction from the
 * rolling direction.
 *
 * Both chevron runs reverse together on a direction change, because both read
 * the same `directionSign` the rolls and reels read.
 */

import { useMemo, useRef } from 'react'
import { Color, type InstancedMesh, type MeshStandardMaterial, Object3D } from 'three'
import { useTwinFrame } from './TwinContext'
import { LINE, SCENE_COLORS } from './twinMaterials'

const CHEVRONS_PER_SPAN = 7
const dummy = new Object3D()

const COLOR_ENTRY = new Color(SCENE_COLORS.entry)
const COLOR_EXIT = new Color(SCENE_COLORS.exit)

export function TensionSystem() {
  return (
    <group>
      <ChevronRun sideX={-1} />
      <ChevronRun sideX={1} />
    </group>
  )
}

/**
 * One span's chevrons, drawn as a single instanced mesh so seven markers cost
 * one draw call rather than seven (§15).
 */
function ChevronRun({ sideX }: { sideX: -1 | 1 }) {
  const meshRef = useRef<InstancedMesh>(null)
  const spanLength = Math.abs(sideX === -1 ? LINE.etrX : LINE.dtrX)

  const offsets = useMemo(
    () =>
      Array.from({ length: CHEVRONS_PER_SPAN }, (_, i) => {
        const t = (i + 1) / (CHEVRONS_PER_SPAN + 1)
        return sideX * spanLength * t
      }),
    [sideX, spanLength],
  )

  useTwinFrame((v) => {
    const mesh = meshRef.current
    if (!mesh) return

    const isEntrySide = v.direction === 'FORWARD' ? sideX === -1 : sideX === 1
    const tension = isEntrySide ? v.entryTensionNormalised : v.exitTensionNormalised

    // Chevrons point the way the strip travels.
    const pointing = v.directionSign >= 0 ? 1 : -1
    const scale = 0.5 + tension * 0.8

    for (let i = 0; i < offsets.length; i++) {
      dummy.position.set(offsets[i], 0.19, 0)
      dummy.rotation.set(0, 0, pointing > 0 ? -Math.PI / 2 : Math.PI / 2)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    const material = mesh.material as MeshStandardMaterial
    material.color.copy(isEntrySide ? COLOR_ENTRY : COLOR_EXIT)
    material.emissive.copy(isEntrySide ? COLOR_ENTRY : COLOR_EXIT)
    material.emissiveIntensity = 0.18 + tension * 0.3
    material.opacity = 0.2 + tension * 0.45

    // Nothing is being pulled when the strip is not moving.
    mesh.visible = v.animate && tension > 0.02
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CHEVRONS_PER_SPAN]}>
      <coneGeometry args={[0.055, 0.13, 4]} />
      <meshStandardMaterial transparent opacity={0.4} depthWrite={false} />
    </instancedMesh>
  )
}
