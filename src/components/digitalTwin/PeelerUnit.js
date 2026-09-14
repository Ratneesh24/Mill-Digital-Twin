import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
const TABLE_WIDTH = mmToScene(700);
const TABLE_LENGTH = mmToScene(900);
export function PeelerUnit() {
    return (_jsxs("group", { position: [LINE.peelerX, SCENE.floorY * 0.35, 0], children: [_jsxs("group", { rotation: [0, 0, -0.35], children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [TABLE_LENGTH, 0.05, TABLE_WIDTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.coilCar })] }), _jsxs("mesh", { position: [TABLE_LENGTH / 2 + 0.04, 0.008, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.09, 0.022, TABLE_WIDTH * 0.94] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearBlade })] })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [-TABLE_LENGTH * 0.3, -0.22, z * TABLE_WIDTH * 0.36], rotation: [0, 0, 0.5], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.045, 0.045, 0.42, 12] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulic })] }, z))), _jsxs("mesh", { position: [-TABLE_LENGTH * 0.55, -0.12, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.16, 0.5, TABLE_WIDTH * 0.8] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] })] }));
}
