import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from './cn';
/* ── Card ─────────────────────────────────────────────────────────────── */
export function Card({ children, className = '', }) {
    return (_jsx("div", { className: cn('border-line bg-base-900 rounded-card border shadow-card min-w-0', className), children: children }));
}
/* ── Icon chip — the visual anchor for every metric / group ───────────── */
const CHIP_TONE = {
    brand: 'bg-brand/10 text-brand',
    green: 'bg-healthy/10 text-healthy',
    amber: 'bg-warning/10 text-warning',
    red: 'bg-alarm/10 text-alarm',
    violet: 'bg-prov-simulated/10 text-prov-simulated',
    slate: 'bg-base-800 text-text-dim',
};
export function IconChip({ tone = 'brand', children, size = 34, }) {
    return (_jsx("span", { "aria-hidden": true, className: cn('grid shrink-0 place-items-center rounded-xl', CHIP_TONE[tone] ?? CHIP_TONE.slate), style: { width: size, height: size }, children: children }));
}
/* ── Progress — pass progress, load bars, tank levels ─────────────────── */
export function Progress({ value, tone = 'bg-normal', className = '', ariaLabel, }) {
    const pct = Math.max(0, Math.min(100, value));
    return (_jsx("div", { role: "progressbar", "aria-label": ariaLabel, "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100, className: cn('bg-base-800 border-line h-2 w-full overflow-hidden rounded-full border', className), children: _jsx("div", { className: cn('h-full rounded-full transition-[width] duration-500', tone), style: { width: `${pct}%` } }) }));
}
/* ── Donut gauge — motor load, utilisation at a glance ────────────────── */
export function DonutGauge({ value, size = 92, stroke = 10, tone = 'var(--color-normal)', track = 'var(--color-base-800)', children, ariaLabel, }) {
    const pct = Math.max(0, Math.min(100, value));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (_jsxs("div", { role: "img", "aria-label": ariaLabel ?? `${Math.round(pct)} percent`, className: "relative grid shrink-0 place-items-center", style: { width: size, height: size }, children: [_jsxs("svg", { width: size, height: size, className: "-rotate-90", children: [_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: track, strokeWidth: stroke }), _jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: tone, strokeWidth: stroke, strokeLinecap: "round", strokeDasharray: c, strokeDashoffset: c - (pct / 100) * c, style: { transition: 'stroke-dashoffset 500ms ease' } })] }), _jsx("div", { className: "absolute inset-0 grid place-items-center", children: children })] }));
}
/* ── Section heading — consistent eyebrow + action row ────────────────── */
export function SectionHeading({ icon, title, hint, right, }) {
    return (_jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2.5", children: [icon, _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "text-text text-body truncate font-bold tracking-tight", children: title }), hint && _jsx("p", { className: "text-text-faint text-micro mt-0.5 truncate", children: hint })] }), right] }));
}
