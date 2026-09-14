import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CARRY-OVER TABLE — §5.5, drawing EU 06 5 A1.
 *
 * Welded steel bed at the exit end of the flattener unit, hydraulically operated
 * and pivoting downwards. During threading it is raised and extended to pass-line
 * position and matched with the raised threading table on the deflector roll
 * frame (§12.2 step 3); it is retracted and lowered to parking once the strip is
 * on the delivery reel (§12.4 step 7, §12.5 step 3).
 *
 * STATIC, drawn LOWERED to parking — its position during rolling, and the only
 * position the twin can honestly claim, since the feed carries no table position.
 */
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
const TABLE_LENGTH = mmToScene(1100);
const TABLE_WIDTH = mmToScene(700);
export function CarryOverTable() {
    return (_jsxs("group", { position: [LINE.carryOverTableX, 0, 0], children: [_jsxs("group", { position: [0, -0.16, 0], rotation: [0, 0, 0.28], children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [TABLE_LENGTH, 0.06, TABLE_WIDTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.coilCar })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, 0.06, z * TABLE_WIDTH * 0.47], castShadow: true, children: [_jsx("boxGeometry", { args: [TABLE_LENGTH, 0.07, 0.04] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }, z)))] }), [-1, 1].map((z) => (_jsxs("group", { position: [0, 0, z * TABLE_WIDTH * 0.42], children: [_jsxs("mesh", { position: [-TABLE_LENGTH / 2, -0.16, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.12, 0.14, 0.12] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }), _jsxs("mesh", { position: [TABLE_LENGTH * 0.2, -0.42, 0], rotation: [0, 0, 0.2], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.04, 0.04, 0.44, 12] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulic })] })] }, z))), [-1, 1].map((z) => (_jsxs("mesh", { position: [TABLE_LENGTH * 0.3, SCENE.floorY / 2 - 0.3, z * TABLE_WIDTH * 0.42], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.12, Math.abs(SCENE.floorY) - 0.6, 0.12] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }, `leg-${z}`)))] }));
}
