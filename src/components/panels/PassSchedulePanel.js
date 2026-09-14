import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PASS SCHEDULE — §11.4.
 *
 * "All passes; current pass visually dominant; `2.800 → 2.110, 24.6%`"
 *
 * The predicted force column is computed by the SAME force model that produces
 * the live reading, so REF and actual are directly comparable and a divergence
 * means something real rather than two different formulas disagreeing.
 */
import { demoPassSchedule } from '../../data/demoPassSchedule';
import { useMachineStore } from '../../store/machineStore';
import { Panel } from '../common/Panel';
export function PassSchedulePanel({ dense = false }) {
    const currentPass = useMachineStore((s) => s.state.pass.current);
    const direction = useMachineStore((s) => s.state.rollingDirection);
    const progress = useMachineStore((s) => s.state.pass.progress);
    return (_jsxs(Panel, { title: "Pass schedule", right: _jsx("span", { className: "text-text-faint truncate text-micro normal-case", children: demoPassSchedule.source }), bodyClassName: "p-0", children: [_jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { className: "bg-base-850 sticky top-0 z-10", children: _jsxs("tr", { className: "text-text-faint border-line border-b text-micro tracking-wider", children: [_jsx("th", { className: "px-2 py-1 text-left font-normal", children: "PASS" }), _jsx("th", { className: "px-2 py-1 text-left font-normal", children: "DIR" }), _jsx("th", { className: "px-2 py-1 text-right font-normal", children: "IN \u2192 OUT (mm)" }), _jsx("th", { className: "px-2 py-1 text-right font-normal", children: "RED %" }), _jsx("th", { className: "px-2 py-1 text-right font-normal", children: "SPEED" }), !dense && (_jsxs(_Fragment, { children: [_jsx("th", { className: "px-2 py-1 text-right font-normal", children: "\u03C3 ENTRY" }), _jsx("th", { className: "px-2 py-1 text-right font-normal", children: "\u03C3 EXIT" })] })), _jsx("th", { className: "px-2 py-1 text-right font-normal", children: "FORCE REF" })] }) }), _jsx("tbody", { children: demoPassSchedule.passes.map((p) => {
                            const isCurrent = p.pass === currentPass;
                            const isDone = p.pass < currentPass;
                            return (_jsxs("tr", { className: `border-line border-b text-meta ${isCurrent
                                    ? 'bg-normal/10 text-text'
                                    : isDone
                                        ? 'text-text-faint'
                                        : 'text-text-dim'}`, children: [_jsx("td", { className: "px-2 py-1", children: _jsxs("span", { className: "flex items-center gap-1.5", children: [isCurrent && _jsx("span", { className: "bg-normal h-3 w-[3px]" }), _jsx("span", { className: `num ${isCurrent ? 'font-semibold' : ''}`, children: p.pass })] }) }), _jsx("td", { className: "px-2 py-1 text-micro tracking-wider", children: p.direction === 'FORWARD' ? 'FWD →' : '← REV' }), _jsxs("td", { className: "num px-2 py-1 text-right", children: [p.inputThickness.toFixed(3), " \u2192 ", p.outputThickness.toFixed(3)] }), _jsx("td", { className: "num px-2 py-1 text-right", children: p.reduction.toFixed(1) }), _jsx("td", { className: "num px-2 py-1 text-right", children: p.speedReference.toFixed(0) }), !dense && (_jsxs(_Fragment, { children: [_jsx("td", { className: "num px-2 py-1 text-right", children: p.entrySpecificTension }), _jsx("td", { className: "num px-2 py-1 text-right", children: p.exitSpecificTension })] })), _jsxs("td", { className: "num px-2 py-1 text-right", children: [p.predictedForce.toFixed(0), " t"] })] }, p.pass));
                        }) })] }), _jsxs("div", { className: "border-line border-t px-2 py-1.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "label", children: ["PASS ", currentPass, " \u00B7 ", direction === 'FORWARD' ? 'FORWARD' : 'REVERSE'] }), _jsxs("span", { className: "num text-text-dim text-micro", children: [(progress * 100).toFixed(0), "%"] })] }), _jsx("div", { className: "bg-base-800 border-line mt-1 h-[5px] border", children: _jsx("div", { className: "bg-normal h-full transition-[width] duration-300", style: { width: `${Math.min(progress * 100, 100)}%` } }) })] })] }));
}
