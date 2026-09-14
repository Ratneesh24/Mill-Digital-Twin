/**
 * ALARM STORE — §13.1.
 *
 * Reconciles the pure alarm-engine output into a LATCHED alarm list:
 *   - a condition that becomes true raises an alarm with a timestamp
 *   - a condition that stays true does NOT re-raise (no alarm storm)
 *   - a condition that clears marks the alarm inactive but keeps it in history
 *     until acknowledged, because an alarm that flashed and vanished is exactly
 *     the one an operator needs to see afterwards
 */
import { create } from 'zustand';
import { evaluateAlarms } from '../machine/alarmEngine';
import { BoundedLog } from '../utils/ringBuffer';
const HISTORY_CAPACITY = 300;
const history = new BoundedLog(HISTORY_CAPACITY);
let alarmSeq = 0;
const SEVERITY_ORDER = {
    TRIP: 0,
    ALARM: 1,
    WARNING: 2,
    INFO: 3,
};
export const useAlarmStore = create((set, get) => ({
    active: [],
    history: [],
    highlightedSections: [],
    evaluate(state) {
        const stale = state.communication.stale || !state.communication.connected;
        const conditions = evaluateAlarms(state).filter((condition) => !stale || condition.id === 'COMMUNICATION_LOST');
        const conditionById = new Map(conditions.map((c) => [c.id, c]));
        const now = Date.now();
        const previous = get().active;
        const next = [];
        let changed = false;
        // Carry forward alarms that are still true; update their live value.
        for (const alarm of previous) {
            // A dead feed cannot confirm that a process fault has cleared.
            if (stale && alarm.id !== 'COMMUNICATION_LOST') {
                next.push(alarm);
                continue;
            }
            const condition = conditionById.get(alarm.id);
            if (condition) {
                // Severity escalation (WARNING -> ALARM -> TRIP) is a new event, so the
                // timestamp is refreshed and the acknowledgement is dropped.
                if (condition.severity !== alarm.severity) {
                    next.push({
                        ...alarm,
                        severity: condition.severity,
                        message: condition.message,
                        actualValue: condition.actualValue,
                        limit: condition.limit,
                        timestamp: now,
                        acknowledged: false,
                    });
                    changed = true;
                }
                else if (Math.abs(condition.actualValue - alarm.actualValue) > 1e-6 || condition.message !== alarm.message) {
                    next.push({ ...alarm, actualValue: condition.actualValue, message: condition.message });
                    changed = true;
                }
                else {
                    next.push(alarm);
                }
                conditionById.delete(alarm.id);
            }
            else {
                // Cleared. Keep it in history with a cleared timestamp.
                history.push({ ...alarm, active: false, clearedAt: now });
                changed = true;
            }
        }
        // Newly true conditions.
        for (const condition of conditionById.values()) {
            const alarm = {
                id: condition.id,
                timestamp: now,
                severity: condition.severity,
                parameter: condition.parameter,
                tagName: condition.tagName,
                actualValue: condition.actualValue,
                limit: condition.limit,
                unit: condition.unit,
                message: condition.message,
                acknowledged: false,
                active: true,
                section: condition.section,
            };
            next.push(alarm);
            history.push(alarm);
            changed = true;
        }
        if (!changed && next.length === previous.length)
            return;
        next.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.timestamp - a.timestamp);
        const highlighted = Array.from(new Set(next
            .filter((a) => a.severity === 'ALARM' || a.severity === 'TRIP')
            .map((a) => a.section)
            .filter((s) => Boolean(s))));
        set({
            active: next,
            history: history.toArray(),
            highlightedSections: highlighted,
        });
    },
    acknowledge(id) {
        set((s) => ({
            active: s.active.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
        }));
    },
    acknowledgeAll() {
        set((s) => ({ active: s.active.map((a) => ({ ...a, acknowledged: true })) }));
    },
    clearHistory() {
        history.clear();
        set({ history: [] });
    },
    reset() {
        history.clear();
        set({ active: [], history: [], highlightedSections: [] });
    },
}));
/** Unique id generator kept for future per-occurrence alarm records. */
export function nextAlarmId() {
    return `alm-${++alarmSeq}`;
}
export const selectActiveAlarms = (s) => s.active;
export const selectHighlightedSections = (s) => s.highlightedSections;
/** Highest severity currently active — drives the header alarm strip. */
export function selectWorstSeverity(s) {
    if (s.active.length === 0)
        return null;
    return s.active.reduce((worst, a) => (SEVERITY_ORDER[a.severity] < SEVERITY_ORDER[worst] ? a.severity : worst), 'INFO');
}
