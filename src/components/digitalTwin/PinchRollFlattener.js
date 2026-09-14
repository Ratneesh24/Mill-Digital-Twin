import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PINCH ROLL CUM FLATTENER UNIT — §5.4, drawings EU 06 0..5 A1.
 *
 * Sits on the entry side between the pay-off reel and the entry tension reel, so
 * the first pass runs POR -> peeler -> flattener -> carry-over table -> over an
 * idle ETR -> mill (§3, §12.2). It flattens the coil nose and feeds it forward at
 * threading speed.
 *
 * STATIC. There is no flattener tag on the CRM04 feed — no roll speed, no
 * penetration, no coupler position — so nothing here moves. §10.3's rule is that
 * every moving object represents a machine parameter, and inventing a spin for
 * this unit would be exactly the kind of decorative animation the twin refuses.
 * It is drawn in its parked state: top rolls raised, coupler disengaged, which is
 * where it sits during normal rolling (§12.4 steps 5-6).
 */
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
/** §5.4: 2 pinch rolls Ø250 x 600 barrel, 3 leveller rolls Ø200 x 600. */
const PINCH_ROLL_RADIUS = mmToScene(250 / 2);
const LEVELLER_ROLL_RADIUS = mmToScene(200 / 2);
const ROLL_BARREL = mmToScene(600);
export function PinchRollFlattener() {
    const housingHeight = Math.abs(SCENE.floorY) + PINCH_ROLL_RADIUS * 3;
    const housingDepth = ROLL_BARREL + 0.5;
    return (_jsxs("group", { position: [LINE.flattenerX, 0, 0], children: [[-1, 1].map((z) => (_jsxs("mesh", { position: [0, SCENE.floorY / 2 + PINCH_ROLL_RADIUS, z * (housingDepth / 2 - 0.1)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [PINCH_ROLL_RADIUS * 5.4, housingHeight, 0.2] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }, z))), _jsx(Roll, { x: -PINCH_ROLL_RADIUS * 1.6, y: PINCH_ROLL_RADIUS * 1.5, radius: PINCH_ROLL_RADIUS, material: "pinchRoll" }), _jsx(Roll, { x: -PINCH_ROLL_RADIUS * 1.6, y: -PINCH_ROLL_RADIUS, radius: PINCH_ROLL_RADIUS, material: "pinchRoll" }), _jsx(Roll, { x: PINCH_ROLL_RADIUS * 0.6, y: -LEVELLER_ROLL_RADIUS, radius: LEVELLER_ROLL_RADIUS, material: "levellerRoll" }), _jsx(Roll, { x: PINCH_ROLL_RADIUS * 2.2, y: -LEVELLER_ROLL_RADIUS, radius: LEVELLER_ROLL_RADIUS, material: "levellerRoll" }), _jsx(Roll, { x: PINCH_ROLL_RADIUS * 1.4, y: LEVELLER_ROLL_RADIUS * 1.6, radius: LEVELLER_ROLL_RADIUS, material: "levellerRoll" }), _jsxs("group", { position: [PINCH_ROLL_RADIUS * 1.4, PINCH_ROLL_RADIUS * 3.4, 0], children: [_jsxs("mesh", { castShadow: true, children: [_jsx("boxGeometry", { args: [0.18, 0.26, 0.18] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] }), _jsxs("mesh", { position: [0, 0.2, 0], rotation: [Math.PI / 2, 0, 0], castShadow: true, children: [_jsx("torusGeometry", { args: [0.12, 0.014, 8, 24] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] })] }), _jsxs("group", { position: [0, -0.1, -housingDepth / 2 - 0.45], children: [_jsxs("mesh", { position: [0, 0, 0.2], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [PINCH_ROLL_RADIUS * 4.4, 0.44, 0.34] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] }), _jsxs("mesh", { position: [0, 0, -0.08], rotation: [Math.PI / 2, 0, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.09, 0.09, 0.2, 16] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulicRod })] }), _jsxs("mesh", { position: [0, -0.02, -0.34], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.4, 0.4, 0.34] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] }), _jsxs("mesh", { position: [0, -0.02, -0.68], rotation: [Math.PI / 2, 0, 0], castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [0.16, 0.16, 0.36, 20] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [PINCH_ROLL_RADIUS * 3.2, 0, z * mmToScene(500 / 2 + 40)], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.05, 0.05, 0.2, 14] }), _jsx("meshStandardMaterial", { ...MATERIALS.levellerRoll })] }, `guide-${z}`)))] }));
}
/** One roll on the unit, laid along the barrel axis with its bearing housings. */
function Roll({ x, y, radius, material, }) {
    return (_jsxs("group", { position: [x, y, 0], rotation: [Math.PI / 2, 0, 0], children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [radius, radius, ROLL_BARREL, 28] }), _jsx("meshStandardMaterial", { ...MATERIALS[material] })] }), [-1, 1].map((s) => (_jsxs("mesh", { position: [0, s * (ROLL_BARREL / 2 + 0.07), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [radius * 0.42, radius * 0.42, 0.14, 16] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, s)))] }));
}
