/** View controls stay outside the canvas so they never hide the roll bite. */
import { STATUS_LABEL } from '../../machine/machineStateMachine'
import { useMachineStore } from '../../store/machineStore'
import { useUiStore } from '../../store/uiStore'
import type { MachineStatus } from '../../types/machine'
import { DirectionIndicator } from '../dashboard/DirectionIndicator'

const STATUS_TONE: Record<MachineStatus, string> = {
  ROLLING: 'text-healthy border-healthy/50 bg-healthy/10',
  SKIN_PASS: 'text-healthy border-healthy/50 bg-healthy/10',
  THREADING: 'text-normal border-normal/50 bg-normal/10',
  REWIND: 'text-normal border-normal/50 bg-normal/10',
  DECELERATING: 'text-warning border-warning/50 bg-warning/10',
  REVERSING: 'text-warning border-warning/50 bg-warning/10',
  WARMUP: 'text-warning border-warning/50 bg-warning/10',
  READY: 'text-normal border-normal/40 bg-normal/5',
  IDLE: 'text-text-dim border-line bg-base-900',
  STOPPED: 'text-text-dim border-line bg-base-900',
  ROLL_CHANGE: 'text-text-dim border-line bg-base-900',
  FAST_STOP: 'text-trip border-trip/70 bg-trip/15 alarm-pulse',
  FAULT: 'text-alarm border-alarm/70 bg-alarm/15 alarm-pulse',
}

const CONTROL = 'min-h-10 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-normal disabled:cursor-not-allowed disabled:opacity-50'
const INACTIVE = 'border-line bg-base-900 text-text-dim hover:border-normal hover:text-normal'
const ACTIVE = 'border-normal/40 bg-normal/10 text-normal'

export function TwinOverlay({ expanded, onExpand, onZoom }: {
  expanded: boolean
  onExpand: () => void
  onZoom: (amount: number) => void
}) {
  const status = useMachineStore((s) => s.state.machineStatus)
  const reason = useMachineStore((s) => s.state.statusReason)
  const resetCamera = useUiStore((s) => s.resetCamera)
  const cameraView = useUiStore((s) => s.cameraView)
  const setCameraView = useUiStore((s) => s.setCameraView)
  const showLabels = useUiStore((s) => s.showSceneLabels)
  const toggleLabels = useUiStore((s) => s.toggleSceneLabels)
  const showArrows = useUiStore((s) => s.showForceArrows)
  const toggleArrows = useUiStore((s) => s.toggleForceArrows)

  return (
    <header className="border-line bg-base-900 relative z-20 shrink-0 border-b px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
          <DirectionIndicator />
        </div>
        <MillCommandStrip />
      </div>
      {reason && <p className="text-text-dim mt-1 break-words text-[10px] leading-snug">{reason}</p>}
      <div role="group" aria-label="3D view controls" className="mt-2 flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Camera preset" className="flex gap-1">
          {(['LINE', 'STAND'] as const).map((view) => (
            <button key={view} type="button" aria-pressed={cameraView === view} title={view === 'LINE' ? 'Frame the whole pass line' : 'Inspect the roll stack'} onClick={() => setCameraView(view)} className={`${CONTROL} ${cameraView === view ? ACTIVE : INACTIVE}`}>{view}</button>
          ))}
        </div>
        <button type="button" onClick={resetCamera} title="Restore the selected camera preset" className={`${CONTROL} ${INACTIVE}`}>RESET VIEW</button>
        <button type="button" aria-label="Zoom in" onClick={() => onZoom(1)} className={`${CONTROL} ${INACTIVE} min-w-10 text-base`}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => onZoom(-1)} className={`${CONTROL} ${INACTIVE} min-w-10 text-base`}>-</button>
        <button type="button" aria-pressed={showLabels} onClick={toggleLabels} title="Show or hide equipment labels and tag readouts" className={`${CONTROL} ${showLabels ? ACTIVE : INACTIVE}`}>LABELS</button>
        <button type="button" aria-pressed={showArrows} onClick={toggleArrows} title="Show or hide roll-force vectors; strip direction markers remain visible" className={`${CONTROL} ${showArrows ? ACTIVE : INACTIVE}`}>FORCE VECTORS</button>
        <button type="button" aria-pressed={expanded} onClick={onExpand} title="Toggle fullscreen view; press Escape to exit" className={`${CONTROL} ${INACTIVE} ml-auto`}>{expanded ? 'EXIT EXPANDED' : 'EXPAND VIEW'}</button>
      </div>
    </header>
  )
}

/** These are simulation commands, never a path to control the LIVE mill. */
function MillCommandStrip() {
  const mode = useMachineStore((s) => s.state.operatingMode)
  const send = useMachineStore((s) => s.sendCommand)
  const readOnly = mode === 'LIVE'
  return (
    <div role="group" aria-label={readOnly ? 'Machine commands disabled in LIVE mode' : 'Simulation commands'} className="flex flex-wrap items-center gap-1.5">
      <span className={`text-[9px] font-semibold tracking-wide ${readOnly ? 'text-alarm' : 'text-prov-simulated'}`}>{readOnly ? 'LIVE - READ ONLY' : 'SIMULATION CONTROL'}</span>
      <button type="button" disabled={readOnly} onClick={() => send({ type: 'START' })} className={`${CONTROL} border-healthy/40 bg-healthy/5 text-healthy hover:bg-healthy/10`}>START</button>
      <button type="button" disabled={readOnly} onClick={() => send({ type: 'STOP' })} className={`${CONTROL} ${INACTIVE}`}>STOP</button>
      <button type="button" disabled={readOnly} onClick={() => send({ type: 'FAST_STOP' })} className={`${CONTROL} border-trip/40 bg-trip/5 text-trip hover:bg-trip/10`}>FAST STOP</button>
      <button type="button" disabled={readOnly} onClick={() => send({ type: 'RESET' })} className={`${CONTROL} ${INACTIVE}`}>RESET</button>
    </div>
  )
}
