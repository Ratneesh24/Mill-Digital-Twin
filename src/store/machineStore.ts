/**
 * MACHINE STORE — the single authoritative MachineState (§4, §6).
 *
 * Responsibilities, and nothing else:
 *   - own the active DataSource and its lifecycle
 *   - project each incoming TagFrame into MachineState (via dataAdapter)
 *   - run the staleness watchdog (§14.5)
 *   - fan values out to the telemetry buffers and the alarm engine
 *   - record machine events for the timeline (§11.4)
 *
 * It does NOT compute physics. Every number in here arrived as a Tag.
 *
 * PERFORMANCE (§15): components subscribe with selectors so a KPI change never
 * re-renders the 3D scene, and the 3D scene subscribes imperatively (see
 * `machine/twinEngine.ts`) so it never re-renders React at all.
 */

import { create } from 'zustand'
import { engineeringConfig } from '../config/engineeringConfig'
import { emptyMachineState, projectMachineState } from '../communication/dataAdapter'
import type { DataSource, Unsubscribe } from '../communication/dataSource'
import { SimulationDataSource } from '../communication/simulationDataSource'
import { WebSocketDataSource } from '../communication/websocketClient'
import { evaluateInterlocks } from '../machine/interlockEngine'
import { STATUS_LABEL } from '../machine/machineStateMachine'
import type { SimulationCommand } from '../simulation/simulationEngine'
import type { ScenarioId } from '../simulation/simulationScenarios'
import type { InterlockChain } from '../types/alarms'
import type { CommState, MachineEvent, MachineState, OperatingMode } from '../types/machine'
import type { TagFrame } from '../types/tags'
import { BoundedLog } from '../utils/ringBuffer'
import { useAlarmStore } from './alarmStore'
import { telemetryStore } from './telemetryStore'

/** Event timeline capacity — bounded, per §15. */
const EVENT_LOG_CAPACITY = 400

const eventLog = new BoundedLog<MachineEvent>(EVENT_LOG_CAPACITY)
let eventSeq = 0

/** Module-scoped so the non-serialisable source never enters React state. */
let activeSource: DataSource | null = null
let unsubscribeData: Unsubscribe | null = null
let unsubscribeConn: Unsubscribe | null = null
let watchdog: ReturnType<typeof setInterval> | null = null

/** Rolling window used to measure the actual feed rate. */
const frameTimes: number[] = []

/**
 * Guards against overlapping connects. React StrictMode mounts effects twice in
 * development, and `connect` is async, so without this two SimulationDataSources
 * end up publishing into the same store — which shows up as a doubled feed rate
 * and two engines fighting over the mill.
 */
let connectGeneration = 0

export interface MachineStoreState {
  state: MachineState
  tags: TagFrame
  interlockChain: InterlockChain
  events: MachineEvent[]
  scenario: ScenarioId
  /** URL used when the operator switches to LIVE. */
  liveUrl: string
  sourceReady: boolean

  connect: (mode: OperatingMode, url?: string) => Promise<void>
  disconnect: () => Promise<void>
  sendCommand: (cmd: SimulationCommand) => void
  setScenario: (scenario: ScenarioId) => void
  setLiveUrl: (url: string) => void
  addEvent: (category: MachineEvent['category'], message: string) => void
}

const initialComm: CommState = {
  connected: false,
  sourceName: 'No source',
  lastFrameTimestamp: 0,
  lastValidTimestamp: 0,
  ageMs: 0,
  stale: true,
  updateRateHz: 0,
  framesReceived: 0,
}

const initialChain = evaluateInterlocks({
  driveReady: false,
  hydraulicReady: false,
  tensionReady: false,
  gaugeReady: false,
  emergencyStop: false,
  fastStop: false,
  communicationHealthy: false,
})

