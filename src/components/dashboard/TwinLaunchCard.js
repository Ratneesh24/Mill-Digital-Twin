import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The dashboard's link to the 3D twin.
 *
 * The model itself is deliberately NOT on this page — it is expensive to render
 * and would dominate a screen whose job is answering "what is happening right
 * now" in numbers. This card is the doorway; the twin keeps its own page.
 *
 * Navigation is view-only: the simulation runs independently of which page is
 * mounted, so arriving at the twin never resets pass, direction or coil.
 */
import { Box, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMachineStore } from '../../store/machineStore';
import { ROUTES } from '../../app/routes';
export function TwinLaunchCard() {
    const speed = useMachineStore((s) => s.state.speed.actual);
    const direction = useMachineStore((s) => s.state.rollingDirection);
    return (_jsxs(Link, { to: ROUTES.twin, className: "twin-launch border-line bg-base-900 hover:border-brand/50 group flex items-center gap-4 border px-5 py-4 transition-colors", children: [_jsx("span", { "aria-hidden": true, className: "bg-brand/10 text-brand grid h-12 w-12 shrink-0 place-items-center rounded-xl", children: _jsx(Box, { size: 24 }) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "text-text text-value flex items-center gap-2 font-semibold tracking-tight", children: ["3D digital twin", _jsxs("span", { className: "bg-brand/10 text-brand text-micro inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tracking-wider", children: [_jsx(Sparkles, { size: 11, "aria-hidden": true }), " LIVE"] })] }), _jsxs("span", { className: "text-text-dim text-meta mt-0.5 block", children: ["Live CRM04 mill model \u2014 ", direction.toLowerCase(), " at ", speed.toFixed(0), " m/min"] })] }), _jsxs("span", { className: "bg-brand text-meta inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm", children: ["OPEN", _jsx(ArrowRight, { size: 15, "aria-hidden": true, className: "transition-transform group-hover:translate-x-0.5" })] })] }));
}
