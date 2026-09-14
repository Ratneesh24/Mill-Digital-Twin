import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Panel({ title, right, children, className = '', bodyClassName = '', }) {
    return (_jsxs("section", { className: `panel ${className}`, children: [_jsxs("header", { className: "panel-title", children: [_jsx("h2", { className: "min-w-0", children: title }), right] }), _jsx("div", { className: `panel-body ${bodyClassName}`, children: children })] }));
}
const HEALTH_STYLE = {
    HEALTHY: 'text-healthy border-healthy/40 bg-healthy/10',
    WARNING: 'text-warning border-warning/40 bg-warning/10',
    FAULT: 'text-alarm border-alarm/50 bg-alarm/10',
    OFF: 'text-text-faint border-line bg-transparent',
    UNKNOWN: 'text-text-faint border-line bg-transparent',
    NO_TAG: 'text-prov-notag border-prov-notag/60 border-dashed bg-transparent',
};
const HEALTH_TEXT = {
    HEALTHY: 'HEALTHY',
    WARNING: 'WARNING',
    FAULT: 'FAULT',
    OFF: 'OFF',
    UNKNOWN: 'UNKNOWN',
    NO_TAG: 'NO TAG',
};
export function HealthPill({ health }) {
    return (_jsx("span", { className: `inline-block border px-1.5 text-micro leading-[15px] tracking-wider ${HEALTH_STYLE[health]}`, children: HEALTH_TEXT[health] }));
}
const CTRL_STYLE = {
    ON: 'text-healthy border-healthy/40 bg-healthy/10',
    OFF: 'text-text-faint border-line bg-transparent',
    FAULT: 'text-alarm border-alarm/50 bg-alarm/10',
    UNKNOWN: 'text-text-faint border-line bg-transparent',
    NO_TAG: 'text-prov-notag border-prov-notag/60 border-dashed bg-transparent',
};
const CTRL_TEXT = {
    ON: 'ON',
    OFF: 'OFF',
    FAULT: 'FAULT',
    UNKNOWN: '—',
    NO_TAG: 'NO TAG',
};
export function ControlPill({ state }) {
    return (_jsx("span", { className: `inline-block border px-1.5 text-micro leading-[15px] tracking-wider ${CTRL_STYLE[state]}`, children: CTRL_TEXT[state] }));
}
/**
 * Horizontal utilisation bar. `value` is a percentage; the warning and alarm
 * marks are drawn at their configured thresholds so the bar shows headroom, not
 * just a number.
 */
export function UtilisationBar({ value, warningAt, alarmAt, label, }) {
    const pct = Math.max(0, Math.min(value, 100));
    const tone = alarmAt !== undefined && value >= alarmAt
        ? 'bg-alarm'
        : warningAt !== undefined && value >= warningAt
            ? 'bg-warning'
            : 'bg-normal';
    return (_jsxs("div", { className: "w-full", children: [label && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "label", children: label }), _jsxs("span", { className: "num text-text-dim text-micro", children: [pct.toFixed(0), "%"] })] })), _jsxs("div", { className: "bg-base-800 border-line relative mt-1 h-[6px] w-full border", children: [_jsx("div", { className: `h-full ${tone}`, style: { width: `${pct}%` } }), warningAt !== undefined && (_jsx("span", { className: "bg-warning/70 absolute top-0 h-full w-px", style: { left: `${warningAt}%` } })), alarmAt !== undefined && (_jsx("span", { className: "bg-alarm/80 absolute top-0 h-full w-px", style: { left: `${alarmAt}%` } }))] })] }));
}
export function EmptyNote({ children }) {
    return _jsx("p", { className: "text-text-faint py-3 text-center text-meta", children: children });
}
