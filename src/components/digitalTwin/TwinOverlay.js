import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** View controls stay outside the canvas so they never hide the roll bite. */
import { AlertTriangle, Expand, FastForward, Minus, Play, Plus, RotateCcw, Shrink, Square, TrendingUp, } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ROUTES } from '../../app/routes';
import { isStartable, STATUS_LABEL } from '../../machine/machineStateMachine';
import { interlockReadout } from '../../machine/interlockEngine';
import { selectInterlockChain, useMachineStore } from '../../store/machineStore';
import { useUiStore } from '../../store/uiStore';
import { cn } from '../ui/cn';
import { DirectionIndicator } from '../dashboard/DirectionIndicator';
const STATUS_TONE = {
    ROLLING: 'text-healthy border-healthy/50 bg-healthy/10',
    SKIN_PASS: 'text-healthy border-healthy/50 bg-healthy/10',
    THREADING: 'text-normal border-normal/50 bg-normal/10',
    REWIND: 'text-normal border-normal/50 bg-normal/10',
    DECELERATING: 'text-warning border-warning/50 bg-warning/10',
    REVERSING: 'text-warning border-warning/50 bg-warning/10',
    WARMUP: 'text-warning border-warning/50 bg-warning/10',
    READY: 'text-normal border-normal/40 bg-normal/5',
    IDLE: 'text-text-dim border-line bg-base-900',
    STOPPED: 'text-text-dim border-line bg-base-900',
    ROLL_CHANGE: 'text-text-dim border-line bg-base-900',
    FAST_STOP: 'text-trip border-trip/70 bg-trip/15 alarm-pulse',
    FAULT: 'text-alarm border-alarm/70 bg-alarm/15 alarm-pulse',
};
const CONTROL = 'min-h-10 rounded-[10px] border px-2.5 py-1.5 text-micro font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-normal disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-1.5';
const INACTIVE = 'border-line bg-base-900 text-text-dim hover:border-normal hover:text-normal';
const ACTIVE = 'border-normal/40 bg-normal/10 text-normal';
const CAMERA_VIEW_HINT = {
    LINE: 'Frame the whole pass line, pay-off reel to delivery tension reel',
    STAND: 'Inspect the roll stack',
    ENTRY: 'Frame the pay-off end: POR, peeler, flattener, carry-over table and ETR',
};
export function TwinOverlay({ expanded, onExpand, onZoom }) {
    const status = useMachineStore((s) => s.state.machineStatus);
    const reason = useMachineStore((s) => s.state.statusReason);
    const resetCamera = useUiStore((s) => s.resetCamera);
    const cameraView = useUiStore((s) => s.cameraView);
    const setCameraView = useUiStore((s) => s.setCameraView);
    const showLabels = useUiStore((s) => s.showSceneLabels);
    const toggleLabels = useUiStore((s) => s.toggleSceneLabels);
    const showArrows = useUiStore((s) => s.showForceArrows);
    const toggleArrows = useUiStore((s) => s.toggleForceArrows);
    const navigate = useNavigate();
    return (_jsxs("header", { className: "border-line bg-base-900 relative z-20 shrink-0 border-b px-3 py-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2", children: [_jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [_jsx("span", { className: cn('rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide', STATUS_TONE[status]), children: STATUS_LABEL[status] }), _jsx(DirectionIndicator, {})] }), _jsx(MillCommandStrip, {})] }), reason && _jsx("p", { className: "text-text-dim mt-1 break-words text-micro leading-snug", children: reason }), _jsxs("div", { role: "group", "aria-label": "3D view controls", className: "mt-2 flex flex-wrap items-center gap-1.5", children: [_jsx("div", { role: "group", "aria-label": "Camera preset", className: "flex gap-1", children: ['LINE', 'STAND', 'ENTRY'].map((view) => (_jsx("button", { type: "button", "aria-pressed": cameraView === view, title: CAMERA_VIEW_HINT[view], onClick: () => setCameraView(view), className: cn(CONTROL, cameraView === view ? ACTIVE : INACTIVE), children: view }, view))) }), _jsxs("button", { type: "button", onClick: resetCamera, title: "Restore the selected camera preset", className: cn(CONTROL, INACTIVE), children: [_jsx(RotateCcw, { size: 13, "aria-hidden": true }), "RESET VIEW"] }), _jsx("button", { type: "button", "aria-label": "Zoom in", onClick: () => onZoom(1), className: cn(CONTROL, INACTIVE, 'min-w-10'), children: _jsx(Plus, { size: 14, "aria-hidden": true }) }), _jsx("button", { type: "button", "aria-label": "Zoom out", onClick: () => onZoom(-1), className: cn(CONTROL, INACTIVE, 'min-w-10'), children: _jsx(Minus, { size: 14, "aria-hidden": true }) }), _jsx("button", { type: "button", "aria-pressed": showLabels, onClick: toggleLabels, title: "Show or hide equipment labels and tag readouts", className: cn(CONTROL, showLabels ? ACTIVE : INACTIVE), children: "LABELS" }), _jsx("button", { type: "button", "aria-pressed": showArrows, onClick: toggleArrows, title: "Show or hide roll-force vectors; strip direction markers remain visible", className: cn(CONTROL, showArrows ? ACTIVE : INACTIVE), children: "FORCE VECTORS" }), _jsxs("button", { type: "button", "aria-pressed": expanded, onClick: onExpand, title: "Toggle fullscreen view; press Escape to exit", className: cn(CONTROL, INACTIVE, 'ml-auto'), children: [expanded ? _jsx(Shrink, { size: 13, "aria-hidden": true }) : _jsx(Expand, { size: 13, "aria-hidden": true }), expanded ? 'EXIT EXPANDED' : 'EXPAND VIEW'] }), _jsxs("button", { type: "button", onClick: () => navigate(ROUTES.trends), title: "Open the real-time trends page; the simulation keeps running", className: cn(CONTROL, INACTIVE), children: [_jsx(TrendingUp, { size: 13, "aria-hidden": true }), "TRENDS"] })] })] }));
}
/**
 * Simulation commands — never a path to control the LIVE mill.
 *
 * A blocked START never vanishes silently: the button stays clickable, explains
 * exactly what is holding the mill (interlock cause, feed state or resettable
 * latch), and points at RESET when a reset is what unblocks it.
 */
