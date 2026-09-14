import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { mmToScene } from '../../config/unitConversion';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
const FRAME_WIDTH = mmToScene(760);
const BLADE_LENGTH = mmToScene(700);
const FRAME_HEIGHT = mmToScene(1200);
export function CropShear() {
    return (_jsxs("group", { position: [LINE.cropShearX, 0, 0], children: [[-1, 1].map((z) => (_jsxs("mesh", { position: [0, FRAME_HEIGHT / 2 - mmToScene(300), z * (FRAME_WIDTH / 2)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.22, FRAME_HEIGHT, 0.2] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearFrame })] }, z))), _jsxs("mesh", { position: [0, FRAME_HEIGHT - mmToScene(300), 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.24, 0.22, FRAME_WIDTH + 0.2] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearFrame })] }), _jsxs("mesh", { position: [0, FRAME_HEIGHT - mmToScene(520), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.08, 0.08, 0.3, 16] }), _jsx("meshStandardMaterial", { ...MATERIALS.hydraulic })] }), _jsxs("group", { position: [0, mmToScene(340), 0], children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.2, 0.16, BLADE_LENGTH + 0.1] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearFrame })] }), _jsxs("mesh", { position: [0, -0.1, 0], rotation: [0.05, 0, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.05, 0.05, BLADE_LENGTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearBlade })] })] }), _jsxs("mesh", { position: [0, -0.05, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.05, 0.05, BLADE_LENGTH] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearBlade })] }), _jsxs("mesh", { position: [0, -0.16, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.24, 0.18, BLADE_LENGTH + 0.1] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearFrame })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, SCENE.floorY / 2 - mmToScene(150), z * (FRAME_WIDTH / 2)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.26, Math.abs(SCENE.floorY) - mmToScene(300), 0.24] }), _jsx("meshStandardMaterial", { ...MATERIALS.shearFrame })] }, `leg-${z}`)))] }));
}
