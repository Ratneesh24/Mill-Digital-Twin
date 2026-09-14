import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WORK ROLL — polished steel, driven, straddling the pass line.
 *
 * Two bindings from §10.3 land here:
 *   `speed.actual`     -> rotation rate (via the twin engine's integrated angle)
 *   `rollGap.actual`   -> work-roll separation
 *
 * Rotation is DERIVED (§8.4): the angle comes from the roll rpm the machine
 * state reports, which itself comes from mill speed. There is no animation
 * timer anywhere in this file, so zero speed necessarily means a stationary
 * roll.
 *
 * Bending is deliberately NOT animated unless a bending tag exists (§7.4).
 */
import { useRef } from 'react';
import { rollGapToScene } from '../../config/unitConversion';
import { useTwinFrame } from './TwinContext';
import { MATERIALS, SCENE, workRollCentreY } from './twinMaterials';
export function WorkRoll({ side }) {
    const liftRef = useRef(null);
    const spinRef = useRef(null);
    useTwinFrame((v) => {
        const lift = liftRef.current;
        const spin = spinRef.current;
        if (!lift || !spin)
            return;
        // Gap -> vertical position. `rollGap` is already damped by the twin engine,
        // so the roll never snaps to a new position (§10.4).
        lift.position.y = workRollCentreY(rollGapToScene(v.rollGap), side);
        // Upper and lower work rolls counter-rotate. A single sign flip here is what
        // makes them still counter-rotate correctly after a direction reversal.
        spin.rotation.y = side === 'UPPER' ? v.wrAngle : -v.wrAngle;
    });
    const r = SCENE.wrRadius;
    const halfBarrel = SCENE.barrelLength / 2;
    const neckR = SCENE.wrNeckRadius;
    const neckLength = neckR * 2.4;
    return (_jsxs("group", { ref: liftRef, children: [_jsx("group", { rotation: [Math.PI / 2, 0, 0], children: _jsxs("group", { ref: spinRef, children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [r, r, SCENE.barrelLength, 48, 1] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRoll })] }), [-1, 1].map((s) => (_jsxs("mesh", { position: [0, s * (halfBarrel + neckLength / 2), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [neckR, neckR, neckLength, 24] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, s))), _jsxs("mesh", { position: [0, halfBarrel + neckLength + 0.001, neckR * 0.6], castShadow: true, children: [_jsx("boxGeometry", { args: [0.03, 0.01, neckR * 0.8] }), _jsx("meshStandardMaterial", { ...MATERIALS.rollMarker })] })] }) }), [-1, 1].map((s) => (_jsxs("mesh", { position: [0, 0, s * (halfBarrel + neckLength / 2)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [neckR * 2.6, neckR * 2.6, neckLength] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, s)))] }));
}
