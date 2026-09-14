/**
 * ROLL FORCE VISUALISATION — §10.3.
 *
 * "rollingForce.actual -> force arrows at bite, load gauge, subtle loading
 *  intensity"
 *
 * Two arrows press in on the bite from above and below, sized and coloured by
 * the force as a fraction of the mill's maximum. The colour crosses into
 * warning and alarm at exactly the thresholds the alarm engine uses, so the
 * picture and the alarm list can never disagree.
 *
 * On the 46-tag CRM04 feed this value is ESTIMATED from drive torque. The
 * arrows are drawn with a hollow outline in that case, so the operator can see
 * at a glance that the loading shown is inferred rather than measured (§7.3).
 */

import { useRef } from 'react'
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { engineeringConfig } from '../../config/engineeringConfig'
import { millConfig } from '../../config/millConfig'
import { rollGapToScene } from '../../config/unitConversion'
import { useMachineStore } from '../../store/machineStore'
import { useUiStore } from '../../store/uiStore'
import { useTwinFrame } from './TwinContext'
import { SCENE, SCENE_COLORS, workRollCentreY } from './twinMaterials'

const WARNING_FRACTION = engineeringConfig.forceLimits.warning / millConfig.ratings.maxRollingForce
const ALARM_FRACTION = engineeringConfig.forceLimits.alarm / millConfig.ratings.maxRollingForce

const COLOR_NORMAL = new Color(SCENE_COLORS.normal)
const COLOR_WARNING = new Color(SCENE_COLORS.warning)
const COLOR_ALARM = new Color(SCENE_COLORS.alarm)

export function ForceVisualization() {
  const visible = useUiStore((s) => s.showForceArrows)
  // Whether the force is measured or inferred is a property of the tag, so it
  // is read from the tag rather than from the operating mode.
  const provenance = useMachineStore((s) => s.tags['ROLL.FORCE.ACTUAL']?.provenance)
  const estimated = provenance === 'ESTIMATED' || provenance === 'SIMULATED'

  if (!visible) return null

  return (
    <group>
      <ForceArrow side="UPPER" estimated={estimated} />
      <ForceArrow side="LOWER" estimated={estimated} />
    </group>
  )
}

function ForceArrow({ side, estimated }: { side: 'UPPER' | 'LOWER'; estimated: boolean }) {
  const groupRef = useRef<Group>(null)
  const shaftRef = useRef<Mesh>(null)
  const headRef = useRef<Mesh>(null)

  useTwinFrame((v) => {
    const group = groupRef.current
    const shaft = shaftRef.current
    const head = headRef.current
    if (!group || !shaft || !head) return

    const f = v.forceNormalised
    // Arrows start just outside the work roll surface and point at the bite.
    const rollSurface = Math.abs(workRollCentreY(rollGapToScene(v.rollGap), side))
    const base = rollSurface + SCENE.wrRadius * 0.15
    // Scaled to the work roll, not to an absolute scene length: on a Ø215 roll
    // an arrow sized for a wide mill would be longer than the whole stack.
    const length = SCENE.wrRadius * (0.7 + f * 4.0)

    // The arrow is modelled pointing along local -Y. The upper one therefore
    // needs no rotation; the lower one is flipped so both point AT the bite.
    group.position.y = side === 'UPPER' ? base + length / 2 : -(base + length / 2)
    group.rotation.z = side === 'UPPER' ? 0 : Math.PI

    shaft.scale.y = length
    shaft.scale.x = 0.4 + f * 0.9
    shaft.scale.z = 0.4 + f * 0.9
    head.position.y = -length / 2
    head.scale.setScalar(0.5 + f * 0.9)

    const color =
      f >= ALARM_FRACTION ? COLOR_ALARM : f >= WARNING_FRACTION ? COLOR_WARNING : COLOR_NORMAL

    for (const mesh of [shaft, head]) {
      const material = mesh.material as MeshStandardMaterial
      material.color.copy(color)
      material.emissive.copy(color)
      // Estimated force reads as a hollow, dimmer arrow — visibly less
      // confident than a measured one.
      material.emissiveIntensity = estimated ? 0.12 : 0.3
      material.opacity = estimated ? 0.42 : 0.78
      material.wireframe = estimated
    }
    group.visible = f > 0.005
  })

  return (
    <group ref={groupRef}>
      <mesh ref={shaftRef}>
        <cylinderGeometry args={[SCENE.wrRadius * 0.22, SCENE.wrRadius * 0.22, 1, 12]} />
        <meshStandardMaterial transparent opacity={0.75} depthWrite={false} />
      </mesh>
      {/* Cone apex points +Y by default; flip it so the arrow reads downward. */}
      <mesh ref={headRef} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[SCENE.wrRadius * 0.48, SCENE.wrRadius * 0.95, 14]} />
        <meshStandardMaterial transparent opacity={0.75} depthWrite={false} />
      </mesh>
    </group>
  )
}
