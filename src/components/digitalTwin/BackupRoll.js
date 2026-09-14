import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * BACKUP ROLL — dark steel, larger, carries the separating force into the
 * housing through the chocks and the HAGC capsule.
 *
 * The BUR is not independently driven: it is turned by contact with the work
 * roll, so its surface speed equals the WR surface speed and its rpm is lower in
 * proportion to its diameter. That relationship is computed in the machine layer
 * (BUR.TOP.RPM) — this component only renders the angle the twin engine
 * integrated from it.
 */
import { useRef } from 'react';
import { rollGapToScene } from '../../config/unitConversion';
import { useTwinFrame } from './TwinContext';
import { backupRollCentreY, MATERIALS, SCENE } from './twinMaterials';
export function BackupRoll({ side }) {
    const liftRef = useRef(null);
    const spinRef = useRef(null);
    useTwinFrame((v) => {
        const lift = liftRef.current;
        const spin = spinRef.current;
        if (!lift || !spin)
            return;
        lift.position.y = backupRollCentreY(rollGapToScene(v.rollGap), side);
        spin.rotation.y = side === 'UPPER' ? v.burAngle : -v.burAngle;
    });
    const r = SCENE.burRadius;
    const halfBarrel = SCENE.barrelLength / 2;
    const neckR = SCENE.burNeckRadius;
    const neckLength = neckR * 1.1;
    return (_jsxs("group", { ref: liftRef, children: [_jsx("group", { rotation: [Math.PI / 2, 0, 0], children: _jsxs("group", { ref: spinRef, children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [r, r, SCENE.barrelLength, 56, 1] }), _jsx("meshStandardMaterial", { ...MATERIALS.backupRoll })] }), [-1, 1].map((s) => (_jsxs("mesh", { position: [0, s * (halfBarrel + neckLength / 2), 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [neckR, neckR, neckLength, 28] }), _jsx("meshStandardMaterial", { ...MATERIALS.backupRollChock })] }, s))), _jsxs("mesh", { position: [0, halfBarrel + neckLength + 0.001, neckR * 0.55], castShadow: true, children: [_jsx("boxGeometry", { args: [0.04, 0.012, neckR * 0.6] }), _jsx("meshStandardMaterial", { ...MATERIALS.rollMarker })] })] }) }), [-1, 1].map((s) => (_jsxs("mesh", { position: [0, 0, s * (halfBarrel + neckLength / 2)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [neckR * 2.1, neckR * 2.4, neckLength] }), _jsx("meshStandardMaterial", { ...MATERIALS.backupRollChock })] }, s))), [-1, 1].map((s) => (_jsxs("mesh", { position: [s * r * 0.72, side === 'UPPER' ? r * 0.72 : -r * 0.72, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.05, 0.04, SCENE.barrelLength * 0.96] }), _jsx("meshStandardMaterial", { ...MATERIALS.backupRollChock })] }, `wiper-${s}`)))] }));
}
