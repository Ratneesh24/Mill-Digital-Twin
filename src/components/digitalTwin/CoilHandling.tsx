/**
 * COIL CARS AND STORAGE SADDLES — §5.1 and §8, drawings EU 02 0/1 A1.
 *
 * Three identical pit-mounted coil cars, one at each of POR, ETR and DTR, each
 * with a welded steel Vee-platten elevator faced in hard nylon, riding on a
 * carriage traversed by a Danfoss OMP-315 hydraulic motor over 3400 mm of travel.
 * Beside each is a Vee-platten storage saddle holding two full-width coils.
 *
 * STATIC, and drawn RETRACTED with the elevator down. That is not a default — it
 * is the machine's rule: §8 states "coil cars must be in the retracted position
 * during rolling", and §12.7 note repeats it. Drawing them anywhere else would
 * show a condition that cannot coexist with a mill that is running.
 *
 * The pit is real too. §7.4 records that the lower portion of the tension reel
 * drum sits over the coil car pit, which is why maintenance there needs a
 * temporary footing.
 */

import { mmToScene } from '../../config/unitConversion'
import { LINE, MATERIALS, SCENE } from './twinMaterials'

const CAR_WIDTH = mmToScene(900)
const CAR_LENGTH = mmToScene(1100)
const SADDLE_WIDTH = mmToScene(1400)

/** Every station that has a coil car and a storage saddle. */
const STATIONS = [
  { id: 'POR', x: LINE.porX },
  { id: 'ETR', x: LINE.etrX },
  { id: 'DTR', x: LINE.dtrX },
] as const

export function CoilHandling() {
  return (
    <group>
      {STATIONS.map((station) => (
        <group key={station.id} position={[station.x, 0, 0]}>
          <CoilCar />
          <CoilSaddle />
        </group>
      ))}
    </group>
  )
}

/**
 * Pit-mounted coil car, retracted. The pit floor is below the mill floor, so the
 * carriage sits in a recess rather than on the slab.
 */
function CoilCar() {
  const pitDepth = mmToScene(700)
  // The carriage rides low in the pit with its deck close to floor level, which
  // is how a pit-mounted car actually presents: what you see walking the line is
  // the deck and the Vee platten, not the carriage. Sinking it to the pit floor
  // hides the whole car under an opaque slab and models something nobody can see.
  const carY = SCENE.floorY - mmToScene(180)

  return (
    <group position={[0, 0, LINE.saddleZ * 0.42]}>
      {/* The pit the car runs in. */}
      <mesh position={[0, SCENE.floorY - pitDepth / 2, 0]} receiveShadow>
        <boxGeometry args={[CAR_LENGTH + 0.4, pitDepth, LINE.coilCarTravel]} />
        <meshStandardMaterial {...MATERIALS.floor} />
      </mesh>

      {/* Carriage on wheels, running on foundation-mounted steel tracks. */}
      <mesh position={[0, carY, 0]} castShadow receiveShadow>
        <boxGeometry args={[CAR_LENGTH, mmToScene(300), CAR_WIDTH]} />
        <meshStandardMaterial {...MATERIALS.coilCar} />
      </mesh>

      {/* Foundation-mounted steel tracks the carriage wheels run on. */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          position={[0, carY - mmToScene(170), z * CAR_WIDTH * 0.42]}
          receiveShadow
        >
          <boxGeometry args={[0.06, 0.06, LINE.coilCarTravel]} />
          <meshStandardMaterial {...MATERIALS.workRollChock} />
        </mesh>
      ))}

      {/*
        Vee-platten elevator, lowered. Its hard nylon facings are what actually
        touch the coil — steel on a cold-rolled surface would mark it.
      */}
      <group position={[0, carY + mmToScene(200), 0]}>
        {[-1, 1].map((z) => (
          <mesh
            key={z}
            position={[0, 0, z * mmToScene(220)]}
            rotation={[z * 0.6, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[CAR_LENGTH * 0.8, 0.04, mmToScene(360)]} />
            <meshStandardMaterial {...MATERIALS.nylonFacing} />
          </mesh>
        ))}
      </group>

      {/* Elevator cylinder, Ø160 × 800 stroke (Table I item 1). */}
      <mesh position={[0, carY + mmToScene(90), 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, mmToScene(240), 14]} />
        <meshStandardMaterial {...MATERIALS.hydraulicRod} />
      </mesh>
    </group>
  )
}

/**
 * Coil storage saddle — welded steel Vee platten with hard nylon facings,
 * holding two full-width coils up to Ø1900 at 10 T (§5.1).
 */
function CoilSaddle() {
  const saddleY = SCENE.floorY + mmToScene(400)

  return (
    <group position={[0, 0, LINE.saddleZ]}>
      {/* Welded steel base. */}
      <mesh position={[0, SCENE.floorY + mmToScene(200), 0]} castShadow receiveShadow>
        <boxGeometry args={[SADDLE_WIDTH, mmToScene(400), mmToScene(900)]} />
        <meshStandardMaterial {...MATERIALS.saddle} />
      </mesh>

      {/* Two Vee plattens, one per coil position. */}
      {[-1, 1].map((x) => (
        <group key={x} position={[x * SADDLE_WIDTH * 0.26, saddleY, 0]}>
          {[-1, 1].map((z) => (
            <mesh
              key={z}
              position={[0, mmToScene(90), z * mmToScene(210)]}
              rotation={[z * 0.7, 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[mmToScene(520), 0.04, mmToScene(420)]} />
              <meshStandardMaterial {...MATERIALS.nylonFacing} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