export const useMachineStore = create<MachineStoreState>((set, get) => ({
  state: emptyMachineState('SIMULATION'),
  tags: {},
  interlockChain: initialChain,
  events: [],
  scenario: 'NORMAL',
  liveUrl: 'ws://localhost:8080/ws/crm04',
  sourceReady: false,

  async connect(mode, url) {
    const teardown = get().disconnect()
    const generation = connectGeneration
    telemetryStore.clear()
    useAlarmStore.getState().reset()
    set({ state: emptyMachineState(mode), tags: {}, interlockChain: initialChain, scenario: 'NORMAL' })
    await teardown
    // A newer connect() started while we were tearing the old one down.
    if (generation !== connectGeneration) return

    const source: DataSource =
      mode === 'LIVE'
        ? new WebSocketDataSource({ url: url ?? get().liveUrl })
        : new SimulationDataSource(mode)

    activeSource = source

    let comm: CommState = {
      ...initialComm,
      sourceName: source.name,
    }

    unsubscribeConn = source.onConnectionChange((info) => {
      if (generation !== connectGeneration) return
      comm = {
        ...comm,
        connected: info.status === 'CONNECTED',
        sourceName: info.sourceName,
        stale: info.status !== 'CONNECTED' || comm.stale,
        updateRateHz: info.status === 'CONNECTED' ? comm.updateRateHz : 0,
      }
      applyCommunication(set, get, comm)
      get().addEvent(
        'COMMS',
        info.status === 'CONNECTED'
          ? `DATA SOURCE CONNECTED — ${info.sourceName}`
          : `DATA SOURCE ${info.status}${info.error ? ` — ${info.error}` : ''}`,
      )
    })

    unsubscribeData = source.subscribe([], ({ timestamp, tags }) => {
      if (generation !== connectGeneration) return
      const now = Date.now()
      const ageMs = Math.max(0, now - timestamp)

      // Measure the real feed rate over a 2 s window — this is what the
      // connection panel reports, not the source's advertised nominal rate.
      frameTimes.push(now)
      while (frameTimes.length > 0 && now - frameTimes[0] > 2000) frameTimes.shift()
      const updateRateHz = frameTimes.length > 1 ? frameTimes.length / 2 : 0

      comm = {
        ...comm,
        connected: true,
        lastFrameTimestamp: timestamp,
        lastValidTimestamp: ageMs > engineeringConfig.staleAfterMs ? comm.lastValidTimestamp : timestamp,
        ageMs,
        stale: ageMs > engineeringConfig.staleAfterMs,
        updateRateHz,
        framesReceived: comm.framesReceived + 1,
      }

      const diagnostics =
        source instanceof SimulationDataSource
          ? source.getDiagnostics()
          : { solverIterations: 0, gaugemeterResidualUm: 0 }

      const next = projectMachineState(tags, { mode: source.mode, communication: comm, diagnostics })
      applyFrame(set, get, next, comm.stale ? markTagsStale(tags) : tags)
    })

    if (generation !== connectGeneration) {
      await source.disconnect()
      return
    }

    await source.connect()
    if (generation !== connectGeneration) {
      await source.disconnect()
      return
    }

    // Staleness watchdog (§14.5). Runs independently of the feed so a source
    // that simply stops sending is detected rather than silently believed.
    watchdog = setInterval(() => {
      if (generation !== connectGeneration) return
      const prevState = get().state
      if (!prevState.communication.lastFrameTimestamp) return
      const ageMs = Math.max(0, Date.now() - prevState.communication.lastFrameTimestamp)
      const stale = !comm.connected || comm.stale || ageMs > engineeringConfig.staleAfterMs
      const becameStale = stale && !prevState.communication.stale

      if (stale === prevState.communication.stale && Math.abs(ageMs - prevState.communication.ageMs) <= 400) {
        return
      }

      comm = { ...comm, ageMs, stale, updateRateHz: stale ? 0 : comm.updateRateHz }
      applyCommunication(set, get, comm)

      // §14.5: "Stale values must visibly stop being LIVE."
      // The connection banner is not enough — every individual readout has to
      // stop claiming freshness, so the tags themselves are re-stamped. Without
      // this a dead feed still renders a green LIVE badge beside a frozen number.
      if (becameStale) {
        get().addEvent(
          'COMMS',
          `DATA STALE — last valid data ${new Date(prevState.communication.lastValidTimestamp).toLocaleTimeString()}`,
        )
      }
    }, 500)

    set({ sourceReady: true })
    get().addEvent('OPERATOR', `OPERATING MODE ${mode}`)
  },

  async disconnect() {
    ++connectGeneration
    unsubscribeData?.()
    unsubscribeConn?.()
    unsubscribeData = null
    unsubscribeConn = null
    if (watchdog) {
      clearInterval(watchdog)
      watchdog = null
    }
    const source = activeSource
    activeSource = null
    frameTimes.length = 0
    set({ sourceReady: false })
    applyCommunication(set, get, {
      ...get().state.communication,
      connected: false,
      stale: true,
      updateRateHz: 0,
    })
    await source?.disconnect()
  },

  sendCommand(cmd) {
    if (activeSource instanceof SimulationDataSource) {
      activeSource.command(cmd)
      get().addEvent('OPERATOR', describeCommand(cmd))
    } else {
      // §14.4: real machine commands are out of scope. The UI must not pretend
      // a control action reached the mill.
      get().addEvent('OPERATOR', `COMMAND ${cmd.type} REJECTED — LIVE MODE IS READ-ONLY`)
    }
  },

  setScenario(scenario) {
    set({ scenario })
    get().sendCommand({ type: 'SET_SCENARIO', scenario })
  },

  setLiveUrl(url) {
    set({ liveUrl: url })
  },

  addEvent(category, message) {
    eventLog.push({ id: `evt-${++eventSeq}`, timestamp: Date.now(), category, message })
    set({ events: eventLog.toArray() })
  },
}))

