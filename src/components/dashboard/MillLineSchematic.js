import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MILL LINE SCHEMATIC — animated SVG of the 4HI reversing line.
 *
 * Payoff → entry strip → mill stand (WR/BUR) → exit strip → coiler.
 * Pure SVG + CSS animation: no canvas, no recharts, so the dashboard layout
 * probe (which forbids both on /dashboard) keeps passing.
 *
 * Force arrows scale with ROLL.FORCE.ACTUAL; strip flow reverses with
 * rolling direction; entry/exit labels swap like the 3D overlay does.
 */
import { useMachineStore } from '../../store/machineStore';
export function MillLineSchematic() {
    const direction = useMachineStore((s) => s.state.rollingDirection);
    const force = useMachineStore((s) => s.state.rolling.forceActual);
    const speed = useMachineStore((s) => s.state.speed.actual);
    const gap = useMachineStore((s) => s.state.geometry.gapActual);
    const status = useMachineStore((s) => s.state.machineStatus);
    const fwd = direction === 'FORWARD';
    // Arrow length from force (clamped so idle still shows the glyph).
    const arrow = Math.max(8, Math.min(30, (force / 400) * 30));
    const rolling = status === 'ROLLING';
    const flowClass = rolling ? (fwd ? 'strip-flow' : 'strip-flow-rev') : undefined;
    const steel = 'var(--color-brand)';
    const dim = 'var(--color-text-faint)';
    return (_jsxs("svg", { viewBox: "0 0 640 170", role: "img", "aria-label": `Mill line schematic, rolling ${direction.toLowerCase()} at ${speed.toFixed(0)} metres per minute`, className: "mill-schematic", preserveAspectRatio: "xMidYMid meet", children: [_jsx("line", { x1: "16", y1: "140", x2: "624", y2: "140", stroke: "var(--color-line)", strokeWidth: "1.5" }), _jsx(CoilGlyph, { x: 70, y: 104, label: fwd ? 'PAYOFF' : 'COILER', spinning: rolling }), _jsx(CoilGlyph, { x: 570, y: 104, label: fwd ? 'COILER' : 'PAYOFF', spinning: rolling }), _jsx("line", { x1: "102", y1: "104", x2: "252", y2: "104", stroke: steel, strokeWidth: "4", strokeLinecap: "round", className: flowClass, opacity: rolling ? 1 : 0.45 }), _jsx("line", { x1: "388", y1: "104", x2: "538", y2: "104", stroke: steel, strokeWidth: "4", strokeLinecap: "round", className: flowClass, opacity: rolling ? 1 : 0.45 }), _jsx("circle", { cx: "150", cy: "112", r: "7", fill: "var(--color-base-800)", stroke: dim, strokeWidth: "1.5" }), _jsx("circle", { cx: "490", cy: "112", r: "7", fill: "var(--color-base-800)", stroke: dim, strokeWidth: "1.5" }), _jsx("rect", { x: "252", y: "30", width: "26", height: "110", rx: "5", fill: "var(--color-base-800)", stroke: dim, strokeWidth: "1.5" }), _jsx("rect", { x: "362", y: "30", width: "26", height: "110", rx: "5", fill: "var(--color-base-800)", stroke: dim, strokeWidth: "1.5" }), _jsx("rect", { x: "252", y: "24", width: "136", height: "10", rx: "4", fill: "var(--color-base-800)", stroke: dim, strokeWidth: "1.5" }), _jsx("circle", { cx: "320", cy: "58", r: "22", fill: "var(--color-base-700)", stroke: dim, strokeWidth: "1.5" }), _jsx("circle", { cx: "320", cy: "150", r: "22", fill: "var(--color-base-700)", stroke: dim, strokeWidth: "1.5", opacity: "0" }), _jsx("circle", { cx: "320", cy: "146", r: "22", fill: "var(--color-base-700)", stroke: dim, strokeWidth: "1.5" }), _jsx("circle", { cx: "320", cy: "90", r: "13", fill: "var(--color-brand)", opacity: "0.85" }), _jsx("circle", { cx: "320", cy: "118", r: "13", fill: "var(--color-brand-deep)", opacity: "0.85" }), _jsx("line", { x1: "348", y1: "90", x2: "348", y2: "118", stroke: "var(--color-warning)", strokeWidth: "1.5", strokeDasharray: "3 3" }), _jsxs("text", { x: "354", y: "108", fontSize: "11", fill: "var(--color-text-dim)", fontFamily: "var(--font-mono)", children: [gap.toFixed(3), " mm"] }), _jsxs("g", { stroke: "var(--color-alarm)", strokeWidth: "2.5", strokeLinecap: "round", opacity: force > 1 ? 1 : 0.3, children: [_jsx("line", { x1: "320", y1: 58 - arrow, x2: "320", y2: "36" }), _jsx("polyline", { points: `314,${42} 320,${36} 326,${42}`, fill: "none" }), _jsx("line", { x1: "320", y1: 146 + arrow, x2: "320", y2: "168" }), _jsx("polyline", { points: `314,${162} 320,${168} 326,${162}`, fill: "none" })] }), _jsxs("text", { x: "320", y: "20", textAnchor: "middle", fontSize: "11", fontWeight: "700", fill: "var(--color-text-dim)", fontFamily: "var(--font-mono)", children: [force.toFixed(0), " kN"] }), _jsx(DirectionChevrons, { fwd: fwd, active: rolling }), _jsxs("text", { x: "320", y: "162", textAnchor: "middle", fontSize: "11", fill: "var(--color-text-faint)", fontFamily: "var(--font-mono)", children: [fwd ? 'ENTRY → EXIT' : '← ENTRY · EXIT SWAPPED', " \u00B7 ", speed.toFixed(0), " m/min"] })] }));
}
function CoilGlyph({ x, y, label, spinning }) {
    return (_jsxs("g", { children: [_jsx("circle", { cx: x, cy: y, r: "30", fill: "var(--color-base-800)", stroke: "var(--color-line-bright)", strokeWidth: "2" }), _jsx("circle", { cx: x, cy: y, r: "19", fill: "none", stroke: "var(--color-brand)", strokeWidth: "3", opacity: "0.7" }), _jsx("g", { stroke: "var(--color-text-faint)", strokeWidth: "2", opacity: "0.8", children: _jsx("line", { x1: x, y1: y, x2: x + 19, y2: y, style: spinning ? { transformOrigin: `${x}px ${y}px`, animation: 'coil-spin 3s linear infinite' } : undefined }) }), _jsx("circle", { cx: x, cy: y, r: "5", fill: "var(--color-text-faint)" }), _jsx("text", { x: x, y: y + 46, textAnchor: "middle", fontSize: "10", letterSpacing: "1.5", fill: "var(--color-text-faint)", fontFamily: "var(--font-sans)", fontWeight: "700", children: label })] }));
}
function DirectionChevrons({ fwd, active }) {
    const pts = fwd
        ? ['250,72 258,80 250,88', '264,72 272,80 264,88', '278,72 286,80 278,88']
        : ['390,72 382,80 390,88', '376,72 368,80 376,88', '362,72 354,80 362,88'];
    return (_jsx("g", { stroke: "var(--color-healthy)", strokeWidth: "2.5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", opacity: active ? 1 : 0.25, children: pts.map((p) => (_jsx("polyline", { points: p }, p))) }));
}
