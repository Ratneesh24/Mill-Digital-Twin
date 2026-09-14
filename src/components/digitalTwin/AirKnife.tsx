/**
 * AIR KNIFE WIPER ASSEMBLY — §5.9, drawings EU 10 2 A1 / EU 28 2 A1.
 *
 * One each at mill entry and delivery, blowing coolant off the strip as it leaves
 * the bite. The knives are positioned independently by turnbuckle and raised and
 * lowered by a Schrader pneumatic cylinder at 4-5 bar.
 *
 * §5.9 carries the number that matters: a CONSTANT GAP OF 0.1-0.3 mm must be
 * maintained between the knife and the strip, checked periodically. That gap is
 * far too small to draw at true scale, so the knives are drawn at the strip
 * surface — the same honesty problem the strip section has, and handled the same
 * way: the geometry is approximate, the stated number is not.
 *
 * STATIC. Pneumatic, no position feedback, nothing to bind to.
 */

import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

const HEADER_LENGTH = mmToScene(620)

interface Props {
  station: 'ENTRY' | 'DELIVERY'
}

export function AirKnife({ station }: Props) {
  const x = station === 'ENTRY' ? LINE.entryAirKnifeX : LINE.deliveryAirKnifeX

  return (
    <group position={[x, 0, 0]}>
      {/* Upper and lower knife headers, straddling the pass line. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, s * mmToScene(120), 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.07, 0.06, HEADER_LENGTH]} />
            <meshStandardMaterial {...MATERIALS.airKnife} />
          </mesh>
          {/* The knife lip itself, angled at the strip. */}
          <mesh position={[0, -s * 0.045, 0]} rotation={[0, 0, s * 0.5]} castShadow>
            <boxGeometry args={[0.05, 0.014, HEADER_LENGTH * 0.98]} />
            <meshStandardMaterial {...MATERIALS.hydraulicRod} />
          </mesh>

          {/* Turnbuckle setting the knife position independently, per §5.9. */}
          <mesh position={[0, s * 0.09, HEADER_LENGTH * 0.42]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
            <meshStandardMaterial {...MATERIALS.hydraulicRod} />
          </mesh>

          {/* Schrader pneumatic cylinder raising and lowering the knife. */}
          <mesh position={[0, s * 0.19, -HEADER_LENGTH * 0.42]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 14]} />
            <meshStandardMaterial {...MATERIALS.hydraulic} />
          </mesh>
        </group>
      ))}

      {/* Support frame from the floor. */}
      {[-1, 1].map((z) => (
        <mesh
          key={`leg-${z}`}
          position={[0, SCENE.floorY / 2, z * HEADER_LENGTH * 0.52]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.09, Math.abs(SCENE.floorY), 0.09]} />
          <meshStandardMaterial {...MATERIALS.airKnife} />
        </mesh>
      ))}
    </group>
  )
}
