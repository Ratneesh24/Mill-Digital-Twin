import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PROCESS CONTROL PANEL — §11.4.
 *
 *   "AGC, THFB, THFF, SPFF, MFC, TRF, position mode, roll bending,
 *    roll gap closed → ON / OFF / FAULT"
 *
 * Terminology is the reference HMI's, used as the mill uses it (§21). Each entry
 * carries a one-line explanation, because a twin that shows an acronym without
 * saying what it controls is a screenshot, not an engineering tool.
 */
import { useMachineStore } from '../../store/machineStore';
import { ControlPill, Panel } from '../common/Panel';
const CONTROLS = [
    ['agc', 'AGC', 'Automatic gauge control — closes the thickness loop on the gaugemeter h = S0 + F/M'],
    ['thfb', 'THFB', 'Thickness feedback — trims the gap from the exit X-ray gauge'],
    ['thff', 'THFF', 'Thickness feed-forward — trims the gap from the entry gauge before the disturbance reaches the bite'],
    ['spff', 'SPFF', 'Speed feed-forward — compensates the gap for speed-dependent friction change'],
    ['mfc', 'MFC', 'Mass flow control — holds h_entry·v_entry = h_exit·v_exit'],
    ['trf', 'TRF', 'Tension regulation — holds the reel tension references'],
    ['positionMode', 'POSITION MODE', 'Capsule held on position rather than on thickness — AGC open'],
    ['rollGapClosed', 'ROLL GAP CLOSED', 'Rolls are down on the strip'],
    ['bending', 'ROLL BENDING', 'Work roll bending control'],
];
export function ControlStatus() {
    const controls = useMachineStore((s) => s.state.controls);
    return (_jsx(Panel, { title: "Process control", children: _jsx("div", { className: "space-y-[3px]", children: CONTROLS.map(([key, label, help]) => (_jsxs("div", { className: "flex items-center justify-between gap-2", title: help, children: [_jsx("span", { className: "label truncate", children: label }), _jsx(ControlPill, { state: controls[key] })] }, key))) }) }));
}
