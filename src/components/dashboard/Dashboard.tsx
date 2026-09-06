/**
 * DASHBOARD LAYOUT — light Tata Steel-inspired operations workspace.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ HEADER                                                       │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ SPEED │ THICKNESS │ FORCE │ GAP │ TENSION │ PASS │ STATUS    │
 *   ├───────────────┬──────────────────────────────┬───────────────┤
 *   │ COIL / ENTRY  │                              │ MILL HEALTH   │
 *   │               │      3D DIGITAL TWIN         │ CONTROLS      │
 *   │ DTR / ETR/POR │                              │ INTERLOCKS    │
 *   ├───────────────┴──────────────────────────────┴───────────────┤
 *   │ PASS SCHEDULE │ LIVE TREND │ ALARMS │ SYSTEM STATUS          │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The centre column is deliberately the largest cell on the screen: the 3D
 * twin is the primary feature and must dominate.
 */

import { useMachineStore } from '../../store/machineStore'
import { useUiStore } from '../../store/uiStore'
import { LiveChart } from '../charts/LiveChart'
import { DigitalTwin } from '../digitalTwin/DigitalTwin'
import { AlarmPanel } from '../panels/AlarmPanel'
import { CoilDetails } from '../panels/CoilDetails'
import { ControlStatus } from '../panels/ControlStatus'
import { EventTimeline } from '../panels/EventTimeline'
import { InterlockStatus } from '../panels/InterlockStatus'
import { MillHealth } from '../panels/MillHealth'
import { PassSchedulePanel } from '../panels/PassSchedulePanel'
import { PlantConfig } from '../panels/PlantConfig'
import { ReelPanel } from '../panels/ReelPanel'
import { SimulationControls } from '../panels/SimulationControls'
import { SystemStatus } from '../panels/SystemStatus'
import { TagInventory } from '../panels/TagInventory'
import { ValidationPanel } from '../panels/ValidationPanel'
import { Header } from './Header'
import { KPIBar } from './KPIBar'

const PAGE_COPY = {
  OVERVIEW: ['Mill overview', 'Your production line, in perspective.'],
  PASS_SCHEDULE: ['Pass schedule', 'Follow each pass from setup to completion.'],
  TAGS: ['Tag inventory', 'Explore the data behind your digital twin.'],
  CONFIG: ['Plant configuration', 'Engineering references and verification status.'],
  VALIDATION: ['System validation', 'Check the model. Understand its limits.'],
} as const

export function Dashboard() {
  const tab = useUiStore((s) => s.activeTab)

  return (
    <div className="dashboard-shell bg-base-950 flex min-h-screen flex-col">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <Header />

      <main id="workspace" tabIndex={-1} className="dashboard-content flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-brand mb-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
              Operations workspace / CRM04
            </p>
            <h1 className="text-text text-2xl font-semibold tracking-tight">{PAGE_COPY[tab][0]}</h1>
            <p className="text-text-dim mt-1 text-[13px]">{PAGE_COPY[tab][1]}</p>
          </div>
          <span className="border-line text-text-dim bg-base-900 rounded-full border px-3.5 py-2 text-[12px] font-medium shadow-sm">
            4HI reversing cold rolling mill
          </span>
        </div>
        {tab === 'OVERVIEW' && <Overview />}
        {tab === 'PASS_SCHEDULE' && <PassSchedulePage />}
        {tab === 'TAGS' && <TagInventory />}
        {tab === 'CONFIG' && <PlantConfig />}
        {tab === 'VALIDATION' && <ValidationPanel />}
      </main>
    </div>
  )
}

function Overview() {
  return (
    <>
      <div className="dashboard-kpis shrink-0">
        <KPIBar />
      </div>

      {/* Main row — the twin dominates. */}
      <div className="dashboard-overview grid min-h-[620px] flex-1 grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="dashboard-sidebar grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <CoilDetails />
          <ReelPanel />
        </div>

        <div className="dashboard-twin min-h-[560px] min-w-0">
          <DigitalTwin />
        </div>

        <div className="dashboard-sidebar grid min-h-0 min-w-0 grid-rows-[minmax(0,1.35fr)_auto_auto]">
          <MillHealth />
          <ControlStatus />
          <InterlockStatus />
        </div>
      </div>

      {/* Bottom row. */}
      <div className="dashboard-bottom grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <PassSchedulePanel dense />
        <LiveChart />
        <AlarmPanel />
        <SystemStatus />
      </div>
    </>
  )
}

/**
 * Secondary page: the pass schedule at full width alongside the simulation
 * controls and the event timeline — the "what happens next" view.
 */
function PassSchedulePage() {
  const pass = useMachineStore((s) => s.state.pass)

  return (
    <div className="dashboard-pass grid min-h-0 grid-cols-[1.35fr_1fr]">
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <PassSchedulePanel />
        <EventTimeline />
      </div>
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-auto">
        <SimulationControls />
        <CoilDetails />
        <div className="panel">
          <div className="panel-title">
            <h2>Next</h2>
          </div>
          <div className="panel-body">
            <p className="text-text-dim text-[12px] leading-relaxed">
              {pass.current < pass.total ? (
                <>
                  Pass {pass.current} is {(pass.progress * 100).toFixed(0)}% complete. At the end of
                  the pass the mill decelerates to standstill, the direction flag flips, the entry
                  and exit reel roles swap, and the capsule prepositions for pass {pass.current + 1}{' '}
                  before the strip accelerates the other way. No step of that sequence happens while
                  the strip is still moving.
                </>
              ) : (
                <>
                  Pass {pass.current} of {pass.total} is the final pass. At the end of it the mill
                  stops and the coil is finished; charge the next coil to start a new schedule.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
