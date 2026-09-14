import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MILL HOUSING / STAND — the static structure the roll stack sits in.
 *
 * Nothing here animates: the housing is the one part of a mill that genuinely
 * does not move, and §10.3's rule is "no meaningless animation — every moving
 * object represents a machine parameter".
 *
 * It does react to one thing: when an alarm names the STAND or ROLL_BITE, the
 * structure picks up an alarm-coloured emissive tint so the operator's eye is
 * taken to the right part of the machine (§17 test 7).
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAlarmStore } from '../../store/alarmStore';
import { LINE, MATERIALS, SCENE, SCENE_COLORS } from './twinMaterials';
/**
 * §6.1: "Operator-side and drive-side housings are made SEPARATELY; each has a
 * central window for inserting the rolls. Both housings connected by a separator
 * at the top and back-up roll change rails at the bottom."
 *
 * That is the structure this component now draws: two independent frames, joined
 * only at the top and at floor level, with replaceable liners on the inner faces
 * of each window.
 */
export function MillStand() {
    const postHeight = SCENE.housingTop - SCENE.housingBottom;
    const postCentreY = (SCENE.housingTop + SCENE.housingBottom) / 2;
    const postWidth = SCENE.burRadius * 0.52;
    const postDepth = SCENE.barrelLength * 0.42;
    const beamHeight = SCENE.burRadius * 0.5;
    const windowSpan = SCENE.housingPostX * 2 + postWidth;
    return (_jsxs("group", { children: [[-1, 1].map((z) => [-1, 1].map((x) => (_jsxs("mesh", { position: [x * SCENE.housingPostX, postCentreY, z * SCENE.housingZ], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [postWidth, postHeight, postDepth] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }, `${z}-${x}`)))), [-1, 1].map((z) => [-1, 1].map((x) => (_jsxs("mesh", { position: [
                    x * (SCENE.housingPostX - postWidth / 2 - 0.008),
                    0,
                    z * SCENE.housingZ,
                ], castShadow: true, children: [_jsx("boxGeometry", { args: [0.016, SCENE.burRadius * 3.4, postDepth * 0.55] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, `liner-${z}-${x}`)))), [-1, 1].map((z) => [SCENE.housingTop, SCENE.housingBottom].map((y) => (_jsxs("mesh", { position: [0, y, z * SCENE.housingZ], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [windowSpan, beamHeight, postDepth] }), _jsx("meshStandardMaterial", { ...MATERIALS.housingTrim })] }, `${z}-${y}`)))), _jsxs("mesh", { position: [0, SCENE.housingTop + beamHeight * 0.7, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [windowSpan * 0.8, beamHeight * 0.7, SCENE.housingZ * 2 + postDepth] }), _jsx("meshStandardMaterial", { ...MATERIALS.housingTrim })] }), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, SCENE.housingBottom + beamHeight * 0.62, z * SCENE.housingZ * 0.66], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [windowSpan * 2.6, 0.05, 0.09] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, `rail-${z}`))), _jsx(StandAlarmGlow, {}), _jsx(Floor, {})] }));
}
/**
 * A dim panel behind the roll stack that lifts to alarm colour when the stand or
 * the roll bite is in alarm. Subtle by design — §10.5 forbids excessive glow.
 */
function StandAlarmGlow() {
    const ref = useRef(null);
    const sections = useAlarmStore((s) => s.highlightedSections);
    const active = sections.includes('STAND') || sections.includes('ROLL_BITE');
    useFrame((state) => {
        const mesh = ref.current;
        if (!mesh)
            return;
        const material = mesh.material;
        const target = active ? 0.16 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06 : 0;
        material.opacity += (target - material.opacity) * 0.08;
        mesh.visible = material.opacity > 0.005;
    });
    return (_jsxs("mesh", { ref: ref, position: [0, 0, -SCENE.housingZ - 0.18], visible: false, children: [_jsx("planeGeometry", { args: [SCENE.housingPostX * 2.4, SCENE.housingTop - SCENE.housingBottom] }), _jsx("meshStandardMaterial", { color: SCENE_COLORS.alarm, emissive: SCENE_COLORS.alarm, emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false })] }));
}
/**
 * Light mill floor, spanning the whole line from the pay-off reel to the delivery
 * tension reel with a margin either end. It is not a selectable machine part.
 *
 * The floor is at `passLineHeight` below the pass line, so the reels, the coil
 * cars and the stand all stand on one surface rather than each choosing its own
 * ground.
 */
function Floor() {
    const width = LINE.maxX - LINE.minX + 5;
    const centreX = (LINE.maxX + LINE.minX) / 2;
    return (_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [centreX, SCENE.floorY, 0], receiveShadow: true, raycast: () => { }, children: [_jsx("planeGeometry", { args: [width, 9] }), _jsx("meshStandardMaterial", { ...MATERIALS.floor })] }));
}
