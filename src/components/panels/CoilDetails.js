import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * COIL PANEL — §11.4.
 *
 * "Coil ID, width, input/current/target/final thickness, length, remaining
 *  length, diameter, pass"
 */
import { formatDuration, passTimeRemaining, throughput } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { DerivedRow, ReadoutRow } from '../common/ValueReadout';
import { Panel } from '../common/Panel';
export function CoilDetails() {
    const state = useMachineStore((s) => s.state);
    const grade = state.coil.grade;
    return (_jsxs(Panel, { title: "Coil / entry", children: [_jsxs("div", { className: "mb-2", children: [_jsx("div", { className: "label", children: "COIL ID" }), _jsx("div", { className: "num text-text text-body tracking-tight", children: state.coil.id }), _jsx("div", { className: "text-text-faint mt-0.5 text-micro", children: grade ?? (_jsx("span", { className: "text-prov-notag border-prov-notag/60 border border-dashed px-1", children: "GRADE \u2014 NO TAG" })) })] }), _jsxs("div", { className: "border-line border-t pt-1.5", children: [_jsx(ReadoutRow, { label: "Strip width", tagName: "STRIP.WIDTH", decimals: 0 }), _jsx(ReadoutRow, { label: "Entry thickness", tagName: "STRIP.THICKNESS.ENTRY", decimals: 3 }), _jsx(ReadoutRow, { label: "Exit thickness", tagName: "STRIP.THICKNESS", decimals: 3 }), _jsx(ReadoutRow, { label: "Target this pass", tagName: "STRIP.THICKNESS.REF", decimals: 3 }), _jsx(ReadoutRow, { label: "Reduction", tagName: "STRIP.REDUCTION", decimals: 2 })] }), _jsxs("div", { className: "border-line mt-1.5 border-t pt-1.5", children: [_jsx(ReadoutRow, { label: "Coil length", tagName: "COIL.LENGTH", decimals: 0 }), _jsx(ReadoutRow, { label: "Remaining this pass", tagName: "COIL.REMAINING_LENGTH", decimals: 0 }), _jsx(ReadoutRow, { label: "Payoff diameter", tagName: "COIL.DIAMETER", decimals: 0 })] }), _jsxs("div", { className: "border-line mt-1.5 border-t pt-1.5", children: [_jsx(DerivedRow, { label: "Pass time remaining", value: formatDuration(passTimeRemaining(state)), title: "Remaining length divided by the mass-flow entry speed" }), _jsx(DerivedRow, { label: "Throughput", value: throughput(state).toFixed(1), unit: "t/h", title: "h \u00D7 w \u00D7 v \u00D7 \u03C1 at the delivered section" }), _jsx(DerivedRow, { label: "Final thickness", value: state.coil.finalThickness.toFixed(3), unit: "mm", tone: "dim" })] })] }));
}
