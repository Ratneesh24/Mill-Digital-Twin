import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HEADER — machine identity, mode banner, connection state, navigation.
 *
 * Sticky command bar for the modern workspace. The mode banner remains the most
 * important element: simulated values are never presented as plant data.
 */
import { Activity, Box, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { millConfig } from '../../config/millConfig';
import { ROUTES } from '../../app/routes';
import { STATUS_LABEL } from '../../machine/machineStateMachine';
import { useMachineStore } from '../../store/machineStore';
import { useAlarmStore, selectWorstSeverity } from '../../store/alarmStore';
import { useUiStore } from '../../store/uiStore';
import { cn } from '../ui/cn';
import { Hint } from '../ui/Hint';
import { ConnectionStatus } from './ConnectionStatus';
/** Exactly three pages. Everything else lives behind MODEL / DATA STATUS. */
const NAV = [
    { to: ROUTES.dashboard, label: 'DASHBOARD', icon: LayoutDashboard },
    { to: ROUTES.trends, label: 'REAL-TIME TRENDS', icon: Activity },
    { to: ROUTES.twin, label: '3D DIGITAL TWIN', icon: Box },
];
export function Header() {
    const mode = useMachineStore((s) => s.state.operatingMode);
    const coilId = useMachineStore((s) => s.state.coil.id);
    const status = useMachineStore((s) => s.state.machineStatus);
    const pass = useMachineStore((s) => s.state.pass);
    const direction = useMachineStore((s) => s.state.rollingDirection);
    const speed = useMachineStore((s) => s.state.speed.actual);
    const theme = useUiStore((s) => s.theme);
    const toggleTheme = useUiStore((s) => s.toggleTheme);
    const worst = useAlarmStore(selectWorstSeverity);
    const alarmCount = useAlarmStore((s) => s.active.length);
    const simulated = mode !== 'LIVE';
    return (_jsxs("header", { className: "brand-header border-line bg-base-900/95 shrink-0 border-b backdrop-blur", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 lg:px-6", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsxs("div", { className: "flex flex-col leading-none", children: [_jsx("span", { className: "brand-wordmark", "aria-label": "Tata Steel", children: "TATA STEEL" }), _jsx("span", { className: "text-text-faint mt-1 text-micro font-semibold tracking-[0.22em]", children: "CRM SAHIBABAD \u00B7 NARROW COMPLEX" })] }), _jsx("span", { "aria-hidden": "true", className: "bg-line hidden h-10 w-px sm:block" }), _jsxs("div", { className: "hidden min-w-0 max-w-[380px] min-[1700px]:block", children: [_jsxs("div", { className: "text-text truncate text-body font-semibold tracking-wide", children: [millConfig.identity.mill, " \u00B7 4HI REVERSING COLD ROLLING MILL"] }), _jsxs("div", { className: "text-text-faint mt-0.5 truncate text-meta tracking-wide", children: [millConfig.identity.plant, " \u00B7 DIGITAL TWIN \u00B7 COIL ", coilId] })] })] }), _jsx("div", { className: "flex-1" }), alarmCount > 0 && (_jsxs("div", { role: "status", className: cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-meta font-semibold tracking-wide', worst === 'TRIP'
                            ? 'border-trip/60 text-trip bg-trip/10 alarm-pulse'
                            : worst === 'ALARM'
                                ? 'border-alarm/60 text-alarm bg-alarm/10'
                                : 'border-warning/50 text-warning bg-warning/10'), children: [_jsx("span", { "aria-hidden": "true", className: cn('h-2 w-2 rounded-full', worst === 'TRIP' || worst === 'ALARM' ? 'bg-alarm' : 'bg-warning') }), alarmCount, " ACTIVE ", alarmCount === 1 ? 'ALARM' : 'ALARMS'] })), _jsx(ConnectionStatus, {}), _jsx(Hint, { label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', children: _jsxs("button", { type: "button", onClick: toggleTheme, "aria-label": theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', "aria-pressed": theme === 'dark', className: "border-line text-text-dim hover:text-text hover:bg-base-800 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta font-semibold", children: [theme === 'dark' ? _jsx(Sun, { size: 15, "aria-hidden": true }) : _jsx(Moon, { size: 15, "aria-hidden": true }), _jsx("span", { className: "hidden sm:inline", children: theme === 'dark' ? 'LIGHT' : 'DARK' })] }) }), _jsx(Clock, {})] }), _jsxs("div", { className: "border-line bg-base-850 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 lg:px-6", children: [_jsx("nav", { "aria-label": "Workspace pages", className: "workspace-nav flex max-w-full flex-wrap items-center gap-1", children: NAV.map((item) => {
                            const Icon = item.icon;
                            return (_jsxs(NavLink, { to: item.to, className: ({ isActive }) => cn('text-meta inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-semibold tracking-[0.08em] transition-colors', isActive
                                    ? 'text-brand bg-brand/10'
                                    : 'text-text-dim hover:text-text hover:bg-base-800'), children: [_jsx(Icon, { size: 14, "aria-hidden": true }), item.label] }, item.to));
                        }) }), _jsxs("div", { className: "text-meta ml-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", children: [_jsx(HeaderStat, { label: "STATE", value: STATUS_LABEL[status], tone: statusTone(status) }), _jsx(HeaderStat, { label: "PASS", value: `${pass.current} / ${pass.total}` }), _jsx(HeaderStat, { label: "DIR", value: direction }), _jsx(HeaderStat, { label: "SPEED", value: `${speed.toFixed(0)} m/min` })] }), _jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [simulated ? (_jsx("div", { className: "border-prov-simulated/50 bg-prov-simulated/10 text-prov-simulated text-micro max-w-full rounded-full border px-3 py-1.5 font-semibold tracking-[0.08em]", children: mode === 'SIM_46TAG'
                                    ? 'SIMULATED DATA · CRM04 46-TAG PROVENANCE PREVIEW'
                                    : 'SIMULATED DATA · NOT PLANT DATA' })) : (_jsx("div", { className: "border-healthy/50 bg-healthy/10 text-healthy text-micro rounded-full border px-3 py-1.5 font-semibold tracking-[0.08em]", children: "LIVE PLANT DATA \u00B7 READ ONLY" })), _jsxs("span", { className: "text-text-faint num text-meta hidden xl:inline", children: ["COIL ", coilId] })] })] })] }));
}
function statusTone(status) {
    if (status === 'ROLLING')
        return 'text-healthy';
    if (status === 'FAST_STOP' || status === 'FAULT')
        return 'text-trip alarm-pulse';
    if (status === 'REVERSING' || status === 'DECELERATING')
        return 'text-warning';
    return 'text-text';
}
/** One compact label/value pair in the header context strip. */
function HeaderStat({ label, value, tone = 'text-text', }) {
    return (_jsxs("span", { className: "inline-flex items-baseline gap-1.5 whitespace-nowrap", children: [_jsx("span", { className: "text-text-faint text-micro tracking-[0.08em]", children: label }), _jsx("span", { className: cn('num text-meta font-semibold', tone), children: value })] }));
}
function Clock() {
    const timestamp = useMachineStore((s) => s.state.communication.lastFrameTimestamp);
    return (_jsx("div", { className: "num text-text-dim bg-base-950 border-line shrink-0 rounded-md border px-2.5 py-1.5 text-meta", "aria-label": "Last update time", children: timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--:--' }));
}
