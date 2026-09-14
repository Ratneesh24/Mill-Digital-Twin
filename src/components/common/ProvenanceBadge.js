import { jsx as _jsx } from "react/jsx-runtime";
import { PROVENANCE_BADGE, PROVENANCE_MEANING } from '../../data/tagMap';
const STYLES = {
    MEASURED: 'text-prov-measured border-prov-measured/45 bg-prov-measured/10',
    REFERENCE: 'text-prov-reference border-prov-reference/45 bg-prov-reference/10',
    CALCULATED: 'text-prov-calculated border-prov-calculated/45 bg-prov-calculated/10',
    SIMULATED: 'text-prov-simulated border-prov-simulated/45 bg-prov-simulated/10',
    ESTIMATED: 'text-prov-estimated border-prov-estimated/45 bg-prov-estimated/10',
    // NO TAG is dashed on purpose: it must not read as a value with a label.
    UNAVAILABLE: 'text-prov-notag border-prov-notag/60 bg-transparent border-dashed',
};
export function ProvenanceBadge({ provenance, quality, note, className = '' }) {
    const stale = quality === 'STALE';
    const title = [
        PROVENANCE_MEANING[provenance],
        stale ? 'Value is STALE — the feed has stopped updating' : null,
        note,
    ]
        .filter(Boolean)
        .join(' · ');
    return (_jsx("span", { title: title, className: `inline-flex items-center border px-1 text-micro leading-[14px] font-medium tracking-wider whitespace-nowrap ${stale ? 'text-alarm border-alarm/60 bg-alarm/10' : STYLES[provenance]} ${className}`, children: stale ? 'STALE' : PROVENANCE_BADGE[provenance] }));
}
