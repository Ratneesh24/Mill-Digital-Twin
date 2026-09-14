import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EVENT TIMELINE — §11.4.
 *
 *   12:15:04 PASS 2 STARTED
 *   12:15:17 SPEED 120→150 mpm
 *   12:15:32 ROLLING FORCE HIGH
 *
 * Bounded log (§15) — the oldest events fall off rather than accumulating over a
 * multi-day shift.
 */
import { useMachineStore } from '../../store/machineStore';
import { EmptyNote, Panel } from '../common/Panel';
const CATEGORY_STYLE = {
    STATE: 'text-normal',
    PASS: 'text-healthy',
    SETPOINT: 'text-text-dim',
    ALARM: 'text-alarm',
    COMMS: 'text-warning',
    OPERATOR: 'text-prov-simulated',
};
export function EventTimeline() {
    const events = useMachineStore((s) => s.events);
    return (_jsx(Panel, { title: "Event timeline", bodyClassName: "p-0", children: events.length === 0 ? (_jsx(EmptyNote, { children: "No events recorded" })) : (_jsx("ul", { className: "divide-line divide-y", children: events.map((event) => (_jsxs("li", { className: "flex items-baseline gap-2 px-2.5 py-[3px]", children: [_jsx("span", { className: "num text-text-faint shrink-0 text-micro", children: new Date(event.timestamp).toLocaleTimeString() }), _jsx("span", { className: `truncate text-micro tracking-wide ${CATEGORY_STYLE[event.category]}`, children: event.message })] }, event.id))) })) }));
}
