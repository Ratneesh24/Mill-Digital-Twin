import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * VALUE READOUT — the one component allowed to print a process value.
 *
 * It takes a TAG NAME, not a number. That single design decision is what makes
 * §7.3 and §7.4 enforceable rather than aspirational:
 *
 *   - the value, unit, limits, status and provenance all come from the same Tag
 *   - a tag that does not exist on this feed renders "NO TAG" (§7.4), never 0
 *   - a stale tag stops looking live (§14.5)
 *
 * A component that wants to show a number cannot bypass this without importing
 * the raw store, which the audit in docs/AUDIT.md checks for.
 */
import { useMachineStore } from '../../store/machineStore';
import { getTagDefinition } from '../../data/tagDefinitions';
import { ProvenanceBadge } from './ProvenanceBadge';
const STATUS_TEXT = {
    NORMAL: 'text-text',
    WARNING: 'text-warning',
    ALARM: 'text-alarm',
    TRIP: 'text-trip',
    UNKNOWN: 'text-text-faint',
};
const SIZE_CLASS = {
    sm: 'text-body',
    md: 'text-value',
    lg: 'text-value-lg',
    xl: 'text-hero',
};
export function ValueReadout({ tagName, decimals, size = 'md', hideUnit = false, hideBadge = false, className = '', scale = 1, unitOverride, signed = false, }) {
    const tag = useMachineStore((s) => s.tags[tagName]);
    const def = getTagDefinition(tagName);
    const unit = unitOverride ?? tag?.unit ?? def?.unit;
    const places = decimals ?? def?.decimals ?? 1;
    // No tag on this feed — say so. This is the §7.4 requirement that the UI
    // "degrade honestly: a missing tag shows NO TAG, never a plausible-looking
    // number".
    if (!tag || tag.value === null || tag.provenance === 'UNAVAILABLE') {
        return (_jsxs("span", { className: `inline-flex items-baseline gap-1.5 ${className}`, children: [_jsx("span", { className: `num ${SIZE_CLASS[size]} text-text-faint tracking-tight`, children: "\u2014" }), !hideBadge && (_jsx(ProvenanceBadge, { provenance: "UNAVAILABLE", note: def?.liveNote ?? 'Tag not available on the active feed' }))] }));
    }
    const raw = tag.value;
    let text;
    if (typeof raw === 'number') {
        const scaled = raw * scale;
        text = `${signed && scaled >= 0 ? '+' : ''}${scaled.toFixed(places)}`;
    }
    else if (typeof raw === 'boolean') {
        text = raw ? 'YES' : 'NO';
    }
    else {
        text = String(raw);
    }
    const stale = tag.quality === 'STALE';
    return (_jsxs("span", { className: `inline-flex items-baseline gap-1.5 ${className}`, children: [_jsx("span", { className: `num ${SIZE_CLASS[size]} tracking-tight ${stale ? 'text-text-faint line-through decoration-alarm/70' : STATUS_TEXT[tag.status]}`, children: text }), !hideUnit && unit && (_jsx("span", { className: "text-text-faint text-micro leading-none", children: unit })), !hideBadge && (_jsx(ProvenanceBadge, { provenance: tag.provenance, quality: tag.quality, note: def?.liveNote }))] }));
}
/**
 * Compact label + value row used across the detail panels.
 */
export function ReadoutRow({ label, tagName, decimals, scale, unitOverride, signed, hideBadge, }) {
    return (_jsxs("div", { className: "flex items-baseline justify-between gap-3 py-[3px]", children: [_jsx("span", { className: "label truncate", children: label }), _jsx(ValueReadout, { tagName: tagName, decimals: decimals, size: "sm", scale: scale, unitOverride: unitOverride, signed: signed, hideBadge: hideBadge })] }));
}
/**
 * A value that is NOT a tag — a derived engineering indicator such as
 * utilisation, or a configuration constant. It is rendered in the dimmer
 * "derived" treatment so it can never be confused with a measurement.
 */
export function DerivedRow({ label, value, unit, tone = 'normal', title, }) {
    const toneClass = tone === 'warning'
        ? 'text-warning'
        : tone === 'alarm'
            ? 'text-alarm'
            : tone === 'healthy'
                ? 'text-healthy'
                : tone === 'dim'
                    ? 'text-text-faint'
                    : 'text-text';
    return (_jsxs("div", { className: "flex items-baseline justify-between gap-3 py-[3px]", title: title, children: [_jsx("span", { className: "label truncate", children: label }), _jsxs("span", { className: "inline-flex items-baseline gap-1.5", children: [_jsx("span", { className: `num text-body ${toneClass}`, children: value }), unit && _jsx("span", { className: "text-text-faint text-micro", children: unit })] })] }));
}
