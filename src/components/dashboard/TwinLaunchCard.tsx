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

import { Box, ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMachineStore } from '../../store/machineStore'
import { ROUTES } from '../../app/routes'

export function TwinLaunchCard() {
  const speed = useMachineStore((s) => s.state.speed.actual)
  const direction = useMachineStore((s) => s.state.rollingDirection)

  return (
    <Link
      to={ROUTES.twin}
      className="twin-launch border-line bg-base-900 hover:border-brand/50 group flex items-center gap-4 border px-5 py-4 transition-colors"
    >
      <span
        aria-hidden
        className="bg-brand/10 text-brand grid h-12 w-12 shrink-0 place-items-center rounded-xl"
      >
        <Box size={24} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-text text-value flex items-center gap-2 font-semibold tracking-tight">
          3D digital twin
          <span className="bg-brand/10 text-brand text-micro inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tracking-wider">
            <Sparkles size={11} aria-hidden /> LIVE
          </span>
        </span>
        <span className="text-text-dim text-meta mt-0.5 block">
          Live CRM04 mill model — {direction.toLowerCase()} at {speed.toFixed(0)} m/min
        </span>
      </span>

      <span className="bg-brand text-meta inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white shadow-sm">
        OPEN
        <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
