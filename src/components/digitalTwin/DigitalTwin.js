import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * DIGITAL TWIN — the primary feature (§1: "This is not a KPI dashboard. The 3D
 * twin is the primary feature and must dominate the screen.")
 *
 * Owns the canvas, the camera policy (§10.7) and the lighting (§10.5). The scene
 * graph itself is assembled from the component set in this folder, each of which
 * binds exactly one part of the machine to exactly one part of MachineState.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ACESFilmicToneMapping, Vector3 } from 'three';
import { millConfig } from '../../config/millConfig';
import { useUiStore } from '../../store/uiStore';
import { useMachineStore } from '../../store/machineStore';
import { AirKnife } from './AirKnife';
import { BackupRoll } from './BackupRoll';
import { CarryOverTable } from './CarryOverTable';
import { Coiler } from './Coiler';
import { CoilHandling } from './CoilHandling';
import { CropShear } from './CropShear';
import { DeflectorRoll } from './DeflectorRoll';
import { ForceVisualization } from './ForceVisualization';
import { Gauge } from './Gauge';
import { HydraulicSystem } from './HydraulicSystem';
import { MillEnclosure } from './MillEnclosure';
import { MillStand } from './MillStand';
import { PeelerUnit } from './PeelerUnit';
import { PinchRollFlattener } from './PinchRollFlattener';
import { Snubber } from './Snubber';
import { Strip } from './Strip';
import { TensionSystem } from './TensionSystem';
import { TwinEngineProvider } from './TwinContext';
import { TwinLabels } from './TwinLabels';
import { WorkRoll } from './WorkRoll';
import { TwinOverlay } from './TwinOverlay';
import { LINE, SCENE } from './twinMaterials';
import { EquipmentInspector, EquipmentMarker, SelectableEquipment, TwinEquipmentProvider, } from './TwinEquipment';
export function DigitalTwin() {
    const viewportRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [fullscreenError, setFullscreenError] = useState('');
    const [zoom, setZoom] = useState(0);
    useEffect(() => {
        const syncFullscreen = () => setExpanded(document.fullscreenElement === viewportRef.current);
        document.addEventListener('fullscreenchange', syncFullscreen);
        return () => document.removeEventListener('fullscreenchange', syncFullscreen);
    }, []);
    async function toggleExpanded() {
        try {
            setFullscreenError('');
            if (document.fullscreenElement === viewportRef.current)
                await document.exitFullscreen();
            else
                await viewportRef.current?.requestFullscreen();
        }
        catch {
            setFullscreenError('Expanded view is unavailable in this browser. Use browser fullscreen instead.');
        }
    }
    return (_jsx(TwinEquipmentProvider, { children: _jsxs("div", { ref: viewportRef, className: "twin-viewport border-line bg-base-950 relative flex h-full min-h-0 w-full flex-col overflow-auto rounded-xl border", children: [_jsx(TwinOverlay, { expanded: expanded, onExpand: toggleExpanded, onZoom: (amount) => setZoom((value) => value + amount) }), fullscreenError && _jsx("p", { role: "status", className: "text-warning px-3 text-xs", children: fullscreenError }), _jsxs("div", { className: "relative min-h-[180px] flex-1 overflow-hidden", children: [_jsx(Canvas, { "aria-label": "Interactive rolling mill. Drag to orbit, scroll or pinch to zoom. Use controls and equipment selector outside the canvas for keyboard access.", shadows: true, 
                            // 24/7 operation: cap the pixel ratio rather than letting a 4K control
                            // room monitor render 4x the fragments for no visible benefit (§15).
                            dpr: [1, 1.75], gl: { antialias: true, powerPreference: 'high-performance' }, onCreated: ({ gl }) => {
                                gl.toneMapping = ACESFilmicToneMapping;
                                gl.toneMappingExposure = 1.1;
                            }, children: _jsx(Suspense, { fallback: null, children: _jsxs(TwinEngineProvider, { children: [_jsx(SceneCamera, { zoom: zoom }), _jsx(Lighting, {}), _jsxs(SelectableEquipment, { id: "POR", children: [_jsx(Coiler, { reel: "POR" }), _jsx(Snubber, {})] }), _jsx(SelectableEquipment, { id: "PEELER", children: _jsx(PeelerUnit, {}) }), _jsx(SelectableEquipment, { id: "FLATTENER", children: _jsx(PinchRollFlattener, {}) }), _jsx(SelectableEquipment, { id: "CARRY_OVER_TABLE", children: _jsx(CarryOverTable, {}) }), _jsx(SelectableEquipment, { id: "ETR", children: _jsx(Coiler, { reel: "ETR" }) }), _jsx(SelectableEquipment, { id: "ENTRY_DEFLECTOR", children: _jsx(DeflectorRoll, { station: "ENTRY" }) }), _jsx(SelectableEquipment, { id: "ETR_GAUGE", children: _jsx(Gauge, { gauge: "ETR" }) }), _jsx(SelectableEquipment, { id: "STAND", children: _jsx(MillStand, {}) }), _jsxs(SelectableEquipment, { id: "BACKUP_ROLLS", children: [_jsx(BackupRoll, { side: "UPPER" }), _jsx(BackupRoll, { side: "LOWER" })] }), _jsxs(SelectableEquipment, { id: "WORK_ROLLS", children: [_jsx(WorkRoll, { side: "UPPER" }), _jsx(WorkRoll, { side: "LOWER" })] }), _jsx(SelectableEquipment, { id: "STRIP", children: _jsx(Strip, {}) }), _jsx(SelectableEquipment, { id: "HYDRAULICS", children: _jsx(HydraulicSystem, {}) }), _jsxs(SelectableEquipment, { id: "AIR_KNIVES", children: [_jsx(AirKnife, { station: "ENTRY" }), _jsx(AirKnife, { station: "DELIVERY" })] }), _jsx(SelectableEquipment, { id: "DTR_GAUGE", children: _jsx(Gauge, { gauge: "DTR" }) }), _jsx(SelectableEquipment, { id: "DELIVERY_DEFLECTOR", children: _jsx(DeflectorRoll, { station: "DELIVERY" }) }), _jsx(SelectableEquipment, { id: "CROP_SHEAR", children: _jsx(CropShear, {}) }), _jsx(SelectableEquipment, { id: "DTR", children: _jsx(Coiler, { reel: "DTR" }) }), _jsx(SelectableEquipment, { id: "COIL_HANDLING", children: _jsx(CoilHandling, {}) }), _jsx(MillEnclosure, {}), _jsx(EquipmentMarker, {}), _jsx(TensionSystem, {}), _jsx(ForceVisualization, {}), _jsx(TwinLabels, {})] }) }) }), _jsx(TwinFrozenNotice, {})] }), _jsx(EquipmentInspector, {}), _jsxs("div", { className: "border-line text-text-dim bg-base-900 flex shrink-0 flex-wrap justify-between gap-x-4 gap-y-1 border-t px-3 py-1.5 text-micro", children: [_jsx("span", { children: "Drag to orbit / Scroll or pinch to zoom" }), _jsxs("span", { children: ["Strip section x", millConfig.visual.stripThicknessExaggeration, " / Roll gap x", millConfig.visual.rollGapExaggeration, " for legibility. Values are true."] })] })] }) }));
}
/**
 * Camera policy — §10.7: "Default: engineering 3/4 isometric. Orbit + zoom
 * allowed, clamped so the machine cannot be lost. Persistent RESET VIEW."
 *
 * Panning is disabled rather than clamped: on a mill this wide, a pan is the
 * one gesture that reliably loses the machine off-screen.
 */
