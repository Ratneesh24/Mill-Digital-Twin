import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WORKSPACE LAYOUT — the shell every page renders inside.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ HEADER (sticky command bar + 3-page nav)                     │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ page title / subtitle                    MODEL / DATA STATUS │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ <Outlet /> — Dashboard | Trends | 3D twin                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Two layout contracts this file must not break:
 *
 *   1. The routed page stays a DIRECT child of `.dashboard-content`. The
 *      responsive `.dashboard-content > .grid` rules in index.css collapse the
 *      page grids to one column below 1280px by direct-child selector; an extra
 *      wrapper silently kills that.
 *   2. The page transition animates OPACITY ONLY, on <main> itself. The three
 *      pages differ enormously in height, so animating position or scale makes
 *      the whole shell jump.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { DiagnosticsDialog } from '../ui/DiagnosticsDialog';
import { Header } from './Header';
import { pageCopy } from '../../app/routes';
export function WorkspaceLayout() {
    const { pathname } = useLocation();
    const reduceMotion = useReducedMotion();
    const copy = pageCopy(pathname);
    return (_jsxs("div", { className: "dashboard-shell bg-base-950 flex min-h-screen flex-col", children: [_jsx("a", { className: "skip-link", href: "#workspace", children: "Skip to workspace" }), _jsx(Header, {}), _jsxs(motion.main, { id: "workspace", tabIndex: -1, initial: reduceMotion ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }, className: "dashboard-content flex min-w-0 flex-1 flex-col", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-brand text-meta mb-1 font-semibold tracking-[0.18em] uppercase", children: "Operations workspace / CRM04" }), _jsx("h1", { className: "text-text text-2xl font-semibold tracking-tight", children: copy.title }), _jsx("p", { className: "text-text-dim text-body mt-1", children: copy.subtitle })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(DiagnosticsDialog, {}), _jsx("span", { className: "border-line text-text-dim bg-base-900 text-meta rounded-full border px-3.5 py-2 font-medium shadow-sm", children: "4HI reversing cold rolling mill" })] })] }), _jsx(Outlet, {})] }, pathname)] }));
}
