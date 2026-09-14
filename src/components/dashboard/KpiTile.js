import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMachineStore } from '../../store/machineStore';
import { ValueReadout } from '../common/ValueReadout';
import { Sparkline } from '../common/Sparkline';
import { cn } from '../ui/cn';
const STATUS_VIEW = {
    TRIP: { text: 'TRIP', tone: 'text-trip', dot: 'bg-trip' },
    ALARM: { text: 'ALARM', tone: 'text-alarm', dot: 'bg-alarm' },
    WARNING: { text: 'WARNING', tone: 'text-warning', dot: 'bg-warning' },
    NORMAL: { text: 'NORMAL', tone: 'text-healthy', dot: 'bg-healthy' },
    UNKNOWN: { text: 'NO DATA', tone: 'text-text-faint', dot: 'bg-inactive' },
    MISSING: { text: 'NO DATA', tone: 'text-text-faint', dot: 'bg-inactive' },
};
export function KpiTile({ label, tagName, decimals, scale, unitOverride, signed, accent, setpointTag, deviationTag, deviationDecimals, deviationUnit, icon, spark, }) {
    const status = useMachineStore((s) => s.tags[tagName]?.status);
    const view = STATUS_VIEW[status ?? 'MISSING'];
    return (_jsxs("div", { className: "kpi-tile border-line bg-base-900 border", style: accent ? { '--kpi-accent': accent } : undefined, children: [_jsxs("div", { className: "kpi-tile-head", children: [icon && (_jsx("span", { "aria-hidden": true, className: "kpi-icon", children: icon })), _jsx("div", { className: "label min-w-0 flex-1 truncate", children: label })] }), _jsx("div", { className: "mt-1 min-w-0", children: _jsx(ValueReadout, { tagName: tagName, size: "lg", decimals: decimals, scale: scale, unitOverride: unitOverride, signed: signed }) }), (setpointTag || deviationTag) && (_jsxs("div", { className: "mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5", children: [setpointTag && (_jsxs("span", { className: "text-text-faint text-micro inline-flex items-baseline gap-1", children: ["SP", _jsx(ValueReadout, { tagName: setpointTag, size: "sm", decimals: decimals, scale: scale, unitOverride: unitOverride, hideBadge: true, className: "text-text-dim" })] })), deviationTag && (_jsxs("span", { className: "text-text-faint text-micro inline-flex items-baseline gap-1", children: ["\u0394", _jsx(ValueReadout, { tagName: deviationTag, size: "sm", decimals: deviationDecimals, unitOverride: deviationUnit, signed: true, hideBadge: true })] }))] })), _jsxs("div", { className: "mt-2 inline-flex items-center gap-1.5", children: [_jsx("span", { "aria-hidden": true, className: cn('h-2 w-2 shrink-0 rounded-full', view.dot) }), _jsx("span", { className: cn('text-micro font-semibold tracking-wide', view.tone), children: view.text })] }), spark && (_jsx("div", { className: "kpi-spark kpi-sparkline", "aria-hidden": true, children: _jsx(Sparkline, { signal: spark, color: accent ?? 'var(--color-brand)', fluid: true, height: 26 }) }))] }));
}
/**
 * A KPI that is NOT a tag — pass counters, mill state, derived indicators.
 * Rendered in the same tile shape so the ribbon stays even, but the caller
 * supplies the content because there is no tag to read.
 */
export function KpiSlot({ label, accent, children, }) {
    return (_jsxs("div", { className: "kpi-tile border-line bg-base-900 border", style: accent ? { '--kpi-accent': accent } : undefined, children: [_jsx("div", { className: "label truncate", children: label }), children] }));
}
