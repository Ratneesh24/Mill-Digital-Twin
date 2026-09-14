/**
 * CONNECTION / SOURCE STATUS — §14.5.
 *
 *   PLC CONNECTION  ✓ CONNECTED
 *   PLC CONNECTION  ✗ LOST     LAST VALID DATA: 12:14:22
 *
 * Also carries the operating-mode selector. Switching mode disconnects the
 * current source and connects a new one, which is the §17 test 10 path:
 * "Simulation disengages cleanly, live source authoritative, no conflicting
 * values."
 */

import { useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useMachineStore } from '../../store/machineStore'
import type { OperatingMode } from '../../types/machine'

const MODE_LABEL: Record<OperatingMode, string> = {
  SIMULATION: 'SIMULATION',
  SIM_46TAG: 'SIM · 46-TAG',
  LIVE: 'LIVE',
}

const MODE_HELP: Record<OperatingMode, string> = {
  SIMULATION:
    'Full 74-tag simulated mill. Every value badged SIM — nothing here is plant data.',
  SIM_46TAG:
    'Same simulation, presented with the provenance each value will carry on the real CRM04 6-month extract: force ESTIMATED, roll gap CALCULATED, bending and OS/DS NO TAG. Rehearsal for the live feed (§7.4).',
  LIVE: 'WebSocket feed from the industrial edge gateway. Read-only (§14.4).',
}

export function ConnectionStatus() {
  const comm = useMachineStore((s) => s.state.communication)
  const mode = useMachineStore((s) => s.state.operatingMode)
  const liveUrl = useMachineStore((s) => s.liveUrl)
  const setLiveUrl = useMachineStore((s) => s.setLiveUrl)
  const connect = useMachineStore((s) => s.connect)
  const [editingUrl, setEditingUrl] = useState(false)

  const healthy = comm.connected && !comm.stale

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2">
      {/* Mode selector */}
      <div
        role="group"
        aria-label="Operating mode"
        className="border-line bg-base-950 flex max-w-full flex-wrap rounded-full border p-1"
      >
        {(['SIMULATION', 'SIM_46TAG', 'LIVE'] as OperatingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            title={MODE_HELP[m]}
            aria-pressed={mode === m}
            onClick={() => void connect(m)}
            className={`min-h-9 rounded-full px-3.5 py-1.5 text-meta font-semibold tracking-[0.06em] transition-colors ${
              mode === m
                ? m === 'LIVE'
                  ? 'bg-healthy text-white shadow-sm'
                  : 'bg-brand text-white shadow-sm'
                : 'text-text-dim hover:text-text hover:bg-base-800'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {mode === 'LIVE' &&
        (editingUrl ? (
          <label className="text-text-dim flex min-w-0 max-w-full flex-wrap items-center gap-2 text-meta font-medium">
            Gateway WebSocket URL
            <input
              autoFocus
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              onBlur={() => {
                setEditingUrl(false)
                void connect('LIVE', liveUrl)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="border-line bg-base-900 text-text num focus:border-normal w-[240px] min-w-0 max-w-full rounded-md border px-2.5 py-2 text-meta"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setEditingUrl(true)}
            className="text-text-faint num hover:text-text hover:bg-base-800 min-w-0 max-w-full rounded-md break-all px-2 py-1.5 text-left text-meta"
            aria-label={`Edit gateway WebSocket URL: ${liveUrl}`}
            title="Edit the gateway WebSocket URL"
          >
            {liveUrl}
          </button>
        ))}

      {/* Connection state */}
      <div className="flex flex-wrap items-center gap-2">
        {/* The pill's icon and wording already say what this is. */}
        <span className="label hidden xl:inline">
          {mode === 'LIVE' ? 'PLC CONNECTION' : 'SOURCE'}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-semibold tracking-wide ${
            healthy
              ? 'border-healthy/40 text-healthy bg-healthy/10'
              : 'border-alarm/50 text-alarm bg-alarm/10'
          }`}
        >
          {healthy ? (
            <Wifi size={13} aria-hidden />
          ) : (
            <WifiOff size={13} aria-hidden className="alarm-pulse" />
          )}
          {comm.connected ? (comm.stale ? 'STALE' : 'CONNECTED') : 'LOST'}
        </span>
      </div>

      {/* §14.5: when the link is not healthy, always show the last valid time. */}
      {!healthy && (
        <span className="text-text-faint num text-meta">
          LAST VALID DATA:{' '}
          {comm.lastValidTimestamp
            ? new Date(comm.lastValidTimestamp).toLocaleTimeString()
            : 'NEVER'}
        </span>
      )}

      {/* Update rate and frame counts are engineering diagnostics, not operator
          information, so they are deliberately NOT in the command bar. They
          live in the MODEL / DATA STATUS dialog with the rest of the feed
          telemetry. Only link health belongs up here. */}
    </div>
  )
}
