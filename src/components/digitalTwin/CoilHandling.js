import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
const CAR_WIDTH = mmToScene(900);
const CAR_LENGTH = mmToScene(1100);
const SADDLE_WIDTH = mmToScene(1400);
/** Every station that has a coil car and a storage saddle. */
const STATIONS = [
    { id: 'POR', x: LINE.porX },
    { id: 'ETR', x: LINE.etrX },
    { id: 'DTR', x: LINE.dtrX },
];
export function CoilHandling() {
    return (_jsx("group", { children: STATIONS.map((station) => (_jsxs("group", { position: [station.x, 0, 0], children: [_jsx(CoilCar, {}), _jsx(CoilSaddle, {})] }, station.id))) }));
}
/**
 * Pit-mounted coil car, retracted. The pit floor is below the mill floor, so the
 * carriage sits in a recess rather than on the slab.
 */
function CoilCar() {
    const pitDepth = mmToScene(700);
    // The carriage rides low in the pit with its deck close to floor level, which
    // is how a pit-mounted car actually presents: what you see walking the line is
    // the deck and the Vee platten, not the carriage. Sinking it to the pit floor
    // hides the whole car under an opaque slab and models something nobody can see.
    const carY = SCENE.floorY - mmToScene(180);
    return (_jsxs("group", { position: [0, 0, LINE.saddleZ * 0.42], children: [_jsxs("mesh", { position: [0, SCENE.floorY - pitDepth / 2, 0], receiveShadow: true, children: [_jsx("boxGeometry", { args: [CAR_LENGTH + 0.4, pitDepth, LINE.coilCarTravel] }), _jsx("meshStandardMaterial", { ...MATERIALS.floor })] }), _jsxs("mesh", { position: [0, carY, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [CAR_LENGTH, mmToScene(300), CAR_WIDTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.coilCar })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, carY - mmToScene(170), z * CAR_WIDTH * 0.42], receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.06, 0.06, LINE.coilCarTravel] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, z))), _jsx("group", { position: [0, carY + mmToScene(200), 0], children: [-1, 1].map((z) => (_jsxs("mesh", { position: [0, 0, z * mmToScene(220)], rotation: [z * 0.6, 0, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [CAR_LENGTH * 0.8, 0.04, mmToScene(360)] }), _jsx("meshStandardMaterial", { ...MATERIALS.nylonFacing })] }, z))) }), _jsxs("mesh", { position: [0, carY + mmToScene(90), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.08, 0.08, mmToScene(240), 14] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulicRod })] })] }));
}
/**
 * Coil storage saddle — welded steel Vee platten with hard nylon facings,
 * holding two full-width coils up to Ø1900 at 10 T (§5.1).
 */
function CoilSaddle() {
    const saddleY = SCENE.floorY + mmToScene(400);
    return (_jsxs("group", { position: [0, 0, LINE.saddleZ], children: [_jsxs("mesh", { position: [0, SCENE.floorY + mmToScene(200), 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [SADDLE_WIDTH, mmToScene(400), mmToScene(900)] }), _jsx("meshStandardMaterial", { ...MATERIALS.saddle })] }), [-1, 1].map((x) => (_jsx("group", { position: [x * SADDLE_WIDTH * 0.26, saddleY, 0], children: [-1, 1].map((z) => (_jsxs("mesh", { position: [0, mmToScene(90), z * mmToScene(210)], rotation: [z * 0.7, 0, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [mmToScene(520), 0.04, mmToScene(420)] }), _jsx("meshStandardMaterial", { ...MATERIALS.nylonFacing })] }, z))) }, x)))] }));
}
