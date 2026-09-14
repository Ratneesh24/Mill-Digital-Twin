import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useUiStore } from '../../store/uiStore';
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
export function MillEnclosure() {
    const view = useUiStore((s) => s.cameraView);
    // The close view exists to see the roll stack. Nothing may stand in front of it.
    if (view === 'STAND')
        return null;
    const width = Math.abs(LINE.entryAirKnifeX) * 2 + mmToScene(1400);
    const depth = SCENE.housingZ * 2 + mmToScene(900);
    const top = SCENE.housingTop + mmToScene(700);
    return (_jsxs("group", { raycast: () => { }, children: [[-1, 1].map((z) => (_jsxs("mesh", { position: [0, (top + SCENE.floorY) / 2, z * (depth / 2)], children: [_jsx("boxGeometry", { args: [width, top - SCENE.floorY, 0.02] }), _jsx("meshStandardMaterial", { ...MATERIALS.enclosure, transparent: true, opacity: 0.13, depthWrite: false })] }, z))), [-1, 1].map((x) => (_jsxs("mesh", { position: [x * (width / 2), (top + SCENE.floorY) / 2, 0], children: [_jsx("boxGeometry", { args: [0.02, top - SCENE.floorY, depth] }), _jsx("meshStandardMaterial", { ...MATERIALS.enclosure, transparent: true, opacity: 0.13, depthWrite: false })] }, `end-${x}`))), [-1, 1].map((x) => [-1, 1].map((z) => (_jsxs("mesh", { position: [x * (width / 2), (top + SCENE.floorY) / 2, z * (depth / 2)], castShadow: true, children: [_jsx("boxGeometry", { args: [0.07, top - SCENE.floorY, 0.07] }), _jsx("meshStandardMaterial", { ...MATERIALS.housingTrim })] }, `post-${x}-${z}`)))), [-1, 1].map((x) => (_jsxs("group", { position: [x * (width * 0.3), top, 0], children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [width * 0.3, mmToScene(400), depth * 0.7] }), _jsx("meshStandardMaterial", { ...MATERIALS.duct })] }), _jsxs("mesh", { position: [0, mmToScene(700), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [mmToScene(280), mmToScene(280), mmToScene(1000), 16] }), _jsx("meshStandardMaterial", { ...MATERIALS.duct })] })] }, `hood-${x}`))), _jsxs("mesh", { position: [0, top + mmToScene(1200), 0], rotation: [0, 0, Math.PI / 2], castShadow: true, children: [_jsx("cylinderGeometry", { args: [mmToScene(300), mmToScene(300), width * 0.65, 16] }), _jsx("meshStandardMaterial", { ...MATERIALS.duct })] })] }));
}
