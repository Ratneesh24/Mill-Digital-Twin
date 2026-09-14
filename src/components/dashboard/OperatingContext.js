import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * OPERATING CONTEXT — the six facts that frame everything else on the screen.
 *
 *   COIL · GRADE · WIDTH · PASS · DIRECTION · MILL STATE
 *
 * Sits directly under the page title so process context is established before
 * the operator reads a single number. Deliberately not a KPI row: these are
 * identity and state, not measurements, so they get no setpoint or deviation.
 */
import { ArrowLeft, ArrowRight, Boxes, Layers, MoveHorizontal, Repeat2, Activity, Ruler } from 'lucide-react';
import { STATUS_LABEL } from '../../machine/machineStateMachine';
import { useMachineStore } from '../../store/machineStore';
import { ValueReadout } from '../common/ValueReadout';
import { Progress } from '../ui/primitives';
import { cn } from '../ui/cn';
export function OperatingContext() {
    const coilId = useMachineStore((s) => s.state.coil.id);
    const grade = useMachineStore((s) => s.state.coil.grade);
    const pass = useMachineStore((s) => s.state.pass);
    const direction = useMachineStore((s) => s.state.rollingDirection);
    const status = useMachineStore((s) => s.state.machineStatus);
    const stateTone = status === 'ROLLING'
        ? 'text-healthy'
        : status === 'FAST_STOP' || status === 'FAULT'
            ? 'text-trip alarm-pulse'
            : status === 'REVERSING' || status === 'DECELERATING'
                ? 'text-warning'
                : 'text-text-dim';
    return (_jsxs("section", { "aria-label": "Operating context", className: "operating-context border-line bg-base-900 border", children: [_jsx(Cell, { label: "CURRENT COIL", icon: _jsx(Boxes, { size: 16, "aria-hidden": true }), children: _jsx("span", { className: "num text-text text-value font-semibold", children: coilId }) }), _jsx(Cell, { label: "GRADE", icon: _jsx(Layers, { size: 16, "aria-hidden": true }), children: grade ? (_jsx("span", { className: "text-text text-body font-semibold", children: grade })) : (_jsx(ValueReadout, { tagName: "COIL.GRADE", size: "sm" })) }), _jsx(Cell, { label: "WIDTH", icon: _jsx(Ruler, { size: 16, "aria-hidden": true }), children: _jsx(ValueReadout, { tagName: "STRIP.WIDTH", size: "md", decimals: 0, hideBadge: true }) }), _jsxs(Cell, { label: "CURRENT PASS", icon: _jsx(Repeat2, { size: 16, "aria-hidden": true }), children: [_jsxs("span", { className: "num text-text text-value font-semibold", children: [pass.current, _jsxs("span", { className: "text-text-faint text-body", children: [" / ", pass.total] })] }), _jsx("div", { className: "mt-1.5 w-full max-w-[140px]", children: _jsx(Progress, { value: pass.total > 0 ? (pass.current / pass.total) * 100 : 0, ariaLabel: `Pass ${pass.current} of ${pass.total}` }) })] }), _jsx(Cell, { label: "DIRECTION", icon: _jsx(MoveHorizontal, { size: 16, "aria-hidden": true }), children: _jsxs("span", { className: cn('text-value inline-flex items-center gap-1.5 font-semibold', direction === 'FORWARD' ? 'text-normal' : 'text-prov-simulated'), children: [direction === 'FORWARD' ? (_jsx(ArrowRight, { size: 17, "aria-hidden": true })) : (_jsx(ArrowLeft, { size: 17, "aria-hidden": true })), direction] }) }), _jsx(Cell, { label: "MILL STATE", icon: _jsx(Activity, { size: 16, "aria-hidden": true }), children: _jsx("span", { className: cn('num text-value font-semibold tracking-tight', stateTone), children: STATUS_LABEL[status] }) })] }));
}
function Cell({ label, icon, children }) {
    return (_jsxs("div", { className: "ctx-cell min-w-0", children: [icon && (_jsx("span", { "aria-hidden": true, className: "ctx-ico", children: icon })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "label truncate", children: label }), _jsx("div", { className: "mt-1 truncate", children: children })] })] }));
}
