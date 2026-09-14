import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
const HEADER_LENGTH = mmToScene(620);
export function AirKnife({ station }) {
    const x = station === 'ENTRY' ? LINE.entryAirKnifeX : LINE.deliveryAirKnifeX;
    return (_jsxs("group", { position: [x, 0, 0], children: [[-1, 1].map((s) => (_jsxs("group", { position: [0, s * mmToScene(120), 0], children: [_jsxs("mesh", { castShadow: true, children: [_jsx("boxGeometry", { args: [0.07, 0.06, HEADER_LENGTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.airKnife })] }), _jsxs("mesh", { position: [0, -s * 0.045, 0], rotation: [0, 0, s * 0.5], castShadow: true, children: [_jsx("boxGeometry", { args: [0.05, 0.014, HEADER_LENGTH * 0.98] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulicRod })] }), _jsxs("mesh", { position: [0, s * 0.09, HEADER_LENGTH * 0.42], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.012, 0.012, 0.14, 8] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulicRod })] }), _jsxs("mesh", { position: [0, s * 0.19, -HEADER_LENGTH * 0.42], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.05, 0.05, 0.16, 14] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulic })] })] }, s))), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, SCENE.floorY / 2, z * HEADER_LENGTH * 0.52], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.09, Math.abs(SCENE.floorY), 0.09] }), _jsx("meshStandardMaterial", { ...MATERIALS.airKnife })] }, `leg-${z}`)))] }));
}
