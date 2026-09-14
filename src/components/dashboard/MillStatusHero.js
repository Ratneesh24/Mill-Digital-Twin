import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MILL STATUS HERO — the visual-executive strip above the KPI ribbon.
 *
 * Three premium cards:
 *   1. Mill state (status word + direction + pass progress)
 *   2. Animated mill-line schematic (SVG, no canvas/chart libs)
 *   3. Drive load donut + speed + energy snapshot
 *
 * Tag values still come from ValueReadout / the store, so NO TAG honesty is
 * preserved — this strip only changes hierarchy, never data.
 */
import { ArrowLeft, ArrowRight, Flame, GaugeCircle, Zap } from 'lucide-react';
import { millConfig } from '../../config/millConfig';
import { STATUS_LABEL } from '../../machine/machineStateMachine';
import { specificEnergy, throughput } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { ValueReadout } from '../common/ValueReadout';
import { DonutGauge, Progress } from '../ui/primitives';
import { cn } from '../ui/cn';
import { MillLineSchematic } from './MillLineSchematic';
export function MillStatusHero() {
    const status = useMachineStore((s) => s.state.machineStatus);
    const direction = useMachineStore((s) => s.state.rollingDirection);
    const pass = useMachineStore((s) => s.state.pass);
    const speed = useMachineStore((s) => s.state.speed.actual);
    const load = useMachineStore((s) => s.state.drive.torquePercentage);
    const state = useMachineStore((s) => s.state);
    const fwd = direction === 'FORWARD';
    const passPct = pass.total > 0 ? (pass.current / pass.total) * 100 : 0;
    const tph = throughput(state);
    const spec = tph > 0.01 ? specificEnergy(state) : null;
    const accent = status === 'ROLLING'
        ? 'var(--color-healthy)'
        : status === 'FAST_STOP' || status === 'FAULT'
            ? 'var(--color-trip)'
            : status === 'REVERSING' || status === 'DECELERATING'
                ? 'var(--color-warning)'
                : 'var(--color-brand)';
    const stateTone = status === 'ROLLING'
        ? 'text-healthy'
        : status === 'FAST_STOP' || status === 'FAULT'
            ? 'text-trip alarm-pulse'
            : status === 'REVERSING' || status === 'DECELERATING'
                ? 'text-warning'
                : 'text-text';
    const loadTone = load >= 100 ? 'var(--color-trip)' : load >= 80 ? 'var(--color-warning)' : 'var(--color-healthy)';
    return (_jsxs("section", { "aria-label": "Mill status overview", className: "hero-grid", children: [_jsxs("div", { className: "hero-card border-line bg-base-900 border", style: { '--hero-accent': accent }, children: [_jsx("div", { className: "hero-state-glow", "aria-hidden": true }), _jsxs("p", { className: "label", children: ["Mill state \u00B7 Pass ", pass.current, "/", pass.total] }), _jsx("p", { className: cn('num mt-1 text-value-lg font-semibold tracking-tight', stateTone), children: STATUS_LABEL[status] }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-bold tracking-wider', fwd
                                    ? 'border-normal/40 bg-normal/10 text-normal'
                                    : 'border-prov-simulated/40 bg-prov-simulated/10 text-prov-simulated'), children: [fwd ? _jsx(ArrowRight, { size: 13, "aria-hidden": true }) : _jsx(ArrowLeft, { size: 13, "aria-hidden": true }), direction] }), _jsxs("span", { className: "text-text-dim text-micro num inline-flex items-center gap-1", children: [_jsx(GaugeCircle, { size: 13, "aria-hidden": true }), speed.toFixed(0), " m/min"] })] }), _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "mb-1.5 flex items-center justify-between", children: [_jsx("span", { className: "label", children: "Pass progress" }), _jsxs("span", { className: "num text-text-dim text-micro", children: [passPct.toFixed(0), "%"] })] }), _jsx(Progress, { value: passPct, ariaLabel: `Pass ${pass.current} of ${pass.total}` })] }), _jsxs("p", { className: "text-text-faint text-micro mt-2.5 truncate", children: [millConfig.identity.mill, " \u00B7 Coil ", state.coil.id] })] }), _jsxs("div", { className: "hero-card border-line bg-base-900 border", children: [_jsxs("div", { className: "mb-1 flex items-center justify-between gap-2", children: [_jsx("p", { className: "label", children: "4HI reversing line \u00B7 live" }), _jsxs("span", { className: "text-text-faint text-micro num hidden sm:inline", children: ["GAP ", _jsx(ValueReadout, { tagName: "ROLL.GAP.ACTUAL", size: "sm", decimals: 3, hideBadge: true, hideUnit: true }), ' mm · ', "FORCE ", _jsx(ValueReadout, { tagName: "ROLL.FORCE.ACTUAL", size: "sm", decimals: 0, hideBadge: true, hideUnit: true }), ' kN'] })] }), _jsx(MillLineSchematic, {})] }), _jsxs("div", { className: "hero-card border-line bg-base-900 flex items-center gap-4 border", style: { '--hero-accent': loadTone }, children: [_jsx(DonutGauge, { value: load, tone: loadTone, ariaLabel: `Motor load ${load.toFixed(1)} percent`, children: _jsxs("div", { className: "text-center leading-none", children: [_jsx("div", { className: "num text-text text-value font-bold", children: load.toFixed(0) }), _jsx("div", { className: "text-text-faint text-micro", children: "%" })] }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "label", children: ["Motor load \u00B7 of ", millConfig.ratings.mainDriveRatedTorque, " kNm"] }), _jsx("p", { className: cn('text-micro mt-1 font-bold tracking-wider', load >= 100 ? 'text-trip' : load >= 80 ? 'text-warning' : 'text-healthy'), children: load >= 100 ? 'OVERLOAD' : load >= 80 ? 'HIGH LOAD' : 'NORMAL' }), _jsxs("div", { className: "mt-2.5 grid grid-cols-2 gap-2 border-t border-line pt-2.5", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "label flex items-center gap-1", children: [_jsx(Zap, { size: 11, "aria-hidden": true }), " Power"] }), _jsx(ValueReadout, { tagName: "DRIVE.POWER", size: "md", decimals: 0, hideBadge: true })] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "label flex items-center gap-1", children: [_jsx(Flame, { size: 11, "aria-hidden": true }), " kWh/t"] }), _jsx("p", { className: "num text-text text-value font-semibold", children: spec === null ? '—' : spec.toFixed(1) })] })] })] })] })] }));
}
