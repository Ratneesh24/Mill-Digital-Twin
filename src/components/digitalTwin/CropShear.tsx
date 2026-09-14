/**
 * CROP SHEAR — §5.7, drawing EU 28 4 A1.
 *
 * Down-cut, hydraulically operated, on the delivery side. The leader and tail
 * ends are not normally cut; the shear is used to square ends and after a strip
 * breakage (§12.3 step 11, §12.5 step 5).
 *
 * The blade is rectangular in section so all four edges are usable before
 * regrinding, the top blade is bolted to the upper carrier at a rake angle, and
 * the bottom blade is fixed below the pass line.
 *
 * QUANTITY IS AN OPEN ITEM. Chapter 2 of the manual lists ONE shear, at delivery.
 * Chapter 5 heading says two. The drawing register carries only EU 28 4 A1, the
 * exit shear — yet the §12.5 tail-transfer sequence requires an entry-side cut.
 * The twin models the one the drawing register can prove, and the contradiction
 * is carried as open item 5 rather than resolved by guessing.
 *
 * STATIC, drawn OPEN with the top knife raised. §5.7 also records that the top
 * knife holder must be LOCKED during any work at the shear, which is the reason
 * a shear is never drawn closed unless something is actually cutting.
 */

import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

const FRAME_WIDTH = mmToScene(760)
const BLADE_LENGTH = mmToScene(700)
const FRAME_HEIGHT = mmToScene(1200)

export function CropShear() {
  return (
    <group position={[LINE.cropShearX, 0, 0]}>
      {/* Main frame — two uprights straddling the pass line. */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          position={[0, FRAME_HEIGHT / 2 - mmToScene(300), z * (FRAME_WIDTH / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.22, FRAME_HEIGHT, 0.2]} />
          <meshStandardMaterial {...MATERIALS.shearFrame} />
        </mesh>
      ))}
      {/* Head beam carrying the cylinder. */}
      <mesh
        position={[0, FRAME_HEIGHT - mmToScene(300), 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.24, 0.22, FRAME_WIDTH + 0.2]} />
        <meshStandardMaterial {...MATERIALS.shearFrame} />
      </mesh>

      {/* Hydraulic cylinder, Ø160 × 125 stroke (Table I item 11). */}
      <mesh position={[0, FRAME_HEIGHT - mmToScene(520), 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
        <meshStandardMaterial {...MATERIALS.hydraulic} />
      </mesh>

      {/*
        Upper carrier with the top blade, raised. The blade sits at a rake angle,
        which is what makes a down-cut shear cut progressively across the width
        rather than all at once.
      */}
      <group position={[0, mmToScene(340), 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.16, BLADE_LENGTH + 0.1]} />
          <meshStandardMaterial {...MATERIALS.shearFrame} />
        </mesh>
        <mesh position={[0, -0.1, 0]} rotation={[0.05, 0, 0]} castShadow>
          <boxGeometry args={[0.05, 0.05, BLADE_LENGTH]} />
          <meshStandardMaterial {...MATERIALS.shearBlade} />
        </mesh>
      </group>

      {/* Fixed bottom blade in its holder, set into the frame below the pass line. */}
      <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.05, BLADE_LENGTH]} />
        <meshStandardMaterial {...MATERIALS.shearBlade} />
      </mesh>
      <mesh position={[0, -0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.18, BLADE_LENGTH + 0.1]} />
        <meshStandardMaterial {...MATERIALS.shearFrame} />
      </mesh>

      {/* Legs to the floor. */}
      {[-1, 1].map((z) => (
        <mesh
          key={`leg-${z}`}
          position={[0, SCENE.floorY / 2 - mmToScene(150), z * (FRAME_WIDTH / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.26, Math.abs(SCENE.floorY) - mmToScene(300), 0.24]} />
          <meshStandardMaterial {...MATERIALS.shearFrame} />
        </mesh>
      ))}
    </group>
  )
}
