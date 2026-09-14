import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * COILER — DTR, ETR and POR.
 *
 * §10.3 binding: `coil.remainingLength` -> coil diameters on both reels.
 *
 * The diameter shown is the one the coil model computed from the wound length
 * (r = √(r_m² + h·L/π)), so the payoff coil visibly shrinks and the tension reel
 * visibly grows at the correct, decelerating rate — and both reels slow down as
 * they fill, because rpm = v / 2πr.
 *
 * Which reel pays off and which winds is read from the direction-derived role.
 * After a reversal the same two meshes swap behaviour without either of them
 * knowing which side of the mill it is on.
 */
import { useRef } from 'react';
import { mmToScene } from '../../config/unitConversion';
import { useTwinFrame } from './TwinContext';
import { LINE, MATERIALS, SCENE } from './twinMaterials';
/**
 * All three reels stand ON the pass line (§3): POR outboard of the flattener,
 * which is outboard of ETR, all on the entry side; DTR alone on the delivery
 * side. The pay-off reel used to be parked off-centre in Z, which put it on the
 * wrong side of the mill and off the line at the same time.
 */
export function Coiler({ reel }) {
    const spinRef = useRef(null);
    const coilRef = useRef(null);
    const positionX = reel === 'ETR' ? LINE.etrX : reel === 'DTR' ? LINE.dtrX : LINE.porX;
    // POR runs a 4-segment expanding mandrel of its own (§5.2, Ø530 expanded), a
    // different machine from the tension reel drums (Ø508).
    const mandrelRadius = reel === 'POR' ? SCENE.porMandrelRadius : SCENE.mandrelRadius;
    const mandrelFace = reel === 'POR' ? SCENE.porMandrelFace : SCENE.mandrelFace;
    useTwinFrame((v) => {
        const spin = spinRef.current;
        const coil = coilRef.current;
        if (!spin || !coil)
            return;
        const radiusMm = reel === 'DTR' ? v.dtrRadius : reel === 'ETR' ? v.etrRadius : v.porRadius;
        const radius = Math.max(mmToScene(radiusMm), mandrelRadius * 1.02);
        // The cylinder is built at unit radius, so scaling in the two radial axes
        // resizes the coil without rebuilding geometry every frame.
        coil.scale.x = radius;
        coil.scale.z = radius;
        coil.scale.y = Math.max(mmToScene(v.stripWidth), 0.05);
        // POR is parked with its brake applied — it does not turn.
        if (reel !== 'POR') {
            spin.rotation.y = reel === 'DTR' ? v.dtrAngle : v.etrAngle;
        }
    });
    return (_jsxs("group", { position: [positionX, 0, 0], children: [_jsx("group", { rotation: [Math.PI / 2, 0, 0], children: _jsxs("group", { ref: spinRef, children: [_jsxs("mesh", { ref: coilRef, castShadow: true, receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [1, 1, 1, 48, 1] }), _jsx("meshStandardMaterial", { ...MATERIALS.coil })] }), _jsxs("mesh", { castShadow: true, children: [_jsx("cylinderGeometry", { args: [mandrelRadius, mandrelRadius, mandrelFace, 28] }), _jsx("meshStandardMaterial", { ...MATERIALS.mandrel })] }), _jsx(CoilMarker, { reel: reel, mandrelRadius: mandrelRadius })] }) }), _jsxs("mesh", { position: [0, SCENE.floorY / 2, -mandrelFace / 2 - 0.24], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.62, Math.abs(SCENE.floorY), 0.72] }), _jsx("meshStandardMaterial", { ...MATERIALS.housing })] }), _jsxs("mesh", { position: [0, 0, -mandrelFace / 2 - 0.24], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [0.62, 0.5, 0.72] }), _jsx("meshStandardMaterial", { ...MATERIALS.drive })] })] }));
}
function CoilMarker({ reel, mandrelRadius, }) {
    const ref = useRef(null);
    useTwinFrame((v) => {
        const mesh = ref.current;
        if (!mesh)
            return;
        const radiusMm = reel === 'DTR' ? v.dtrRadius : reel === 'ETR' ? v.etrRadius : v.porRadius;
        const radius = Math.max(mmToScene(radiusMm), mandrelRadius * 1.02);
        // Ride the marker on the coil's outer surface as the diameter changes.
        mesh.position.z = radius * 0.99;
        mesh.scale.y = Math.max(mmToScene(v.stripWidth), 0.05) * 0.98;
    });
    return (_jsxs("mesh", { ref: ref, position: [0, 0, 0.5], children: [_jsx("boxGeometry", { args: [0.035, 1, 0.012] }), _jsx("meshStandardMaterial", { ...MATERIALS.coilEdge })] }));
}