function SceneCamera({ zoom }) {
    const controlsRef = useRef(null);
    const previousZoom = useRef(zoom);
    const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
    const resetToken = useUiStore((s) => s.cameraResetToken);
    const view = useUiStore((s) => s.cameraView);
    const { cameraHome, cameraTarget, cameraStand, cameraStandTarget, cameraEntry, cameraEntryTarget, cameraFov, cameraMinDistance, cameraMaxDistance, } = millConfig.visual;
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls)
            return;
        const position = view === 'STAND' ? cameraStand : view === 'ENTRY' ? cameraEntry : cameraHome;
        const target = view === 'STAND' ? cameraStandTarget : view === 'ENTRY' ? cameraEntryTarget : cameraTarget;
        // Keep the wide pass line in frame when the workspace narrows.
        const offset = new Vector3(...position).sub(new Vector3(...target));
        offset.multiplyScalar(Math.max(1, Math.min(2.4, 1.65 / aspect)));
        offset.clampLength(cameraMinDistance, cameraMaxDistance);
        controls.object.position.copy(new Vector3(...target).add(offset));
        controls.target.set(...target);
        controls.update();
    }, [resetToken, view, aspect, cameraHome, cameraTarget, cameraStand, cameraStandTarget, cameraEntry, cameraEntryTarget, cameraMinDistance, cameraMaxDistance]);
    useEffect(() => {
        const delta = zoom - previousZoom.current;
        previousZoom.current = zoom;
        const controls = controlsRef.current;
        if (!controls || !delta)
            return;
        const offset = controls.object.position.clone().sub(controls.target);
        offset.multiplyScalar(Math.pow(0.8, delta)).clampLength(cameraMinDistance, cameraMaxDistance);
        controls.object.position.copy(controls.target).add(offset);
        controls.update();
    }, [zoom, cameraMinDistance, cameraMaxDistance]);
    return (_jsxs(_Fragment, { children: [_jsx(PerspectiveCamera, { makeDefault: true, fov: cameraFov, near: 0.1, far: 120, position: cameraHome }), _jsx(OrbitControls, { ref: controlsRef, target: cameraTarget, enablePan: false, enableDamping: true, dampingFactor: 0.08, minDistance: cameraMinDistance, maxDistance: cameraMaxDistance, 
                // Stay above the floor plane; looking up from underneath a rolling mill
                // is not a view any engineer wants.
                maxPolarAngle: Math.PI * 0.495, minPolarAngle: Math.PI * 0.06 })] }));
}
/**
 * Soft studio industrial lighting (§10.5).
 *
 * The important part is the ENVIRONMENT, not the lamps. Polished steel is
 * `metalness: 0.95`, and a metal has no diffuse response — it renders as
 * whatever it reflects. With no environment map a work roll is literally black
 * no matter how many lights are aimed at it, which is what makes naive PBR mill
 * scenes look like dark slabs.
 *
 * The environment here is built from Lightformers rather than an HDRI file:
 * it renders once into a small cube target, costs nothing per frame, and adds
 * no external asset — which matters for a screen that has to run on an isolated
 * plant network.
 */