function markTagsStale(tags: TagFrame): TagFrame {
  return Object.fromEntries(Object.entries(tags).map(([name, tag]) => [
    name,
    tag.quality === 'NO_TAG' || tag.quality === 'BAD' ? tag : { ...tag, quality: 'STALE' as const },
  ]))
}

function interlocksFor(state: MachineState): InterlockChain {
  return evaluateInterlocks({
    driveReady: state.interlocks.drive,
    hydraulicReady: state.interlocks.hydraulic,
    tensionReady: state.interlocks.tension,
    gaugeReady: state.interlocks.gauge,
    emergencyStop: state.interlocks.emergencyStop,
    fastStop: state.machineStatus === 'FAST_STOP',
    communicationHealthy: state.communication.connected && !state.communication.stale,
  })
}

/** Connection-only changes must invalidate readiness without inventing samples. */
function applyCommunication(
  set: (partial: Partial<MachineStoreState>) => void,
  get: () => MachineStoreState,
  communication: CommState,
): void {
  const prev = get()
  const state = { ...prev.state, communication }
  set({
    state,
    tags: communication.stale && !prev.state.communication.stale ? markTagsStale(prev.tags) : prev.tags,
    interlockChain: interlocksFor(state),
  })
  useAlarmStore.getState().evaluate(state)
}

/**
 * Apply a projected frame: detect the changes worth an event, update derived
 * state, and fan out to telemetry and alarms.
 */
