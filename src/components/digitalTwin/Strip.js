import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * STRIP — the material passing through the mill.
 *
 * Three §10.3 bindings meet here:
 *   `speed.actual`        -> strip velocity (surface markers translate)
 *   `thickness`           -> visible section, thicker on the entry side
 *   `tension.entry/exit`  -> tautness (slack strip droops)
 *
 * Two details that matter for honesty:
 *
 *  1. The entry and exit spans move at DIFFERENT speeds. Mass flow
 *     (h_in·v_in = h_out·v_out) means the entry side runs slower by exactly the
 *     reduction ratio, and a twin that scrolls both at the same rate is quietly
 *     contradicting its own thickness model.
 *
 *  2. Section is drawn with the disclosed exaggeration factor from millConfig.
 *     A 2 mm strip between 215 mm rolls is invisible at true scale. The NUMBERS
 *     shown anywhere in the app are always true; only these pixels are scaled,
 *     and the scene states the factor.
 */
import { useMemo, useRef } from 'react';
import { CanvasTexture, RepeatWrapping } from 'three';
import { mmToScene, stripThicknessToScene } from '../../config/unitConversion';
import { useTwinFrame } from './TwinContext';
import { LINE, MATERIALS } from './twinMaterials';
/** Spacing of the surface markers along the strip, metres of real strip. */
const MARKER_SPACING_M = 0.5;
/** Maximum visual droop of a fully slack span, scene units. */
const MAX_SAG = 0.07;
/**
 * Procedural surface texture: faint transverse bands so strip motion is
 * visible. Generated in a canvas rather than loaded, so the twin has no
 * external asset dependency and works on an isolated plant network.
 */
function useStripTexture() {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 64, 8);
            ctx.fillStyle = '#c9d3da';
            ctx.fillRect(0, 0, 4, 8);
            ctx.fillStyle = '#dde5ea';
            ctx.fillRect(30, 0, 2, 8);
        }
        const texture = new CanvasTexture(canvas);
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        return texture;
    }, []);
}
/**
 * One half of the strip. Whether it is the entry or the exit span is decided
 * every frame from the rolling direction — never hardcoded (§1).
 */
function StripSpan({ sideX }) {
    const pivotRef = useRef(null);
    const meshRef = useRef(null);
    const texture = useStripTexture();
    // Each span runs from the bite to its own reel. The two are equal today, but
    // the entry and delivery reels are separate stations on the line and nothing
    // requires them to stay that way.
    const spanLength = Math.abs(sideX === -1 ? LINE.etrX : LINE.dtrX);
    useTwinFrame((v) => {
        const pivot = pivotRef.current;
        const mesh = meshRef.current;
        if (!pivot || !mesh)
            return;
        // FORWARD: strip runs -X -> +X, so the -X half is the entry side.
        const isEntrySide = v.direction === 'FORWARD' ? sideX === -1 : sideX === 1;
        const thicknessMm = isEntrySide ? v.entryThickness : v.stripThickness;
        const travel = isEntrySide ? v.stripTravelEntry : v.stripTravel;
        const tension = isEntrySide ? v.entryTensionNormalised : v.exitTensionNormalised;
        // Section (exaggerated, disclosed) and width from the coil.
        mesh.scale.y = Math.max(stripThicknessToScene(thicknessMm), 0.002);
        mesh.scale.z = Math.max(mmToScene(v.stripWidth), 0.05);
        // Tautness: a fully tensioned span is straight, a slack one droops at the
        // reel end. The bite end stays on the pass line because the rolls hold it.
        const sag = MAX_SAG * (1 - Math.min(tension, 1));
        pivot.rotation.z = sideX === -1 ? -Math.atan2(sag, spanLength) : Math.atan2(sag, spanLength);
        // Surface markers scroll at the true strip speed for THIS span.
        texture.repeat.x = spanLength / MARKER_SPACING_M;
        texture.offset.x = -(travel / MARKER_SPACING_M) % 1;
        const material = mesh.material;
        if (material.map !== texture) {
            material.map = texture;
            material.needsUpdate = true;
        }
    });
    return (_jsx("group", { ref: pivotRef, children: _jsxs("mesh", { ref: meshRef, position: [(sideX * spanLength) / 2, 0, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [spanLength, 1, 1] }), _jsx("meshStandardMaterial", { ...MATERIALS.strip })] }) }));
}
export function Strip() {
    return (_jsxs("group", { children: [_jsx(StripSpan, { sideX: -1 }), _jsx(StripSpan, { sideX: 1 })] }));
}