function MillCommandStrip() {
    const mode = useMachineStore((s) => s.state.operatingMode);
    const status = useMachineStore((s) => s.state.machineStatus);
    const comm = useMachineStore((s) => s.state.communication);
    const chain = useMachineStore(selectInterlockChain);
    const send = useMachineStore((s) => s.sendCommand);
    const readOnly = mode === 'LIVE';
    const readout = interlockReadout(chain);
    const feedDown = !comm.connected || comm.stale;
    const needsReset = status === 'FAST_STOP' || status === 'FAULT';
    const startableState = isStartable(status);
    const canStart = !readOnly && startableState && chain.millReady && !feedDown && !needsReset;
    const blockReason = readOnly
        ? 'LIVE mode is read-only — switch to SIMULATION to drive the mill.'
        : needsReset
            ? `Mill is in ${STATUS_LABEL[status]} — press RESET before START.`
            : !startableState
                ? `START is not meaningful while ${STATUS_LABEL[status]}.`
                : feedDown
                    ? `Data feed ${comm.connected ? 'is STALE' : 'is LOST'} — START waits for fresh data.`
                    : !chain.millReady
                        ? (readout.reason ?? 'Mill interlock is holding the start.')
                        : null;
    const handleStart = () => {
        if (readOnly || canStart) {
            if (!readOnly)
                send({ type: 'START' });
            return;
        }
        toast.error('START blocked', { description: blockReason ?? undefined });
    };
    return (_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { role: "group", "aria-label": readOnly ? 'Machine commands disabled in LIVE mode' : 'Simulation commands', className: "flex flex-wrap items-center gap-1.5", children: [_jsx("span", { className: cn('text-micro font-semibold tracking-wide', readOnly ? 'text-alarm' : 'text-prov-simulated'), children: readOnly ? 'LIVE - READ ONLY' : 'SIMULATION CONTROL' }), _jsxs("button", { type: "button", disabled: readOnly, onClick: handleStart, title: canStart ? 'Start rolling' : (blockReason ?? 'Start rolling'), "aria-disabled": !canStart, className: cn(CONTROL, canStart
                            ? 'border-healthy/40 bg-healthy/5 text-healthy hover:bg-healthy/10'
                            : 'border-line text-text-faint bg-base-900'), children: [_jsx(Play, { size: 13, "aria-hidden": true }), "START"] }), _jsxs("button", { type: "button", disabled: readOnly, onClick: () => send({ type: 'STOP' }), className: cn(CONTROL, INACTIVE), children: [_jsx(Square, { size: 13, "aria-hidden": true }), "STOP"] }), _jsxs("button", { type: "button", disabled: readOnly, onClick: () => send({ type: 'FAST_STOP' }), className: cn(CONTROL, 'border-trip/40 bg-trip/5 text-trip hover:bg-trip/10'), children: [_jsx(FastForward, { size: 13, "aria-hidden": true }), "FAST STOP"] }), _jsxs("button", { type: "button", disabled: readOnly, onClick: () => send({ type: 'RESET' }), title: needsReset ? 'Clear the latch so the mill can start again' : 'Reset latched stops', className: cn(CONTROL, needsReset
                            ? 'border-warning/60 bg-warning/10 text-warning alarm-pulse'
                            : INACTIVE), children: [_jsx(RotateCcw, { size: 13, "aria-hidden": true }), "RESET"] })] }), !readOnly && blockReason && (_jsxs("p", { role: "status", className: "text-warning mt-1 flex items-start gap-1 text-micro leading-snug", children: [_jsx(AlertTriangle, { size: 12, "aria-hidden": true, className: "mt-px shrink-0" }), _jsx("span", { children: blockReason })] }))] }));
}
