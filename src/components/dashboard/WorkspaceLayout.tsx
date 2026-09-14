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

import { motion, useReducedMotion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { DiagnosticsDialog } from '../ui/DiagnosticsDialog'
import { Header } from './Header'
import { pageCopy } from '../../app/routes'

export function WorkspaceLayout() {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const copy = pageCopy(pathname)

  return (
    <div className="dashboard-shell bg-base-950 flex min-h-screen flex-col">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <Header />

      <motion.main
        key={pathname}
        id="workspace"
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        className="dashboard-content flex min-w-0 flex-1 flex-col"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-brand text-meta mb-1 font-semibold tracking-[0.18em] uppercase">
              Operations workspace / CRM04
            </p>
            <h1 className="text-text text-2xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-text-dim text-body mt-1">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DiagnosticsDialog />
            <span className="border-line text-text-dim bg-base-900 text-meta rounded-full border px-3.5 py-2 font-medium shadow-sm">
              4HI reversing cold rolling mill
            </span>
          </div>
        </div>

        <Outlet />
      </motion.main>
    </div>
  )
}
