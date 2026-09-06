/**
 * HEADER — machine identity, mode banner, connection state, navigation.
 *
 * Light Tata Steel-inspired workspace header. The mode banner remains the most
 * important element: simulated values are never presented as plant data.
 */

import { millConfig, UNVERIFIED_PARAMETER_COUNT } from '../../config/millConfig'
import { useMachineStore } from '../../store/machineStore'
import { useAlarmStore, selectWorstSeverity } from '../../store/alarmStore'
import { useUiStore, type PanelTab } from '../../store/uiStore'
import { ConnectionStatus } from './ConnectionStatus'

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'OVERVIEW', label: 'OVERVIEW' },
  { id: 'PASS_SCHEDULE', label: 'PASS SCHEDULE' },
  { id: 'TAGS', label: 'TAG INVENTORY' },
  { id: 'CONFIG', label: 'PLANT CONFIG' },
  { id: 'VALIDATION', label: 'VALIDATION' },
]

export function Header() {
  const mode = useMachineStore((s) => s.state.operatingMode)
  const coilId = useMachineStore((s) => s.state.coil.id)
  const activeTab = useUiStore((s) => s.activeTab)
  const setTab = useUiStore((s) => s.setTab)
  const worst = useAlarmStore(selectWorstSeverity)
  const alarmCount = useAlarmStore((s) => s.active.length)

  const simulated = mode !== 'LIVE'

  return (
    <header className="brand-header border-line bg-base-900 shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-col leading-none">
            <span className="brand-wordmark" aria-label="Tata Steel">
              TATA STEEL
            </span>
            <span className="text-text-faint mt-1 text-[10px] font-semibold tracking-[0.22em]">
              CRM SAHIBABAD · NARROW COMPLEX
            </span>
          </div>
          <span aria-hidden="true" className="bg-line hidden h-10 w-px sm:block" />
          <div className="min-w-0">
            <div className="text-text truncate text-[13px] font-semibold tracking-wide">
              {millConfig.identity.mill} · 4HI REVERSING COLD ROLLING MILL
            </div>
            <div className="text-text-faint mt-0.5 text-[11px] tracking-wide">
              {millConfig.identity.plant} · DIGITAL TWIN · COIL {coilId}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {alarmCount > 0 && (
          <div
            role="status"
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide ${
              worst === 'TRIP'
                ? 'border-trip/60 text-trip bg-trip/10 alarm-pulse'
                : worst === 'ALARM'
                  ? 'border-alarm/60 text-alarm bg-alarm/10'
                  : 'border-warning/50 text-warning bg-warning/10'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                worst === 'TRIP' || worst === 'ALARM' ? 'bg-alarm' : 'bg-warning'
              }`}
            />
            {alarmCount} ACTIVE {alarmCount === 1 ? 'ALARM' : 'ALARMS'}
          </div>
        )}

        <ConnectionStatus />
        <Clock />
      </div>

      <div className="border-line bg-base-850 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 lg:px-6">
        <nav aria-label="Dashboard pages" className="workspace-nav flex max-w-full flex-wrap items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setTab(tab.id)}
              className={`rounded-md px-3.5 py-2 text-[11px] font-semibold tracking-[0.08em] transition-colors ${
                activeTab === tab.id
                  ? 'text-brand bg-brand/10'
                  : 'text-text-dim hover:text-text hover:bg-base-800'
              }`}
            >
              {tab.label}
              {tab.id === 'CONFIG' && UNVERIFIED_PARAMETER_COUNT > 0 && (
                <span className="text-warning bg-warning/15 ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]">
                  {UNVERIFIED_PARAMETER_COUNT}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {simulated ? (
            <div className="border-prov-simulated/50 bg-prov-simulated/10 text-prov-simulated max-w-full rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em]">
              {mode === 'SIM_46TAG'
                ? 'SIMULATED DATA · CRM04 46-TAG PROVENANCE PREVIEW'
                : 'SIMULATED DATA · NOT PLANT DATA'}
            </div>
          ) : (
            <div className="border-healthy/50 bg-healthy/10 text-healthy rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em]">
              LIVE PLANT DATA · READ ONLY
            </div>
          )}
          <span className="text-text-faint num hidden text-[11px] xl:inline">COIL {coilId}</span>
        </div>
      </div>
    </header>
  )
}

function Clock() {
  const timestamp = useMachineStore((s) => s.state.communication.lastFrameTimestamp)
  return (
    <div
      className="num text-text-dim bg-base-950 border-line shrink-0 rounded-md border px-2.5 py-1.5 text-[12px]"
      aria-label="Last update time"
    >
      {timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--:--'}
    </div>
  )
}
