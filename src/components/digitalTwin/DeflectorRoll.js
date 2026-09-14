import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * DEFLECTOR ROLL AND THREADING TABLE — §5.6, drawings EU 10 5 A1 / EU 28 5 A1.
 *
 * Single Ø300 x 600 alloy steel roll each side of the stand, on spherical roller
 * bearings in blocks fixed to the entry/exit table frame. It turns the strip from
 * the reel onto the pass line and back.
 *
 * This is the ONE new part on the line that animates, and it earns it twice over:
 *
 *  1. The strip wraps it, so its surface speed IS the strip speed. Rotating it
 *     from `stripTravel` is not decoration, it is the same binding the work rolls
 *     use — zero speed necessarily means a stationary roll.
 *  2. §5.6 puts ENCODERS on both the operator side and the drive side of this
 *     roll, and those encoders are a speed feedback into the AGC. Of everything
 *     on the auxiliary line this is the part the control system actually reads.
 *
 * Which side is entry and which is delivery swaps with rolling direction, but the
 * rolls themselves do not move — both are driven by the same strip, so both are
 * rotated from the same travel.
 */
import { useRef } from 'react';
import { mmToScene } from '../../config/unitConversion';
import { useTwinFrame } from './TwinContext';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
/** §5.6: single deflector roll, Ø300 x 600 barrel, alloy steel. */
const ROLL_RADIUS = mmToScene(300 / 2);
const ROLL_BARREL = mmToScene(600);
export function DeflectorRoll({ station }) {
    const spinRef = useRef(null);
    const x = station === 'ENTRY' ? LINE.entryDeflectorX : LINE.deliveryDeflectorX;
    useTwinFrame((v) => {
        const spin = spinRef.current;
        if (!spin)
            return;
        // Surface speed = strip speed. `stripTravel` is metres of strip, already
        // signed by direction and damped by the twin engine, so the roll reverses
        // with the mill and never snaps.
        const travel = station === 'ENTRY' ? v.stripTravelEntry : v.stripTravel;
        spin.rotation.y = travel / ROLL_RADIUS;
    });
    return (_jsxs("group", { position: [x, 0, 0], children: [_jsx("group", { rotation: [Math.PI / 2, 0, 0], children: _jsxs("group", { ref: spinRef, children: [_jsxs("mesh", { castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [ROLL_RADIUS, ROLL_RADIUS, ROLL_BARREL, 32] }), _jsx("meshStandardMaterial", { ...MATERIALS.deflectorRoll })] }), _jsxs("mesh", { position: [0, ROLL_BARREL / 2 + 0.001, ROLL_RADIUS * 0.6], castShadow: true, children: [_jsx("boxGeometry", { args: [0.028, 0.008, ROLL_RADIUS * 0.5] }), _jsx("meshStandardMaterial", { ...MATERIALS.rollMarker })] })] }) }), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, 0, z * (ROLL_BARREL / 2 + 0.09)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [ROLL_RADIUS * 1.5, ROLL_RADIUS * 1.5, 0.18] }), _jsx("meshStandardMaterial", { ...MATERIALS.workRollChock })] }, z))), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, 0, z * (ROLL_BARREL / 2 + 0.24)], rotation: [Math.PI / 2, 0, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.05, 0.05, 0.12, 14] }), _jsx("meshStandardMaterial", { ...MATERIALS.gaugeHead })] }, `enc-${z}`))), [-1, 1].map((z) => (_jsxs("mesh", { position: [0, SCENE.floorY / 2 - ROLL_RADIUS / 2, z * (ROLL_BARREL / 2 + 0.09)], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.16, Math.abs(SCENE.floorY) - ROLL_RADIUS, 0.16] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }, `leg-${z}`))), _jsxs("mesh", { position: [0, -ROLL_RADIUS * 1.5, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [ROLL_RADIUS * 3.5, 0.05, ROLL_BARREL * 0.9] }), _jsx("meshStandardMaterial", { ...MATERIALS.coilCar })] })] }));
}