function Lighting() {
    // The line runs from the pay-off reel to the delivery tension reel. Both the
    // environment and the shadow camera are sized from it, so extending the line in
    // millConfig cannot leave one end of the mill unlit and unshadowed.
    const centreX = (LINE.maxX + LINE.minX) / 2;
    const halfSpan = (LINE.maxX - LINE.minX) / 2 + 2;
    // A directional light's shadow camera looks at the scene ORIGIN, not at the
    // line centre, so its frustum has to be measured from the origin too —
    // otherwise the far end of an off-centre line falls outside it and silently
    // stops casting.
    const shadowHalf = Math.max(Math.abs(LINE.minX), Math.abs(LINE.maxX)) + 2;
    const shadowTop = SCENE.housingTop + 2;
    return (_jsxs(_Fragment, { children: [_jsxs(Environment, { resolution: 256, frames: 1, children: [_jsx(Lightformer, { intensity: 2.4, color: "#f2f7fc", position: [centreX, 8, 0], rotation: [Math.PI / 2, 0, 0], scale: [halfSpan * 2, 12, 1] }), _jsx(Lightformer, { intensity: 1.1, color: "#c4e0f5", position: [centreX - halfSpan - 1, 2.5, 3], rotation: [0, Math.PI / 2, 0], scale: [11, 7, 1] }), _jsx(Lightformer, { intensity: 0.85, color: "#dce5ee", position: [centreX + halfSpan + 1, 2, -4], rotation: [0, -Math.PI / 2, 0], scale: [11, 7, 1] }), _jsx(Lightformer, { intensity: 0.35, color: "#d4e0eb", position: [centreX, -5, 0], rotation: [-Math.PI / 2, 0, 0], scale: [halfSpan * 2, 12, 1] })] }), _jsx("hemisphereLight", { args: ['#edf6ff', '#aebfcd', 1.4] }), _jsx("directionalLight", { position: [centreX + 7, 11, 7 * millConfig.visual.cameraSideZ], intensity: 2.1, castShadow: true, "shadow-mapSize": [2048, 2048], "shadow-camera-left": -shadowHalf, "shadow-camera-right": shadowHalf, "shadow-camera-top": shadowTop, "shadow-camera-bottom": -shadowTop, "shadow-camera-near": 0.5, "shadow-camera-far": 48, "shadow-bias": -0.0008 }), _jsx("directionalLight", { position: [centreX - 8, 5, 6], intensity: 0.9, color: "#d5eaff" }), _jsx("directionalLight", { position: [centreX + 2, 1, 11 * millConfig.visual.cameraSideZ], intensity: 0.7, color: "#edf5fc" })] }));
}
function TwinFrozenNotice() {
    const communication = useMachineStore((s) => s.state.communication);
    if (communication.connected && !communication.stale)
        return null;
    return (_jsx("div", { className: "stale-hatch pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3", role: "status", children: _jsxs("div", { className: "border-alarm/70 bg-base-900/95 rounded-lg border px-4 py-3 text-center shadow-sm", children: [_jsx("div", { className: "text-alarm text-sm font-semibold", children: communication.connected ? 'DATA STALE' : 'DATA SOURCE DISCONNECTED' }), _jsx("div", { className: "text-text-dim mt-1 text-meta", children: "TWIN FROZEN - NOT SHOWING LIVE MACHINE STATE" }), _jsxs("div", { className: "text-text-dim num mt-1 text-micro", children: ["LAST VALID DATA: ", communication.lastValidTimestamp ? new Date(communication.lastValidTimestamp).toLocaleTimeString() : 'NEVER'] })] }) }));
}
/** Re-exported so the dashboard can show the twin's connection state inline. */
export function useTwinConnected() {
    return useMachineStore((s) => s.state.communication.connected);
}
