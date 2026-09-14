/**
 * MILL ENCLOSURE, HOOD AND FUME DUCTING — §6.10 and §9.4.
 *
 * Drawings EU 15 4 A1 (enclosure with front shutter), EU 15 5 A1 (hoods either
 * side), EU 15 6 A1 (oil catcher), EU 45 0 A1 (fume exhaust). The 40,000 m³/hr
 * centrifugal blower draws through these hoods to the discharge stack.
 *
 * TRANSPARENT, deliberately. On the real mill the shutter is closed during
 * rolling and the operator genuinely cannot see the bite — that is what the
 * enclosure is for. A twin that reproduced that faithfully would defeat its own
 * purpose, so the enclosure is drawn as glass: the containment is visible as
 * structure without becoming the opaque box it is in the plant.
 *
 * It is also hidden entirely in the STAND view, which is the view an engineer
 * uses precisely because they want the enclosure out of the way.
 *
 * STATIC. §6.10 records that the shutter is MANUALLY operated, so there is no
 * signal for it to follow even in principle.
 */

import { useUiStore } from '../../store/uiStore'
import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

export function MillEnclosure() {
  const view = useUiStore((s) => s.cameraView)
  // The close view exists to see the roll stack. Nothing may stand in front of it.
  if (view === 'STAND') return null

  const width = Math.abs(LINE.entryAirKnifeX) * 2 + mmToScene(1400)
  const depth = SCENE.housingZ * 2 + mmToScene(900)
  const top = SCENE.housingTop + mmToScene(700)

  return (
    <group raycast={() => {}}>
      {/* Enclosure walls, front and back. */}
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, (top + SCENE.floorY) / 2, z * (depth / 2)]}>
          <boxGeometry args={[width, top - SCENE.floorY, 0.02]} />
          <meshStandardMaterial
            {...MATERIALS.enclosure}
            transparent
            opacity={0.13}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* End walls. */}
      {[-1, 1].map((x) => (
        <mesh key={`end-${x}`} position={[x * (width / 2), (top + SCENE.floorY) / 2, 0]}>
          <boxGeometry args={[0.02, top - SCENE.floorY, depth]} />
          <meshStandardMaterial
            {...MATERIALS.enclosure}
            transparent
            opacity={0.13}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Frame members, so the enclosure reads as structure and not as haze. */}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`post-${x}-${z}`}
            position={[x * (width / 2), (top + SCENE.floorY) / 2, z * (depth / 2)]}
            castShadow
          >
            <boxGeometry args={[0.07, top - SCENE.floorY, 0.07]} />
            <meshStandardMaterial {...MATERIALS.housingTrim} />
          </mesh>
        )),
      )}

      {/* Hoods either side of the mill, discharging fume outside (§6.10). */}
      {[-1, 1].map((x) => (
        <group key={`hood-${x}`} position={[x * (width * 0.3), top, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width * 0.3, mmToScene(400), depth * 0.7]} />
            <meshStandardMaterial {...MATERIALS.duct} />
          </mesh>
          {/* Ducting up to the discharge stack. */}
          <mesh position={[0, mmToScene(700), 0]} castShadow>
            <cylinderGeometry args={[mmToScene(280), mmToScene(280), mmToScene(1000), 16]} />
            <meshStandardMaterial {...MATERIALS.duct} />
          </mesh>
        </group>
      ))}

      {/* Cross duct joining the two hoods to the blower run. */}
      <mesh
        position={[0, top + mmToScene(1200), 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[mmToScene(300), mmToScene(300), width * 0.65, 16]} />
        <meshStandardMaterial {...MATERIALS.duct} />
      </mesh>
    </group>
  )
}
