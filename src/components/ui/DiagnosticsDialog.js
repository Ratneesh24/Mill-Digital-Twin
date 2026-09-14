import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MODEL / DATA STATUS — the engineering drawer.
 *
 * The spec collapses the workspace to three pages but explicitly keeps every
 * diagnostic. So the Tag Inventory, Plant Config and Validation pages did not
 * disappear — they moved in here, behind a chip that shows feed health at a
 * glance and opens the full detail on demand.
 *
 * The chip itself is the summary: HEALTHY / STALE / LOST plus the operating
 * mode. That is the only diagnostic the spec allows on the main screen; frame
 * counts, solver iterations and physics residuals all live inside.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, X } from 'lucide-react';
import { useMachineStore } from '../../store/machineStore';
import { useUiStore } from '../../store/uiStore';
import { PlantConfig } from '../panels/PlantConfig';
import { TagInventory } from '../panels/TagInventory';
import { ValidationPanel } from '../panels/ValidationPanel';
import { FeedDiagnostics } from '../panels/FeedDiagnostics';
import { cn } from './cn';
const SECTIONS = [
    { id: 'FEED', label: 'FEED & MODEL' },
    { id: 'TAGS', label: 'TAG INVENTORY' },
    { id: 'CONFIG', label: 'PLANT CONFIG' },
    { id: 'VALIDATION', label: 'VALIDATION' },
];
export function DiagnosticsDialog() {
    const open = useUiStore((s) => s.diagnosticsOpen);
    const setOpen = useUiStore((s) => s.setDiagnosticsOpen);
    const [section, setSection] = useState('FEED');
    const comm = useMachineStore((s) => s.state.communication);
    const mode = useMachineStore((s) => s.state.operatingMode);
    const health = !comm.connected ? 'LOST' : comm.stale ? 'STALE' : 'HEALTHY';
    return (_jsxs(Dialog.Root, { open: open, onOpenChange: setOpen, children: [_jsx(Dialog.Trigger, { asChild: true, children: _jsxs("button", { type: "button", title: "Model and data diagnostics \u2014 feed health, physics consistency, tags, configuration and validation", className: cn('text-meta inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 font-semibold shadow-sm transition-colors', health === 'HEALTHY'
                        ? 'border-healthy/45 text-healthy bg-healthy/10'
                        : health === 'STALE'
                            ? 'border-warning/50 text-warning bg-warning/10'
                            : 'border-alarm/55 text-alarm bg-alarm/10'), children: [_jsx(Activity, { size: 15, "aria-hidden": true }), _jsx("span", { className: "hidden sm:inline", children: "MODEL / DATA" }), _jsx("span", { "aria-hidden": true, className: "opacity-45", children: "\u00B7" }), health] }) }), _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "diagnostics-overlay" }), _jsxs(Dialog.Content, { className: "diagnostics-panel", "aria-describedby": undefined, children: [_jsxs("header", { className: "border-line bg-base-850 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx(Dialog.Title, { className: "text-text text-value font-semibold tracking-tight", children: "Model & data status" }), _jsxs("p", { className: "text-text-dim text-meta mt-0.5", children: [mode, " \u00B7 feed ", health, " \u00B7 ", comm.sourceName] })] }), _jsx("nav", { "aria-label": "Diagnostics sections", className: "ml-auto flex flex-wrap gap-1", children: SECTIONS.map((s) => (_jsx("button", { type: "button", "aria-pressed": section === s.id, onClick: () => setSection(s.id), className: cn('text-meta rounded-md px-3 py-2 font-semibold tracking-[0.06em] transition-colors', section === s.id
                                                ? 'text-brand bg-brand/10'
                                                : 'text-text-dim hover:text-text hover:bg-base-800'), children: s.label }, s.id))) }), _jsx(Dialog.Close, { asChild: true, children: _jsx("button", { type: "button", "aria-label": "Close diagnostics", className: "border-line text-text-dim hover:text-text hover:bg-base-800 inline-flex h-10 w-10 items-center justify-center rounded-full border", children: _jsx(X, { size: 16, "aria-hidden": true }) }) })] }), _jsxs("div", { className: "diagnostics-body", children: [section === 'FEED' && _jsx(FeedDiagnostics, {}), section === 'TAGS' && _jsx(TagInventory, {}), section === 'CONFIG' && _jsx(PlantConfig, {}), section === 'VALIDATION' && _jsx(ValidationPanel, {})] })] })] })] }));
}
