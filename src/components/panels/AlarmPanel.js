import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ALARM PANEL — §13.1.
 *
 * Active alarms, most severe first, each naming the parameter, the actual value
 * and the limit it crossed. Acknowledging silences the visual attention but does
 * not clear the alarm — only the condition going away does that.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAlarmStore } from '../../store/alarmStore';
import { EmptyNote, Panel } from '../common/Panel';
import { cn } from '../ui/cn';
const SEVERITY_STYLE = {
    TRIP: 'border-l-trip text-trip',
    ALARM: 'border-l-alarm text-alarm',
    WARNING: 'border-l-warning text-warning',
    INFO: 'border-l-normal text-normal',
};
export function AlarmPanel() {
    const active = useAlarmStore((s) => s.active);
    const acknowledge = useAlarmStore((s) => s.acknowledge);
    const acknowledgeAll = useAlarmStore((s) => s.acknowledgeAll);
    return (_jsx(Panel, { title: `Alarms${active.length ? ` · ${active.length}` : ''}`, right: active.length > 0 ? (_jsx("button", { type: "button", onClick: acknowledgeAll, className: "text-text-faint hover:text-text-dim text-micro tracking-wider", children: "ACK ALL" })) : undefined, bodyClassName: "p-0", children: active.length === 0 ? (_jsx(EmptyNote, { children: "No active alarms" })) : (_jsx("ul", { children: _jsx(AnimatePresence, { initial: false, children: active.map((alarm) => (_jsx(AlarmRow, { alarm: alarm, onAck: () => acknowledge(alarm.id) }, alarm.id))) }) })) }));
}
function AlarmRow({ alarm, onAck }) {
    const unacked = !alarm.acknowledged;
    const attention = unacked && (alarm.severity === 'ALARM' || alarm.severity === 'TRIP');
    const still = useReducedMotion();
    return (_jsx(motion.li, { layout: !still, initial: still ? false : { opacity: 0, height: 0, x: -8 }, animate: { opacity: alarm.acknowledged ? 0.55 : 1, height: 'auto', x: 0 }, exit: still ? undefined : { opacity: 0, height: 0, x: 8 }, transition: { duration: still ? 0 : 0.22, ease: 'easeOut' }, className: cn('border-line overflow-hidden border-b border-l-2 px-2.5 py-2', SEVERITY_STYLE[alarm.severity]), children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: `text-meta leading-snug ${attention ? 'alarm-pulse' : ''}`, children: alarm.message }), _jsxs("div", { className: "text-text-faint num mt-0.5 text-micro", children: [new Date(alarm.timestamp).toLocaleTimeString(), " \u00B7 ", alarm.tagName, alarm.unit && (_jsxs(_Fragment, { children: [' ', "\u00B7 ", alarm.actualValue.toFixed(1), " ", alarm.unit, " vs limit", ' ', alarm.limit.toFixed(1), " ", alarm.unit] }))] })] }), unacked && (_jsx("button", { type: "button", onClick: onAck, className: "border-line text-text-faint hover:text-text-dim shrink-0 border px-1.5 text-micro leading-[16px] tracking-wider", children: "ACK" }))] }) }));
}
