import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CONNECTION / SOURCE STATUS — §14.5.
 *
 *   PLC CONNECTION  ✓ CONNECTED
 *   PLC CONNECTION  ✗ LOST     LAST VALID DATA: 12:14:22
 *
 * Also carries the operating-mode selector. Switching mode disconnects the
 * current source and connects a new one, which is the §17 test 10 path:
 * "Simulation disengages cleanly, live source authoritative, no conflicting
 * values."
 */
import { useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useMachineStore } from '../../store/machineStore';
const MODE_LABEL = {
    SIMULATION: 'SIMULATION',
    SIM_46TAG: 'SIM · 46-TAG',
    LIVE: 'LIVE',
};
const MODE_HELP = {
    SIMULATION: 'Full 74-tag simulated mill. Every value badged SIM — nothing here is plant data.',
    SIM_46TAG: 'Same simulation, presented with the provenance each value will carry on the real CRM04 6-month extract: force ESTIMATED, roll gap CALCULATED, bending and OS/DS NO TAG. Rehearsal for the live feed (§7.4).',
    LIVE: 'WebSocket feed from the industrial edge gateway. Read-only (§14.4).',
};
export function ConnectionStatus() {
    const comm = useMachineStore((s) => s.state.communication);
    const mode = useMachineStore((s) => s.state.operatingMode);
    const liveUrl = useMachineStore((s) => s.liveUrl);
    const setLiveUrl = useMachineStore((s) => s.setLiveUrl);
    const connect = useMachineStore((s) => s.connect);
    const [editingUrl, setEditingUrl] = useState(false);
    const healthy = comm.connected && !comm.stale;
    return (_jsxs("div", { className: "flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2", children: [_jsx("div", { role: "group", "aria-label": "Operating mode", className: "border-line bg-base-950 flex max-w-full flex-wrap rounded-full border p-1", children: ['SIMULATION', 'SIM_46TAG', 'LIVE'].map((m) => (_jsx("button", { type: "button", title: MODE_HELP[m], "aria-pressed": mode === m, onClick: () => void connect(m), className: `min-h-9 rounded-full px-3.5 py-1.5 text-meta font-semibold tracking-[0.06em] transition-colors ${mode === m
                        ? m === 'LIVE'
                            ? 'bg-healthy text-white shadow-sm'
                            : 'bg-brand text-white shadow-sm'
                        : 'text-text-dim hover:text-text hover:bg-base-800'}`, children: MODE_LABEL[m] }, m))) }), mode === 'LIVE' &&
                (editingUrl ? (_jsxs("label", { className: "text-text-dim flex min-w-0 max-w-full flex-wrap items-center gap-2 text-meta font-medium", children: ["Gateway WebSocket URL", _jsx("input", { autoFocus: true, value: liveUrl, onChange: (e) => setLiveUrl(e.target.value), onBlur: () => {
                                setEditingUrl(false);
                                void connect('LIVE', liveUrl);
                            }, onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    e.currentTarget.blur();
                            }, className: "border-line bg-base-900 text-text num focus:border-normal w-[240px] min-w-0 max-w-full rounded-md border px-2.5 py-2 text-meta" })] })) : (_jsx("button", { type: "button", onClick: () => setEditingUrl(true), className: "text-text-faint num hover:text-text hover:bg-base-800 min-w-0 max-w-full rounded-md break-all px-2 py-1.5 text-left text-meta", "aria-label": `Edit gateway WebSocket URL: ${liveUrl}`, title: "Edit the gateway WebSocket URL", children: liveUrl }))), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "label hidden xl:inline", children: mode === 'LIVE' ? 'PLC CONNECTION' : 'SOURCE' }), _jsxs("span", { className: `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-semibold tracking-wide ${healthy
                            ? 'border-healthy/40 text-healthy bg-healthy/10'
                            : 'border-alarm/50 text-alarm bg-alarm/10'}`, children: [healthy ? (_jsx(Wifi, { size: 13, "aria-hidden": true })) : (_jsx(WifiOff, { size: 13, "aria-hidden": true, className: "alarm-pulse" })), comm.connected ? (comm.stale ? 'STALE' : 'CONNECTED') : 'LOST'] })] }), !healthy && (_jsxs("span", { className: "text-text-faint num text-meta", children: ["LAST VALID DATA:", ' ', comm.lastValidTimestamp
                        ? new Date(comm.lastValidTimestamp).toLocaleTimeString()
                        : 'NEVER'] }))] }));
}
