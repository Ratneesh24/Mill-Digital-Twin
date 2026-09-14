/**
 * PEELER UNIT / COIL OPENER — §5.3, drawing EU 05 1 A1.
 *
 * Mounted on the flattener unit frame. Its replaceable steel knife enters under
 * the coil end to cut the bands, then the table supports the strip front edge up
 * to the pinch roll cum flattener during threading, and is swung back and
 * retracted once the nose is through (§12.1 steps 11-12, §12.2 step 2).
 *
 * STATIC, and drawn RETRACTED — which is where it is during rolling. Its two
 * cylinders are on the low-pressure auxiliary circuit with no position feedback
 * on this feed, so there is nothing to animate it from.
 */

import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

const TABLE_WIDTH = mmToScene(700)
const TABLE_LENGTH = mmToScene(900)

export function PeelerUnit() {
  return (
    <group position={[LINE.peelerX, SCENE.floorY * 0.35, 0]}>
      {/* Peeler table, swung back to its parked angle. */}
      <group rotation={[0, 0, -0.35]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[TABLE_LENGTH, 0.05, TABLE_WIDTH]} />
          <meshStandardMaterial {...MATERIALS.coilCar} />
        </mesh>

        {/*
          Replaceable steel knife at the front (§5.3). Its edge sharpness is
          checked once or twice a year — one of the few maintenance items on the
          line that is purely a hand operation.
        */}
        <mesh position={[TABLE_LENGTH / 2 + 0.04, 0.008, 0]} castShadow>
          <boxGeometry args={[0.09, 0.022, TABLE_WIDTH * 0.94]} />
          <meshStandardMaterial {...MATERIALS.shearBlade} />
        </mesh>
      </group>

      {/* Elevating and traversing cylinders, mounted off the flattener frame. */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          position={[-TABLE_LENGTH * 0.3, -0.22, z * TABLE_WIDTH * 0.36]}
          rotation={[0, 0, 0.5]}
          castShadow
        >
          <cylinderGeometry args={[0.045, 0.045, 0.42, 12]} />
          <meshStandardMaterial {...MATERIALS.hydraulic} />
        </mesh>
      ))}

      {/* Support bracket back to the flattener housing. */}
      <mesh position={[-TABLE_LENGTH * 0.55, -0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.5, TABLE_WIDTH * 0.8]} />
        <meshStandardMaterial {...MATERIALS.housing} />
      </mesh>
    </group>
  )
}