function applyFrame(
  set: (partial: Partial<MachineStoreState>) => void,
  get: () => MachineStoreState,
  next: MachineState,
  tags: TagFrame,
): void {
  const prev = get().state

  // ---- Events worth recording on the timeline (§11.4) --------------------
  if (prev.machineStatus !== next.machineStatus) {
    get().addEvent(
      'STATE',
      `${STATUS_LABEL[next.machineStatus]}${next.statusReason ? ` — ${next.statusReason}` : ''}`,
    )
  }
  if (prev.pass.current !== next.pass.current) {
    get().addEvent(
      'PASS',
      `PASS ${next.pass.current} STARTED — ${next.pass.inputThickness.toFixed(3)} → ${next.pass.targetThickness.toFixed(3)} mm, ${next.pass.reduction.toFixed(1)}%`,
    )
  }
  if (prev.rollingDirection !== next.rollingDirection) {
    get().addEvent('STATE', `DIRECTION ${next.rollingDirection}`)
  }
  if (Math.abs(prev.speed.reference - next.speed.reference) >= 1) {
    get().addEvent(
      'SETPOINT',
      `SPEED ${prev.speed.reference.toFixed(0)}→${next.speed.reference.toFixed(0)} mpm`,
    )
  }

  // ---- Interlock chain — derived once, here, and read by every panel -----
  // Nullable values are passed through as null rather than coerced to false, so
  // the chain can distinguish "not ready" from "no tag on this feed" (§7.4).
  const interlockChain = interlocksFor(next)

  set({ state: next, tags, interlockChain })

  // ---- Telemetry (throttled inside the store, §12) ----------------------
  if (!next.communication.stale) telemetryStore.record(next.communication.lastFrameTimestamp || Date.now(), {
    speed: next.speed.actual,
    thickness: next.thickness.actual,
    thicknessDeviation: next.thickness.deviation,
    rollingForce: next.rollingForce.actual,
    rollGap: next.rollGap.actual,
    entryTension: next.tension.entry,
    exitTension: next.tension.exit,
    torque: next.drive.torque,
    current: next.drive.current,
  })

  // ---- Alarms -----------------------------------------------------------
  useAlarmStore.getState().evaluate(next)
}

function describeCommand(cmd: SimulationCommand): string {
  switch (cmd.type) {
    case 'START':
      return 'START REQUESTED'
    case 'STOP':
      return 'STOP REQUESTED'
    case 'FAST_STOP':
      return 'FAST STOP REQUESTED'
    case 'RESET':
      return 'RESET REQUESTED'
    case 'TRIM_ROLL_GAP':
      return `ROLL GAP TRIM ${(cmd.value ?? 0) >= 0 ? '+' : ''}${(cmd.value ?? 0).toFixed(3)} mm`
    case 'TRIM_SPEED_REFERENCE':
      return `SPEED REFERENCE TRIM ${(cmd.value ?? 0) >= 0 ? '+' : ''}${(cmd.value ?? 0).toFixed(0)} mpm`
    case 'SET_AGC':
      return `AGC ${cmd.flag ? 'ON' : 'OFF'}`
    case 'TRIM_ENTRY_TENSION':
      return `ENTRY TENSION TRIM ${(cmd.value ?? 0) >= 0 ? '+' : ''}${(cmd.value ?? 0).toFixed(1)} kN`
    case 'TRIM_EXIT_TENSION':
      return `EXIT TENSION TRIM ${(cmd.value ?? 0) >= 0 ? '+' : ''}${(cmd.value ?? 0).toFixed(1)} kN`
    case 'LOAD_NEXT_COIL':
      return 'NEXT COIL CHARGED'
    case 'SET_SCENARIO':
      return `SCENARIO ${cmd.scenario}`
    case 'SET_AUX_HEALTH':
      return `${cmd.system?.toUpperCase()} ${cmd.flag ? 'HEALTHY' : 'FAULT'}`
    default:
      return cmd.type
  }
}

// ---------------------------------------------------------------------------
// Selectors. Components import these rather than reaching into `state` so the
// subscription surface stays narrow (§15).
// ---------------------------------------------------------------------------

export const selectMachineState = (s: MachineStoreState): MachineState => s.state
export const selectStatus = (s: MachineStoreState) => s.state.machineStatus
export const selectDirection = (s: MachineStoreState) => s.state.rollingDirection
export const selectMode = (s: MachineStoreState) => s.state.operatingMode
export const selectCommunication = (s: MachineStoreState) => s.state.communication
export const selectInterlockChain = (s: MachineStoreState) => s.interlockChain
export const selectTags = (s: MachineStoreState) => s.tags

/** Read one tag's metadata — used by the provenance badge on every readout. */
export function useTag(tagName: string) {
  return useMachineStore((s) => s.tags[tagName])
}

/** Direct, non-reactive read for imperative code (the 3D frame loop). */
export function readMachineState(): MachineState {
  return useMachineStore.getState().state
}
