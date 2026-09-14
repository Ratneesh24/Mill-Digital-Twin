import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SYSTEM STATUS — one box, every subsystem, with an overall verdict.
 *
 * Replaces the old scatter of Process Control / Mill Interlock / auxiliary
 * pills across three panels. An operator asking "is anything wrong?" should
 * find the answer in one place, and an abnormal system should be identifiable
 * without reading every row.
 *
 * HONESTY NOTE — on the CRM04 46-tag extract almost every row here is NO TAG:
 * the plant does not publish control-mode words, interlock states or auxiliary
 * health. That is the truthful picture and is exactly what §7.4 demands we
 * show. A green tick on a row we cannot actually see would be a lie, and the
 * OVERALL verdict below deliberately refuses to claim health it cannot verify.
 */
import { useMachineStore } from '../../store/machineStore';
import { ControlPill, HealthPill, Panel } from '../common/Panel';
import { cn } from '../ui/cn';
function fromInterlock(value) {
    if (value === null)
        return 'UNKNOWN';
    return value ? 'GOOD' : 'BAD';
}
function fromControl(state) {
    if (state === 'NO_TAG' || state === 'UNKNOWN')
        return 'UNKNOWN';
    if (state === 'FAULT')
        return 'BAD';
    return 'GOOD';
}
function fromHealth(health) {
    if (health === 'NO_TAG' || health === 'UNKNOWN')
        return 'UNKNOWN';
    if (health === 'FAULT' || health === 'WARNING')
        return 'BAD';
    return 'GOOD';
}
export function SystemStatusBoard() {
    const state = useMachineStore((s) => s.state);
    const { controls, interlocks, auxiliarySystems: aux, communication: comm } = state;
    const commState = comm.connected ? (comm.stale ? 'FAULT' : 'ON') : 'FAULT';
    // E-stop is inverted: pressed (true) is the abnormal condition.
    const safety = interlocks.emergencyStop === null ? null : !interlocks.emergencyStop;
    const rows = [
        { label: 'MILL', node: _jsx(InterlockPill, { value: interlocks.mill }), verdict: fromInterlock(interlocks.mill) },
        { label: 'DRIVE', node: _jsx(InterlockPill, { value: interlocks.drive }), verdict: fromInterlock(interlocks.drive) },
        { label: 'HYDRAULIC', node: _jsx(InterlockPill, { value: interlocks.hydraulic }), verdict: fromInterlock(interlocks.hydraulic) },
        { label: 'GAUGE', node: _jsx(InterlockPill, { value: interlocks.gauge }), verdict: fromInterlock(interlocks.gauge) },
        { label: 'TENSION CONTROL', node: _jsx(ControlPill, { state: controls.trf }), verdict: fromControl(controls.trf) },
        { label: 'COOLING', node: _jsx(HealthPill, { health: aux.coolant }), verdict: fromHealth(aux.coolant) },
        { label: 'LUBRICATION', node: _jsx(HealthPill, { health: aux.lubrication }), verdict: fromHealth(aux.lubrication) },
        { label: 'EXHAUST', node: _jsx(HealthPill, { health: aux.exhaust }), verdict: fromHealth(aux.exhaust) },
        { label: 'AGC', node: _jsx(ControlPill, { state: controls.agc }), verdict: fromControl(controls.agc) },
        { label: 'WR BENDING', node: _jsx(ControlPill, { state: controls.bending }), verdict: fromControl(controls.bending) },
        { label: 'MASS FLOW CONTROL', node: _jsx(ControlPill, { state: controls.mfc }), verdict: fromControl(controls.mfc) },
        { label: 'POSITION MODE', node: _jsx(ControlPill, { state: controls.positionMode }), verdict: fromControl(controls.positionMode) },
        { label: 'PLC / DATA', node: _jsx(ControlPill, { state: commState }), verdict: fromControl(commState) },
        { label: 'SAFETY INTERLOCK', node: _jsx(InterlockPill, { value: safety }), verdict: fromInterlock(safety) },
    ];
    const faults = rows.filter((r) => r.verdict === 'BAD');
    // "Everything we can see is fine" is the strongest claim available when most
    // rows are NO TAG — so say that, rather than "SYSTEM HEALTHY".
    const unknown = rows.filter((r) => r.verdict === 'UNKNOWN').length;
    return (_jsxs(Panel, { title: "System status", bodyClassName: "p-0", right: _jsxs("span", { className: cn('text-micro inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold tracking-wider', faults.length > 0
                ? 'border-alarm/50 bg-alarm/10 text-alarm'
                : 'border-healthy/40 bg-healthy/10 text-healthy'), children: [_jsx("span", { "aria-hidden": true, className: cn('h-1.5 w-1.5 rounded-full', faults.length > 0 ? 'bg-alarm alarm-pulse' : 'bg-healthy') }), faults.length > 0 ? `${faults.length} ABNORMAL` : 'MONITORED'] }), children: [_jsx("ul", { className: "divide-line divide-y", children: rows.map((row) => (_jsxs("li", { className: cn('flex items-center justify-between gap-3 px-4 py-[7px]', row.verdict === 'BAD' && 'bg-alarm/8'), children: [_jsx("span", { className: cn('text-meta truncate', row.verdict === 'BAD' ? 'text-alarm font-semibold' : 'text-text-dim'), children: row.label }), row.node] }, row.label))) }), _jsxs("div", { className: cn('border-line flex items-center justify-between gap-3 border-t px-4 py-3', faults.length > 0 ? 'verdict-bad' : 'verdict-good'), children: [_jsx("span", { className: "label font-semibold", children: "OVERALL" }), _jsx("span", { className: cn('text-meta font-semibold tracking-wide', faults.length > 0 ? 'text-alarm' : unknown > 0 ? 'text-text-dim' : 'text-healthy'), children: faults.length > 0
                            ? `${faults.length} SYSTEM${faults.length === 1 ? '' : 'S'} ABNORMAL`
                            : unknown > 0
                                ? `NO FAULTS · ${unknown} NOT INSTRUMENTED`
                                : 'SYSTEM HEALTHY' })] })] }));
}
/** Interlock booleans are three-state: ready, not ready, or no tag at all. */
function InterlockPill({ value }) {
    if (value === null)
        return _jsx(HealthPill, { health: "NO_TAG" });
    return _jsx(HealthPill, { health: value ? 'HEALTHY' : 'FAULT' });
}
