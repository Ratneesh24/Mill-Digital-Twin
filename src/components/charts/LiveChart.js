import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * LIVE TREND CHART — §12.
 *
 * Reads the ring buffers on its own throttle (2 Hz repaint), completely
 * decoupled from both the 20 Hz-capable data feed and the 3D render loop (§15).
 * Buffers are already downsampled on write, so this never decimates on render.
 *
 * The provenance badge on each series comes from the same tag the series is
 * recorded from — a trend of an ESTIMATED value is labelled EST here too, so a
 * chart cannot quietly launder a model output into something that looks measured.
 */
import { useMemo } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Activity, ChartLine, MousePointerClick } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { SIGNAL_BY_KEY, SIGNALS } from '../../store/telemetryStore';
import { useMachineStore } from '../../store/machineStore';
import { useUiStore } from '../../store/uiStore';
import { useMergedTrend } from '../../utils/useTelemetry';
import { TREND_WINDOWS } from '../../types/telemetry';
import { cn } from '../ui/cn';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { Panel } from '../common/Panel';
const WINDOW_KEYS = Object.keys(TREND_WINDOWS);
export function LiveChart() {
    const signals = useUiStore((s) => s.trendSignals);
    const window = useUiStore((s) => s.trendWindow);
    const setWindow = useUiStore((s) => s.setTrendWindow);
    const toggleSignal = useUiStore((s) => s.toggleTrendSignal);
    return (_jsxs(Panel, { title: "Live trends", right: _jsx("div", { role: "group", "aria-label": "Trend time window", className: "segmented", children: WINDOW_KEYS.map((key) => (_jsx("button", { type: "button", "aria-pressed": window === key, onClick: () => setWindow(key), className: "num", children: key }, key))) }), bodyClassName: "p-0 flex flex-col", className: "h-full", children: [_jsx(SignalLegend, { selected: signals, onToggle: toggleSignal }), _jsx("div", { className: "live-trend-plot", children: _jsx(TrendPlot, { signals: signals, window: window }) })] }));
}
/**
 * Radix ToggleGroup in `multiple` mode, which renders the Root as
 * `role="group"` and each Item as a `<button aria-pressed>` — exactly the ARIA
 * this was hand-rolling, so the styling and the smoke assertions are unchanged.
 *
 * The trend-*window* switcher above deliberately stays hand-rolled: single mode
 * emits `aria-checked` instead, and `.segmented > button[aria-pressed='true']`
 * is what paints the active pill blue.
 */
function SignalLegend({ selected, onToggle, }) {
    const tags = useMachineStore((s) => s.tags);
    return (_jsx(ToggleGroup.Root, { type: "multiple", value: selected, 
        // Radix hands back the whole next array; diff it against the current
        // selection so the store keeps its single-signal toggle action.
        onValueChange: (next) => {
            const added = next.find((k) => !selected.includes(k));
            const removed = selected.find((k) => !next.includes(k));
            const changed = (added ?? removed);
            if (changed)
                onToggle(changed);
        }, "aria-label": "Trend signals", className: "live-trend-legend border-line bg-base-850 flex flex-wrap content-start gap-1.5 border-b px-3 py-3", children: SIGNALS.map((signal) => {
            const active = selected.includes(signal.key);
            const tag = tags[signal.tagName];
            return (_jsxs(ToggleGroup.Item, { value: signal.key, title: `${signal.label} (${signal.unit}) — ${active ? 'hide' : 'show'} on trend`, className: cn('flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-medium tracking-wide transition-colors', active
                    ? 'border-normal/50 text-text bg-base-900 shadow-sm'
                    : 'border-line text-text-faint hover:text-text-dim bg-base-900'), children: [_jsx("span", { "aria-hidden": "true", className: "h-[3px] w-3.5 shrink-0 rounded-full", style: { background: active ? signal.color : 'var(--color-inactive)' } }), signal.label, active && tag && (_jsx(ProvenanceBadge, { provenance: tag.provenance, quality: tag.quality }))] }, signal.key));
        }) }));
}
function TrendPlot({ signals, window, }) {
    const rows = useMergedTrend(signals, window);
    const formatTime = useMemo(() => (value) => new Date(value).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), []);
    if (signals.length === 0) {
        return (_jsxs("div", { className: "text-text-faint flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-meta", children: [_jsx(MousePointerClick, { size: 22, "aria-hidden": true, className: "opacity-60" }), _jsx("span", { className: "font-medium", children: "Select a signal to trend" }), _jsx("span", { className: "text-meta", children: "Use the pills above to add mill speed, force, gap and more." })] }));
    }
    if (rows.length < 2) {
        return (_jsxs("div", { className: "text-text-faint flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-meta", children: [_jsx(Activity, { size: 22, "aria-hidden": true, className: "opacity-60" }), _jsx("span", { className: "font-medium", children: "Collecting data\u2026" }), _jsxs("span", { className: "flex items-center gap-1 text-meta", children: [_jsx(ChartLine, { size: 13, "aria-hidden": true }), " The trend draws as soon as the feed delivers samples."] })] }));
    }
    return (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: rows, margin: { top: 10, right: 10, bottom: 2, left: -4 }, children: [_jsx(CartesianGrid, { stroke: "var(--color-line)", strokeDasharray: "3 4", vertical: false }), _jsx(XAxis, { dataKey: "timestamp", tickFormatter: formatTime, stroke: "var(--color-line-bright)", tick: { fontSize: 11, fill: 'var(--color-text-faint)' }, minTickGap: 40 }), signals.map((key, index) => (_jsx(YAxis, { yAxisId: key, hide: index > 0, stroke: "var(--color-line-bright)", tick: { fontSize: 11, fill: 'var(--color-text-faint)' }, width: 46, domain: ['auto', 'auto'] }, key))), _jsx(Tooltip, { contentStyle: {
                        background: 'var(--color-base-900)',
                        border: '1px solid var(--color-line-bright)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: 'var(--color-text)',
                        boxShadow: 'var(--shadow-pop)',
                    }, labelStyle: { color: 'var(--color-text-dim)', fontWeight: 600 }, labelFormatter: (value) => new Date(Number(value)).toLocaleTimeString(), formatter: (value, name) => {
                        const descriptor = SIGNAL_BY_KEY[name];
                        const v = typeof value === 'number' ? value : Number(value);
                        return [
                            `${Number.isFinite(v) ? v.toFixed(descriptor?.decimals ?? 1) : '—'} ${descriptor?.unit ?? ''}`,
                            descriptor?.label ?? String(name),
                        ];
                    } }), signals.includes('thicknessDeviation') && (_jsx(ReferenceLine, { yAxisId: "thicknessDeviation", y: 0, stroke: "var(--color-line-bright)" })), signals.map((key) => (_jsx(Line, { yAxisId: key, type: "monotone", dataKey: key, stroke: SIGNAL_BY_KEY[key].color, strokeWidth: 2, dot: false, isAnimationActive: false }, key)))] }) }));
}
