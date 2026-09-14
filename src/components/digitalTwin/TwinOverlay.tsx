/** View controls stay outside the canvas so they never hide the roll bite. */
import {
  AlertTriangle,
  Expand,
  FastForward,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Shrink,
  Square,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ROUTES } from '../../app/routes'
import { isStartable, STATUS_LABEL } from '../../machine/machineStateMachine'
import { interlockReadout } from '../../machine/interlockEngine'
import { selectInterlockChain, useMachineStore } from '../../store/machineStore'
import { useUiStore, type CameraView } from '../../store/uiStore'
import type { MachineStatus } from '../../types/machine'
import { cn } from '../ui/cn'
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

const CONTROL = 'min-h-10 rounded-[10px] border px-2.5 py-1.5 text-micro font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-normal disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-1.5'
const INACTIVE = 'border-line bg-base-900 text-text-dim hover:border-normal hover:text-normal'
const ACTIVE = 'border-normal/40 bg-normal/10 text-normal'

const CAMERA_VIEW_HINT: Record<CameraView, string> = {
  LINE: 'Frame the whole pass line, pay-off reel to delivery tension reel',
  STAND: 'Inspect the roll stack',
  ENTRY: 'Frame the pay-off end: POR, peeler, flattener, carry-over table and ETR',
}

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
  const navigate = useNavigate()

  return (
    <header className="border-line bg-base-900 relative z-20 shrink-0 border-b px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn('rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide', STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>
          <DirectionIndicator />
        </div>
        <MillCommandStrip />
      </div>
      {reason && <p className="text-text-dim mt-1 break-words text-micro leading-snug">{reason}</p>}
      <div role="group" aria-label="3D view controls" className="mt-2 flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Camera preset" className="flex gap-1">
          {(['LINE', 'STAND', 'ENTRY'] as const).map((view) => (
            <button key={view} type="button" aria-pressed={cameraView === view} title={CAMERA_VIEW_HINT[view]} onClick={() => setCameraView(view)} className={cn(CONTROL, cameraView === view ? ACTIVE : INACTIVE)}>{view}</button>
          ))}
        </div>
        <button type="button" onClick={resetCamera} title="Restore the selected camera preset" className={cn(CONTROL, INACTIVE)}><RotateCcw size={13} aria-hidden />RESET VIEW</button>
        <button type="button" aria-label="Zoom in" onClick={() => onZoom(1)} className={cn(CONTROL, INACTIVE, 'min-w-10')}><Plus size={14} aria-hidden /></button>
        <button type="button" aria-label="Zoom out" onClick={() => onZoom(-1)} className={cn(CONTROL, INACTIVE, 'min-w-10')}><Minus size={14} aria-hidden /></button>
        <button type="button" aria-pressed={showLabels} onClick={toggleLabels} title="Show or hide equipment labels and tag readouts" className={cn(CONTROL, showLabels ? ACTIVE : INACTIVE)}>LABELS</button>
        <button type="button" aria-pressed={showArrows} onClick={toggleArrows} title="Show or hide roll-force vectors; strip direction markers remain visible" className={cn(CONTROL, showArrows ? ACTIVE : INACTIVE)}>FORCE VECTORS</button>
        <button type="button" aria-pressed={expanded} onClick={onExpand} title="Toggle fullscreen view; press Escape to exit" className={cn(CONTROL, INACTIVE, 'ml-auto')}>{expanded ? <Shrink size={13} aria-hidden /> : <Expand size={13} aria-hidden />}{expanded ? 'EXIT EXPANDED' : 'EXPAND VIEW'}</button>
        <button type="button" onClick={() => navigate(ROUTES.trends)} title="Open the real-time trends page; the simulation keeps running" className={cn(CONTROL, INACTIVE)}><TrendingUp size={13} aria-hidden />TRENDS</button>
      </div>
    </header>
  )
}

/**
 * Simulation commands — never a path to control the LIVE mill.
 *
 * A blocked START never vanishes silently: the button stays clickable, explains
 * exactly what is holding the mill (interlock cause, feed state or resettable
 * latch), and points at RESET when a reset is what unblocks it.
 */
function MillCommandStrip() {
  const mode = useMachineStore((s) => s.state.operatingMode)
  const status = useMachineStore((s) => s.state.machineStatus)
  const comm = useMachineStore((s) => s.state.communication)
  const chain = useMachineStore(selectInterlockChain)
  const send = useMachineStore((s) => s.sendCommand)
  const readOnly = mode === 'LIVE'

  const readout = interlockReadout(chain)
  const feedDown = !comm.connected || comm.stale
  const needsReset = status === 'FAST_STOP' || status === 'FAULT'
  const startableState = isStartable(status)
  const canStart =
    !readOnly && startableState && chain.millReady && !feedDown && !needsReset

  const blockReason = readOnly
    ? 'LIVE mode is read-only — switch to SIMULATION to drive the mill.'
    : needsReset
      ? `Mill is in ${STATUS_LABEL[status]} — press RESET before START.`
      : !startableState
        ? `START is not meaningful while ${STATUS_LABEL[status]}.`
        : feedDown
          ? `Data feed ${comm.connected ? 'is STALE' : 'is LOST'} — START waits for fresh data.`
          : !chain.millReady
            ? (readout.reason ?? 'Mill interlock is holding the start.')
            : null

  const handleStart = () => {
    if (readOnly || canStart) {
      if (!readOnly) send({ type: 'START' })
      return
    }
    toast.error('START blocked', { description: blockReason ?? undefined })
  }

  return (
    <div className="min-w-0">
      <div role="group" aria-label={readOnly ? 'Machine commands disabled in LIVE mode' : 'Simulation commands'} className="flex flex-wrap items-center gap-1.5">
        <span className={cn('text-micro font-semibold tracking-wide', readOnly ? 'text-alarm' : 'text-prov-simulated')}>{readOnly ? 'LIVE - READ ONLY' : 'SIMULATION CONTROL'}</span>
        <button
          type="button"
          disabled={readOnly}
          onClick={handleStart}
          title={canStart ? 'Start rolling' : (blockReason ?? 'Start rolling')}
          aria-disabled={!canStart}
          className={cn(
            CONTROL,
            canStart
              ? 'border-healthy/40 bg-healthy/5 text-healthy hover:bg-healthy/10'
              : 'border-line text-text-faint bg-base-900',
          )}
        >
          <Play size={13} aria-hidden />START
        </button>
        <button type="button" disabled={readOnly} onClick={() => send({ type: 'STOP' })} className={cn(CONTROL, INACTIVE)}><Square size={13} aria-hidden />STOP</button>
        <button type="button" disabled={readOnly} onClick={() => send({ type: 'FAST_STOP' })} className={cn(CONTROL, 'border-trip/40 bg-trip/5 text-trip hover:bg-trip/10')}><FastForward size={13} aria-hidden />FAST STOP</button>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => send({ type: 'RESET' })}
          title={needsReset ? 'Clear the latch so the mill can start again' : 'Reset latched stops'}
          className={cn(
            CONTROL,
            needsReset
              ? 'border-warning/60 bg-warning/10 text-warning alarm-pulse'
              : INACTIVE,
          )}
        >
          <RotateCcw size={13} aria-hidden />RESET
        </button>
      </div>
      {!readOnly && blockReason && (
        <p role="status" className="text-warning mt-1 flex items-start gap-1 text-micro leading-snug">
          <AlertTriangle size={12} aria-hidden className="mt-px shrink-0" />
          <span>{blockReason}</span>
        </p>
      )}
    </div>
  )
}
