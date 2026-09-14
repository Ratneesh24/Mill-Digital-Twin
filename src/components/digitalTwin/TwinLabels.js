import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * IN-SCENE LABELS — §10.6.
 *
 * "ENTRY · EXIT · DTR · ETR · POR · UPPER BACKUP ROLL · UPPER WORK ROLL ·
 *  LOWER WORK ROLL · LOWER BACKUP ROLL · ROLL GAP (with value) · ROLL FORCE ·
 *  ENTRY TENSION · EXIT TENSION. Only important values live in the 3D scene."
 *
 * The value-bearing labels use the SAME `ValueReadout` component as the KPI bar
 * and the detail panels. That is not a convenience — it is the §18 requirement
 * that "the value beside the machine == MachineState == the trend chart" made
 * structurally impossible to violate: there is one component that prints a
 * process value, and it takes a tag name.
 *
 * ENTRY and EXIT are positioned from the rolling direction every frame, so they
 * swap sides on a reversal exactly when the strip does (§1).
 */
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { millConfig } from '../../config/millConfig';
import { useUiStore } from '../../store/uiStore';
import { ValueReadout } from '../common/ValueReadout';
import { useTwinFrame } from './TwinContext';
import { rollGapToScene } from '../../config/unitConversion';
import { backupRollCentreY, LINE, SCENE, workRollCentreY } from './twinMaterials';
/** Shared chrome for every scene label. */
function LabelChip({ children, tone = 'default', }) {
    const toneClass = tone === 'entry'
        ? 'border-normal/50 text-normal'
        : tone === 'exit'
            ? 'border-warning/50 text-warning'
            : 'border-line-bright text-text-dim';
    return (_jsx("div", { className: `pointer-events-none rounded border bg-base-900/95 px-2 py-1 text-micro leading-[13px] font-medium tracking-wide whitespace-nowrap shadow-sm ${toneClass}`, children: children }));
}
function StaticLabel({ position, text, tone, }) {
    return (_jsx(Html, { position: position, center: true, distanceFactor: undefined, zIndexRange: [10, 0], style: { pointerEvents: 'none' }, children: _jsx(LabelChip, { tone: tone, children: text }) }));
}
/** A label carrying a live value from a tag, badge and all. */
function ValueLabel({ position, title, tagName, decimals, }) {
    return (_jsx(Html, { position: position, center: true, zIndexRange: [10, 0], style: { pointerEvents: 'none' }, children: _jsxs("div", { className: "border-line-bright bg-base-900/95 pointer-events-none rounded-md border px-2 py-1 shadow-sm", children: [_jsx("div", { className: "text-text-dim text-micro leading-[12px] tracking-wide", children: title }), _jsx(ValueReadout, { tagName: tagName, size: "sm", decimals: decimals })] }) }));
}
/**
 * Label rows along the line, kept below the pass line and on the camera's side of
 * the barrel so they read in front of the equipment rather than through it.
 */
