/**
 * TAG RESOLUTION — the single place where §7.3 provenance and §7.4 availability
 * rules are applied.
 *
 * Every Tag that reaches the store passes through `makeTag()`. That is what
 * guarantees a CALCULATED / SIMULATED / ESTIMATED value can never accidentally
 * be rendered with the appearance of a MEASURED one: no component chooses a
 * badge, the badge is a property of the value.
 */
import { getTagDefinition } from './tagDefinitions';
/**
 * Resolve the provenance a tag carries in a given operating mode.
 *
 * SIMULATION   — the simulation engine is the source, so everything it produces
 *                is SIMULATED, except values that are genuinely setpoints
 *                (REFERENCE) or genuinely derived from other displayed values
 *                (CALCULATED). Being honest about this inside the sim is what
 *                makes the sim a useful rehearsal for the live feed.
 *
 * SIM_46TAG    — the simulation still produces the numbers, but they are shown
 *                with the provenance they WILL have on the real CRM04 feed.
 *                This is the §7.4 rehearsal mode: force degrades to ESTIMATED,
 *                roll gap to CALCULATED, bending to NO TAG. A global banner
 *                states that the underlying values are still simulated.
 *
 * LIVE         — the gateway is the source and `liveAvailability` is the truth.
 */
export function resolveProvenance(def, mode) {
    if (mode === 'SIMULATION')
        return def.simulationProvenance;
    // Both SIM_46TAG and LIVE present the live-feed provenance.
    switch (def.liveAvailability) {
        case 'MEASURED':
            return 'MEASURED';
        case 'REFERENCE':
            return 'REFERENCE';
        case 'CALCULATED':
            return 'CALCULATED';
        case 'ESTIMATED':
            return 'ESTIMATED';
        case 'UNAVAILABLE':
            return 'UNAVAILABLE';
    }
}
/** True when the tag has no value at all on this feed and must render "NO TAG". */
export function isUnavailable(tagName, mode) {
    const def = getTagDefinition(tagName);
    if (!def)
        return true;
    if (mode === 'SIMULATION')
        return false;
    return def.liveAvailability === 'UNAVAILABLE';
}
/**
 * Evaluate a numeric value against its configured limits.
 * Trip beats alarm beats warning; a value with no limits is always NORMAL.
 */
export function evaluateStatus(def, value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return 'UNKNOWN';
    const l = def.limits;
    if (!l)
        return 'NORMAL';
    if (l.tripHigh !== undefined && value >= l.tripHigh)
        return 'TRIP';
    if (l.alarmHigh !== undefined && value >= l.alarmHigh)
        return 'ALARM';
    if (l.alarmLow !== undefined && value <= l.alarmLow)
        return 'ALARM';
    if (l.warningHigh !== undefined && value >= l.warningHigh)
        return 'WARNING';
    if (l.warningLow !== undefined && value <= l.warningLow)
        return 'WARNING';
    return 'NORMAL';
}
/**
 * Quality for a tag in a given mode.
 *
 * A simulated value is never GOOD — it is SIMULATION. That distinction is what
 * stops the twin claiming instrument-grade confidence for a model output.
 */
function resolveQuality(provenance, mode, stale) {
    if (provenance === 'UNAVAILABLE')
        return 'NO_TAG';
    if (stale)
        return 'STALE';
    if (mode === 'LIVE')
        return 'GOOD';
    return 'SIMULATION';
}
/**
 * Build a fully-qualified Tag. This is the ONLY constructor for a Tag in the
 * application.
 */
export function makeTag(tagName, value, { timestamp, mode, stale = false }) {
    const def = getTagDefinition(tagName);
    if (!def) {
        // An unknown tag is an integration error, not a value. Surface it as such
        // rather than letting an unnamed number onto a screen (§14.5 "invalid tag").
        return {
            tagName,
            value: null,
            timestamp,
            quality: 'BAD',
            status: 'UNKNOWN',
            provenance: 'UNAVAILABLE',
        };
    }
    const provenance = resolveProvenance(def, mode);
    const unavailable = provenance === 'UNAVAILABLE';
    const resolvedValue = unavailable ? null : value;
    return {
        tagName,
        value: resolvedValue,
        unit: def.unit,
        timestamp,
        quality: resolveQuality(provenance, mode, stale),
        status: unavailable ? 'UNKNOWN' : evaluateStatus(def, resolvedValue),
        provenance,
        limits: def.limits,
    };
}
/** UI badge text for a provenance (§7.3). */
export const PROVENANCE_BADGE = {
    MEASURED: 'LIVE',
    REFERENCE: 'REF',
    CALCULATED: 'CALC',
    SIMULATED: 'SIM',
    ESTIMATED: 'EST',
    UNAVAILABLE: 'NO TAG',
};
/** Long-form description used in tooltips and the tag inventory page. */
export const PROVENANCE_MEANING = {
    MEASURED: 'Real PLC / instrument value, GOOD quality',
    REFERENCE: 'Setpoint from the pass schedule / MMS',
    CALCULATED: 'Derived from measured values',
    SIMULATED: 'Produced by the simulation engine',
    ESTIMATED: 'Model fill-in — no instrument exists for this value',
    UNAVAILABLE: 'No tag on this feed — nothing is being displayed',
};
/** Read a numeric tag value, or null when it is unavailable/non-numeric. */
export function numericValue(tag) {
    if (!tag || tag.value === null)
        return null;
    return typeof tag.value === 'number' && Number.isFinite(tag.value) ? tag.value : null;
}
