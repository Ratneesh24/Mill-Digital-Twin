import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TAG INVENTORY — the §7.4 live-mode reality gap, on screen.
 *
 * This page exists so the gap between what the twin can show and what the plant
 * actually measures is a visible, countable engineering fact rather than a
 * footnote. It is what an automation engineer takes into the OEM conversation
 * (§22 item 3).
 */
import { useId, useMemo, useState } from 'react';
import { OEM_PRIORITY_TAGS } from '../../communication/opcUaAdapter';
import { tagDefinitions, tagInventory } from '../../data/tagDefinitions';
import { PROVENANCE_BADGE } from '../../data/tagMap';
import { useMachineStore } from '../../store/machineStore';
import { EmptyNote, Panel } from '../common/Panel';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
const AVAILABILITY_STYLE = {
    MEASURED: 'text-prov-measured',
    REFERENCE: 'text-prov-reference',
    CALCULATED: 'text-prov-calculated',
    ESTIMATED: 'text-prov-estimated',
    UNAVAILABLE: 'text-prov-notag',
};
const AVAILABILITY_LABEL = {
    MEASURED: 'MEASURED',
    REFERENCE: 'REFERENCE',
    CALCULATED: 'CALCULATED',
    ESTIMATED: 'ESTIMATED',
    UNAVAILABLE: 'NO TAG',
};
const AVAILABILITY_OPTIONS = [
    'ALL',
    'MEASURED',
    'REFERENCE',
    'CALCULATED',
    'ESTIMATED',
    'UNAVAILABLE',
];
export function TagInventory() {
    const tags = useMachineStore((s) => s.tags);
    const mode = useMachineStore((s) => s.state.operatingMode);
    const searchId = useId();
    const filterId = useId();
    const [query, setQuery] = useState('');
    const [availability, setAvailability] = useState('ALL');
    const [priorityOnly, setPriorityOnly] = useState(false);
    const priority = useMemo(() => new Set(OEM_PRIORITY_TAGS), []);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return tagDefinitions.filter((def) => {
            if (availability !== 'ALL' && def.liveAvailability !== availability)
                return false;
            if (priorityOnly && !priority.has(def.tagName))
                return false;
            if (!needle)
                return true;
            return (def.tagName.toLowerCase().includes(needle) ||
                def.description.toLowerCase().includes(needle) ||
                (def.unit ?? '').toLowerCase().includes(needle));
        });
    }, [availability, priority, priorityOnly, query]);
    const hasFilters = query.trim() !== '' || availability !== 'ALL' || priorityOnly;
    function resetFilters() {
        setQuery('');
        setAvailability('ALL');
        setPriorityOnly(false);
    }
    return (_jsxs("div", { className: "dashboard-page-grid grid min-h-0 gap-3.5 lg:grid-cols-[340px_minmax(0,1fr)]", children: [_jsxs("div", { className: "flex min-h-0 flex-col gap-3.5", children: [_jsxs(Panel, { title: "CRM04 feed reality \u2014 \u00A77.4", children: [_jsx("p", { className: "text-text-dim mb-3 text-meta leading-relaxed", children: "The available 6-month CRM04 extract is 5 s sampled, coil-linked, and carries about 46 of the 74 tags this twin models. Everything below is what that means for the picture on the other screen." }), _jsx(Count, { label: "Tags modelled", value: tagInventory.total, tone: "text-text" }), _jsx(Count, { label: "Measured on the live feed", value: tagInventory.measuredOnLiveFeed, tone: "text-prov-measured" }), _jsx(Count, { label: "Reference (MMS setup)", value: tagInventory.referenceOnLiveFeed, tone: "text-prov-reference" }), _jsx(Count, { label: "Calculated from measured", value: tagInventory.calculatedOnLiveFeed, tone: "text-prov-calculated" }), _jsx(Count, { label: "Estimated by model", value: tagInventory.estimatedOnLiveFeed, tone: "text-prov-estimated" }), _jsx(Count, { label: "No tag \u2014 shown as NO TAG", value: tagInventory.unavailableOnLiveFeed, tone: "text-prov-notag" }), _jsxs("p", { className: "text-text-faint mt-3 text-meta leading-relaxed", children: ["Promotion path: when OEM raises PLC sampling on a tag, change its", ' ', _jsx("span", { className: "num", children: "liveAvailability" }), " to ", _jsx("span", { className: "num", children: "MEASURED" }), " in", ' ', _jsx("span", { className: "num", children: "data/tagDefinitions.ts" }), ". Nothing else changes \u2014 no component reads an availability flag, they all read the resolved provenance off the Tag."] })] }), _jsxs(Panel, { title: "Raise with OEM first \u2014 \u00A722 item 3", children: [_jsx("p", { className: "text-text-dim mb-2 text-meta leading-relaxed", children: "Without these, roll force, capsule position and roll speed are all model output rather than measurement." }), _jsx("ul", { className: "space-y-1.5", children: OEM_PRIORITY_TAGS.map((tagName) => (_jsx("li", { className: "num text-warning bg-warning/10 rounded-md px-2 py-1 text-meta", children: tagName }, tagName))) })] })] }), _jsxs(Panel, { title: `Tag map · ${filtered.length} of ${tagDefinitions.length} tags`, right: _jsxs("span", { className: "text-text-faint text-micro font-medium normal-case", children: ["ACTIVE MODE: ", mode] }), bodyClassName: "p-0 flex flex-col min-h-0", children: [_jsxs("div", { className: "border-line bg-base-850 flex flex-wrap items-end gap-2.5 border-b px-3.5 py-3", children: [_jsxs("div", { className: "min-w-[200px] flex-1", children: [_jsx("label", { htmlFor: searchId, className: "label mb-1 block", children: "Search tags" }), _jsx("input", { id: searchId, type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Tag, description or unit\u2026", className: "border-line bg-base-900 text-text placeholder:text-text-faint focus:border-normal min-h-10 w-full rounded-md border px-3 text-meta" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: filterId, className: "label mb-1 block", children: "Live feed status" }), _jsx("select", { id: filterId, value: availability, onChange: (e) => setAvailability(e.target.value), className: "border-line bg-base-900 text-text focus:border-normal min-h-10 rounded-md border px-2.5 text-meta", children: AVAILABILITY_OPTIONS.map((option) => (_jsx("option", { value: option, children: option === 'ALL' ? 'All statuses' : AVAILABILITY_LABEL[option] }, option))) })] }), _jsxs("label", { className: "border-line bg-base-900 text-text-dim flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-meta font-medium has-checked:text-text", children: [_jsx("input", { type: "checkbox", checked: priorityOnly, onChange: (e) => setPriorityOnly(e.target.checked), className: "accent-[#005a9c]" }), "OEM priority only"] }), hasFilters && (_jsx("button", { type: "button", onClick: resetFilters, className: "border-line text-text-dim hover:text-text hover:bg-base-800 min-h-10 rounded-md border px-3 text-meta font-medium", children: "Reset" }))] }), filtered.length === 0 ? (_jsxs("div", { className: "px-3.5 py-6", children: [_jsxs(EmptyNote, { children: ["No tags match \u201C", query.trim(), "\u201D", availability !== 'ALL' ? ` with status ${AVAILABILITY_LABEL[availability]}` : '', priorityOnly ? ' in the OEM priority list' : '', "."] }), _jsx("div", { className: "mt-2 text-center", children: _jsx("button", { type: "button", onClick: resetFilters, className: "bg-brand min-h-10 rounded-md px-4 text-meta font-semibold text-white", children: "Clear search and filters" }) })] })) : (_jsx("div", { className: "min-h-0 flex-1 overflow-auto", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { className: "bg-base-850 sticky top-0 z-10", children: _jsxs("tr", { className: "text-text-faint border-line border-b text-micro tracking-wider", children: [_jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "TAG" }), _jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "DESCRIPTION" }), _jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "UNIT" }), _jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "IN SIM" }), _jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "ON LIVE FEED" }), _jsx("th", { className: "px-2.5 py-2 text-left font-semibold", children: "NOW" })] }) }), _jsx("tbody", { children: filtered.map((def) => {
                                        const tag = tags[def.tagName];
                                        return (_jsxs("tr", { className: `border-line border-b text-meta ${priority.has(def.tagName) ? 'bg-warning/10' : ''}`, title: def.liveNote, children: [_jsx("td", { className: "num text-text px-2.5 py-1.5 whitespace-nowrap", children: def.tagName }), _jsx("td", { className: "text-text-dim px-2.5 py-1.5", children: def.description }), _jsx("td", { className: "text-text-faint num px-2.5 py-1.5", children: def.unit ?? '—' }), _jsx("td", { className: "text-text-faint px-2.5 py-1.5 whitespace-nowrap", children: PROVENANCE_BADGE[def.simulationProvenance] }), _jsx("td", { className: `px-2.5 py-1.5 font-medium whitespace-nowrap ${AVAILABILITY_STYLE[def.liveAvailability]}`, children: AVAILABILITY_LABEL[def.liveAvailability] }), _jsx("td", { className: "px-2.5 py-1.5", children: tag ? (_jsx(ProvenanceBadge, { provenance: tag.provenance, quality: tag.quality, note: def.liveNote })) : (_jsx("span", { className: "text-text-faint", children: "\u2014" })) })] }, def.tagName));
                                    }) })] }) }))] })] }));
}
function Count({ label, value, tone }) {
    return (_jsxs("div", { className: "border-line flex items-baseline justify-between border-b py-1.5 last:border-b-0", children: [_jsx("span", { className: "label", children: label }), _jsx("span", { className: `num text-value font-semibold ${tone}`, children: value })] }));
}