const STATION_LABEL_Y = SCENE.floorY + 0.34;
const AUX_LABEL_Y = SCENE.floorY + 0.06;
const STATION_LABEL_Z = (SCENE.housingZ + 0.5) * SCENE.cameraSideZ;
/** Nearer offset for chips that sit on the pass line rather than on the floor. */
const PASS_LINE_LABEL_Z = 0.7 * SCENE.cameraSideZ;
export function TwinLabels() {
    const show = useUiStore((s) => s.showSceneLabels);
    const view = useUiStore((s) => s.cameraView);
    const compact = useThree((s) => s.size.width < 620 || s.size.height < 300);
    if (!show)
        return null;
    return (_jsxs("group", { children: [view === 'STAND' && !compact && _jsx(RollStackLabels, {}), _jsx(EntryExitLabels, {}), _jsx(StaticLabel, { position: [LINE.porX, STATION_LABEL_Y, STATION_LABEL_Z], text: "POR" }), _jsx(StaticLabel, { position: [LINE.etrX, STATION_LABEL_Y, STATION_LABEL_Z], text: "ETR" }), _jsx(StaticLabel, { position: [LINE.dtrX, STATION_LABEL_Y, STATION_LABEL_Z], text: "DTR" }), !compact && (_jsxs(_Fragment, { children: [_jsx(StaticLabel, { position: [LINE.flattenerX, AUX_LABEL_Y, STATION_LABEL_Z], text: "PINCH ROLL / FLATTENER" }), _jsx(StaticLabel, { position: [LINE.entryDeflectorX, AUX_LABEL_Y, STATION_LABEL_Z], text: "ENTRY DEFLECTOR" }), _jsx(StaticLabel, { position: [LINE.deliveryDeflectorX, AUX_LABEL_Y, STATION_LABEL_Z], text: "DELIVERY DEFLECTOR" }), _jsx(StaticLabel, { position: [LINE.cropShearX, AUX_LABEL_Y, STATION_LABEL_Z], text: "CROP SHEAR" })] })), !compact && _jsx(ValueLabel, { position: [0, SCENE.floorY + 0.42, (SCENE.housingZ + 1.9) * SCENE.cameraSideZ], title: `ROLL GAP · GEOMETRY ×${millConfig.visual.rollGapExaggeration} FOR LEGIBILITY`, tagName: "ROLL.GAP.ACTUAL", decimals: 3 }), !compact && _jsx(ValueLabel, { position: [0, SCENE.housingTop + 0.42, 0], title: "ROLL FORCE", tagName: "ROLL.FORCE.ACTUAL", decimals: 0 }), !compact && _jsx(TensionLabels, {})] }));
}
/** Roll-stack labels follow the stack as the gap opens and closes. */
function RollStackLabels() {
    const upperWr = useRef(null);
    const lowerWr = useRef(null);
    const upperBur = useRef(null);
    const lowerBur = useRef(null);
    useTwinFrame((v) => {
        const gap = rollGapToScene(v.rollGap);
        if (upperWr.current)
            upperWr.current.position.y = workRollCentreY(gap, 'UPPER');
        if (lowerWr.current)
            lowerWr.current.position.y = workRollCentreY(gap, 'LOWER');
        if (upperBur.current)
            upperBur.current.position.y = backupRollCentreY(gap, 'UPPER');
        if (lowerBur.current)
            lowerBur.current.position.y = backupRollCentreY(gap, 'LOWER');
    });
    // Stacked out past the housing on the delivery side, clear of the gauge and
    // the deflector roll, and pulled towards the camera in Z so they read in front
    // of the stand rather than through it. Only shown in the STAND view, where the
    // camera is close enough for four stacked chips to separate.
    const x = SCENE.housingPostX + SCENE.burRadius * 2.4;
    const z = (SCENE.housingZ + 0.8) * SCENE.cameraSideZ;
    return (_jsxs("group", { children: [_jsx("group", { ref: upperBur, children: _jsx(StaticLabel, { position: [x, 0, z], text: "UPPER BACKUP ROLL" }) }), _jsx("group", { ref: upperWr, children: _jsx(StaticLabel, { position: [x, 0, z], text: "UPPER WORK ROLL" }) }), _jsx("group", { ref: lowerWr, children: _jsx(StaticLabel, { position: [x, 0, z], text: "LOWER WORK ROLL" }) }), _jsx("group", { ref: lowerBur, children: _jsx(StaticLabel, { position: [x, 0, z], text: "LOWER BACKUP ROLL" }) })] }));
}
/**
 * ENTRY and EXIT are LOGICAL ROLES (§1). These two labels are the most visible
 * expression of that rule: on a reversal they cross the mill.
 */
function EntryExitLabels() {
    const entryRef = useRef(null);
    const exitRef = useRef(null);
    useTwinFrame((v) => {
        // directionSign is damped, so the labels slide across rather than teleport.
        const x = Math.abs(LINE.deliveryDeflectorX) * 1.4;
        if (entryRef.current)
            entryRef.current.position.x = -x * v.directionSign;
        if (exitRef.current)
            exitRef.current.position.x = x * v.directionSign;
    });
    const y = SCENE.housingTop * 0.42;
    return (_jsxs("group", { children: [_jsx("group", { ref: entryRef, children: _jsx(StaticLabel, { position: [0, y, PASS_LINE_LABEL_Z], text: "ENTRY", tone: "entry" }) }), _jsx("group", { ref: exitRef, children: _jsx(StaticLabel, { position: [0, y, PASS_LINE_LABEL_Z], text: "EXIT", tone: "exit" }) })] }));
}
function TensionLabels() {
    const entryRef = useRef(null);
    const exitRef = useRef(null);
    useTwinFrame((v) => {
        // Out along the span, between the deflector roll and the reel, so the value
        // sits over the stretch of strip it actually describes.
        const x = Math.abs(LINE.dtrX) * 0.62;
        if (entryRef.current)
            entryRef.current.position.x = -x * v.directionSign;
        if (exitRef.current)
            exitRef.current.position.x = x * v.directionSign;
    });
    const y = SCENE.housingTop * 0.55;
    return (_jsxs("group", { children: [_jsx("group", { ref: entryRef, children: _jsx(ValueLabel, { position: [0, y, PASS_LINE_LABEL_Z], title: "ENTRY TENSION", tagName: "TENSION.ENTRY" }) }), _jsx("group", { ref: exitRef, children: _jsx(ValueLabel, { position: [0, y, PASS_LINE_LABEL_Z], title: "EXIT TENSION", tagName: "TENSION.EXIT" }) })] }));
}
