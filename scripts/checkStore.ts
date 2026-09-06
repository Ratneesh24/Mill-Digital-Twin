import assert from 'node:assert/strict'
import { engineeringConfig } from '../src/config/engineeringConfig'
import { SimulationEngine } from '../src/simulation/simulationEngine'
import { TwinEngine } from '../src/machine/twinEngine'
import { useAlarmStore } from '../src/store/alarmStore'
import { useMachineStore } from '../src/store/machineStore'
import { telemetryStore } from '../src/store/telemetryStore'

const originalInterval = globalThis.setInterval
const originalClearInterval = globalThis.clearInterval
const originalWebSocket = globalThis.WebSocket
const originalNow = Date.now
const intervals = new Map<number, { callback: () => void; delay: number }>()
let timerId = 0
let now = 1_800_000_000_000
Date.now = () => now
globalThis.setInterval = ((callback: () => void, delay: number) => {
  intervals.set(++timerId, { callback, delay })
  return timerId
}) as unknown as typeof setInterval
globalThis.clearInterval = ((id: number) => intervals.delete(id)) as unknown as typeof clearInterval

class MockSocket {
  static latest: MockSocket
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  constructor(_url: string) { MockSocket.latest = this }
  close() { this.onclose?.() }
  send(tags: Record<string, unknown>, timestamp = now) {
    this.onmessage?.({ data: JSON.stringify({ timestamp, tags }) })
  }
}
globalThis.WebSocket = MockSocket as unknown as typeof WebSocket

function tick(delay: number) {
  for (const timer of [...intervals.values()]) if (timer.delay === delay) timer.callback()
}
const store = useMachineStore.getState
const alarms = useAlarmStore.getState

try {
  await store().connect('SIMULATION')
  tick(engineeringConfig.simulationTickMs)
  assert.equal(store().interlockChain.millReady, true)
  now += 1000
  tick(engineeringConfig.simulationTickMs)
  assert.ok(telemetryStore.read('speed', '1m').length > 0)

  const lastTimestamp = store().state.communication.lastValidTimestamp
  const history = telemetryStore.read('speed', '1m')
  now += engineeringConfig.staleAfterMs + 1
  tick(500)
  assert.equal(store().state.communication.stale, true)
  assert.equal(store().interlockChain.millReady, false)
  assert.equal(store().interlockChain.blockingReason, 'DATA FEED STALE OR LOST')
  assert.equal(store().tags['MILL.SPEED.ACTUAL'].quality, 'STALE')
  assert.equal(store().state.communication.lastValidTimestamp, lastTimestamp)
  assert.ok(alarms().active.some((alarm) => alarm.id === 'COMMUNICATION_LOST'))
  assert.deepEqual(telemetryStore.read('speed', '1m'), history)
  tick(engineeringConfig.simulationTickMs)
  assert.equal(store().state.communication.stale, false)
  assert.equal(store().interlockChain.millReady, true)
  assert.ok(!alarms().active.some((alarm) => alarm.id === 'COMMUNICATION_LOST'))

  store().setScenario('COMMUNICATION_LOSS')
  const connecting = store().connect('LIVE')
  assert.equal(store().state.operatingMode, 'LIVE', 'mode changes before a connection succeeds')
  assert.deepEqual(store().tags, {})
  assert.equal(store().scenario, 'NORMAL')
  assert.equal(telemetryStore.read('speed', '1m').length, 0)
  await connecting
  assert.equal(store().state.communication.stale, true)
  const socket = MockSocket.latest
  socket.onopen?.()
  assert.equal(store().state.communication.stale, true, 'open socket is not fresh process data')
  const raw = new SimulationEngine().tick(0.1)
  socket.send(raw, now - engineeringConfig.staleAfterMs - 1)
  assert.equal(store().state.communication.stale, true, 'old data is stale on arrival')
  assert.equal(store().tags['MILL.SPEED.ACTUAL'].quality, 'STALE')
  assert.equal(store().state.communication.lastValidTimestamp, 0)
  assert.equal(telemetryStore.read('speed', '1m').length, 0)
  socket.send({ ...raw, 'ROLL.FORCE.ACTUAL': engineeringConfig.forceLimits.trip })
  assert.equal(store().state.communication.stale, false)
  assert.ok(alarms().active.some((alarm) => alarm.id === 'HIGH_ROLLING_FORCE'))
  const received = store().state.communication.framesReceived
  socket.onerror?.()
  assert.equal(store().state.communication.stale, true)
  assert.equal(store().tags['MILL.SPEED.ACTUAL'].quality, 'STALE')
  assert.ok(alarms().active.some((alarm) => alarm.id === 'COMMUNICATION_LOST'))
  assert.ok(alarms().active.some((alarm) => alarm.id === 'HIGH_ROLLING_FORCE'))
  now += 1
  socket.send(raw)
  assert.equal(store().state.communication.stale, false)
  assert.equal(store().state.communication.framesReceived, received + 1)
  assert.ok(!alarms().active.some((alarm) => alarm.id === 'HIGH_ROLLING_FORCE'))

  const state = store().state
  const moving = {
    ...state,
    machineStatus: 'FAST_STOP' as const,
    speed: { ...state.speed, actual: 100 },
    rolls: { ...state.rolls, upperWork: { ...state.rolls.upperWork, rpm: 100 } },
  }
  const twin = new TwinEngine(moving)
  assert.ok(twin.advance(0.1).wrAngle > 0, 'fast-stop ramp still animates')
  const angle = twin.visuals.wrAngle
  twin.setState({ ...moving, speed: { ...moving.speed, actual: 0 } })
  assert.equal(twin.advance(0.1).wrAngle, angle, 'standstill stops rotation')
  twin.setState({ ...moving, communication: { ...moving.communication, stale: true } })
  assert.equal(twin.advance(0.1).wrAngle, angle, 'stale feed freezes rotation')

  await store().disconnect()
  assert.equal(store().sourceReady, false)
  assert.equal(intervals.size, 0)
  socket.send(raw)
  assert.equal(store().state.communication.framesReceived, received + 1, 'late socket cannot publish')

  const abandoned = store().connect('SIMULATION')
  await store().disconnect()
  await abandoned
  assert.equal(store().sourceReady, false, 'disconnect cancels pending connect')
  assert.equal(intervals.size, 0)
  await Promise.all([store().connect('SIMULATION'), store().connect('SIM_46TAG')])
  tick(engineeringConfig.simulationTickMs)
  assert.equal(store().state.operatingMode, 'SIM_46TAG')
  assert.equal(intervals.size, 2, 'only one source timer and watchdog survive')
  console.log('STORE CHECKS PASSED: freshness, alarms, session isolation, lifecycle and fast-stop animation')
} finally {
  await store().disconnect()
  globalThis.setInterval = originalInterval
  globalThis.clearInterval = originalClearInterval
  globalThis.WebSocket = originalWebSocket
  Date.now = originalNow
}
