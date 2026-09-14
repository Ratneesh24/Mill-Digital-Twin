/**
 * 3D DIGITAL TWIN PAGE.
 *
 * Deliberately light-touch. The twin, its overlay, camera controls and
 * equipment inspector already exist and are preserved as-is; this page only
 * gives them a route and a controls dock.
 *
 * Navigating here is view-only: the simulation keeps running behind the page
 * change, so arriving from the dashboard never restarts or disturbs it, and the
 * current pass, direction and coil carry over untouched.
 */

import { DigitalTwin } from '../digitalTwin/DigitalTwin'
import { InterlockStatus } from '../panels/InterlockStatus'
import { SimulationControls } from '../panels/SimulationControls'

export function TwinPage() {
  return (
    <div className="dashboard-twinpage grid min-h-[640px] flex-1 grid-cols-[minmax(0,1fr)_340px]">
      <div className="dashboard-twin min-h-[560px] min-w-0">
        <DigitalTwin />
      </div>

      <div className="grid min-h-0 min-w-0 content-start gap-[14px]">
        <SimulationControls />
        <InterlockStatus />
      </div>
    </div>
  )
}
