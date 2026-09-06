/** Deterministic ingress/lifecycle checks. No browser or external connection. */
import assert from 'node:assert/strict'
import { WebSocketDataSource } from '../src/communication/websocketClient'
import type { DataFrameEnvelope } from '../src/communication/dataSource'
import { tagDefinitions } from '../src/data/tagDefinitions'
import { SimulationEngine } from '../src/simulation/simulationEngine'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static failConstruction = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  closeCalls = 0

  constructor(readonly url: string) {
    if (MockWebSocket.failConstruction) throw new Error('Mock construction failure')
    MockWebSocket.instances.push(this)
  }
  close(): void {
    this.closeCalls++
    this.onclose?.() // Deliberately synchronous to stress disconnect ordering.
  }
  send(data: unknown): void {
    this.onmessage?.({ data })
  }
}

const originalSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
const originalNow = Date.now
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const now = 1_800_000_000_000
const timers = new Map<number, { callback: () => void; delay: number }>()
let timerId = 0
let accepted = 0
let rejected = 0
const sources: WebSocketDataSource[] = []

const raw = new SimulationEngine().tick(0.1)
const snapshot: Record<string, unknown> = Object.fromEntries(tagDefinitions.map((def) => [
  def.tagName, def.liveAvailability === 'UNAVAILABLE' ? null : raw[def.tagName],
]))
// Nullable projection inputs and tags not read by numOr need not be sent.
const optionalAvailable = new Set([
  'MILL.SPEED.ENTRY', 'MILL.STATUS.REASON', 'COIL.ID',
  'DTR.THICKNESS', 'ETR.THICKNESS', 'POR.LAYERS',
  'DTR.STATUS', 'ETR.STATUS', 'POR.STATUS', 'GAUGE.DTR.THICKNESS', 'GAUGE.ETR.THICKNESS',
])
const minimal = Object.fromEntries(tagDefinitions
  .filter((def) => def.liveAvailability !== 'UNAVAILABLE' && !optionalAvailable.has(def.tagName))
  .map((def) => [def.tagName, snapshot[def.tagName]]))

function setup() {
  const source = new WebSocketDataSource({ url: 'ws://mock.invalid', maxBackoffMs: 2500 })
  sources.push(source)
  const frames: DataFrameEnvelope[] = []
  source.subscribe([], (frame) => frames.push(frame))
  void source.connect()
  const socket = MockWebSocket.instances.at(-1)!
  socket.onopen?.()
  return { source, socket, frames }
}

function runTimer(delay: number): () => void {
  assert.equal(timers.size, 1, 'exactly one reconnect timer')
  const [id, timer] = [...timers][0]
  assert.equal(timer.delay, delay)
  timers.delete(id)
  timer.callback()
  return timer.callback
}

try {
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: MockWebSocket })
  Date.now = () => now
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++timerId, { callback, delay })
    return timerId
  }) as unknown as typeof setTimeout
  globalThis.clearTimeout = ((id: number) => { timers.delete(id) }) as unknown as typeof clearTimeout

  const { source, socket, frames } = setup()
  let connectionNotifications = 0
  source.onConnectionChange(() => { connectionNotifications++ })
  let timestamp = now - 100_000
  function accept(tags = snapshot, stamped = ++timestamp): void {
    const before = frames.length
    socket.send(JSON.stringify({ timestamp: stamped, tags }))
    assert.equal(frames.length, before + 1, source.getConnectionInfo().error)
    assert.equal(frames.at(-1)!.timestamp, stamped, 'preserve source timestamp')
    assert.equal(source.getConnectionInfo().status, 'CONNECTED')
    assert.equal(source.getConnectionInfo().error, undefined, 'recovery clears error')
    accepted++
  }
  function reject(data: unknown, label: string): void {
    const before = frames.length
    socket.send(data)
    assert.equal(frames.length, before, label)
    assert.equal(source.getConnectionInfo().status, 'ERROR', label)
    assert.ok(source.getConnectionInfo().error, label)
    assert.equal(timers.size, 0, 'validation errors do not reconnect')
    rejected++
    accept() // Every rejection must allow a subsequent valid frame.
  }

  accept()
  for (const def of tagDefinitions.filter((d) => d.liveAvailability === 'UNAVAILABLE')) {
    const tag = frames.at(-1)!.tags[def.tagName]
    assert.equal(tag.value, null, def.tagName)
    assert.equal(tag.quality, 'NO_TAG', def.tagName)
    assert.equal(tag.provenance, 'UNAVAILABLE', def.tagName)
  }
  assert.equal(frames.at(-1)!.tags['ROLL.FORCE.ACTUAL'].provenance, 'ESTIMATED')
  assert.equal(frames.at(-1)!.tags['ROLL.GAP.ACTUAL'].provenance, 'CALCULATED')
  accept(minimal)
  accept({ ...minimal, 'UNKNOWN.TAG': { ignored: true } })
  assert.equal(frames.at(-1)!.tags['UNKNOWN.TAG'], undefined)
  assert.equal(connectionNotifications, 1, 'valid frames do not repeat connection notifications')

  for (const data of ['{', 'null', '[]', '1', 'true', '"text"', '{}',
    '{"tags":null}', '{"tags":[]}', '{"tags":"bad"}', '{"tags":1}',
    '{"timestamp":1800000000000}', new ArrayBuffer(8), { tags: snapshot }]) {
    reject(data, 'invalid envelope/text')
  }
  for (const stamp of [undefined, null, '1800000000000', true, {}, [], now - 3_600_001, now + 60_001]) {
    reject(JSON.stringify({ timestamp: stamp, tags: snapshot }), `invalid timestamp ${String(stamp)}`)
  }
  // JSON.stringify would turn Infinity into null; overflow is valid JSON syntax.
  for (const stamp of ['1e400', '-1e400', 'NaN', 'Infinity']) {
    reject(`{"timestamp":${stamp},"tags":${JSON.stringify(snapshot)}}`, 'nonfinite timestamp')
  }
  reject(JSON.stringify({ timestamp, tags: snapshot }), 'replay')
  reject(JSON.stringify({ timestamp: timestamp - 10, tags: snapshot }), 'out of order')
  for (const tags of [{}, { UNKNOWN: 1 }, { 'MILL.SPEED.ACTUAL': 1 }]) {
    reject(JSON.stringify({ timestamp: now, tags }), 'empty/unknown/sparse tags')
  }
  for (const name of Object.keys(minimal)) {
    const tags = { ...minimal }
    delete tags[name]
    reject(JSON.stringify({ timestamp: now, tags }), `missing required ${name}`)
  }
  for (const def of tagDefinitions) {
    for (const value of [{ value: 1 }, [], ...(def.liveAvailability === 'UNAVAILABLE' ? [] : [null])]) {
      reject(JSON.stringify({ timestamp: now, tags: { ...snapshot, [def.tagName]: value } }),
        `invalid value ${def.tagName}` + String(value))
    }
  }

  for (const def of tagDefinitions.filter((d) => d.unit !== undefined || d.decimals !== undefined)) {
    for (const value of ['123', true, {}, []]) {
      reject(JSON.stringify({ timestamp: now, tags: { ...snapshot, [def.tagName]: value } }),
        `numeric type ${def.tagName}`)
    }
    const tags = JSON.stringify({ ...snapshot, [def.tagName]: '__OVERFLOW__' }).replace('"__OVERFLOW__"', '1e400')
    reject(`{"timestamp":${now},"tags":${tags}}`, `nonfinite value ${def.tagName}`)
  }
  for (const [name, value] of [
    ['MILL.STATUS', 'RUNNING'], ['MILL.DIRECTION', 'SIDEWAYS'], ['MILL.STATUS', 1],
    ['DTR.STATUS', 'ON'], ['ETR.ROLE', 'ENTRY'], ['POR.BRAKE', 'ON'],
    ['LP.STATUS', 'ON'], ['AGC.STATUS', 'HEALTHY'], ['DRIVE.READY', 'true'],
    ['FAST.STOP', 1], ['COIL.ID', 42], ['COIL.GRADE', false], ['MILL.STATUS.REASON', 1],
  ]) {
    reject(JSON.stringify({ timestamp: now, tags: { ...snapshot, [name as string]: value } }),
      `invalid enum/type ${name}`)
  }
  for (const status of ['IDLE', 'READY', 'THREADING', 'ROLLING', 'DECELERATING', 'REVERSING',
    'STOPPED', 'FAST_STOP', 'WARMUP', 'SKIN_PASS', 'REWIND', 'ROLL_CHANGE', 'FAULT']) {
    accept({ ...snapshot, 'MILL.STATUS': status, 'MILL.DIRECTION': 'REVERSE' })
  }
  accept({ ...snapshot, 'DRIVE.READY': true, 'FAST.STOP': false, 'LP.STATUS': 'HEALTHY',
    'AGC.STATUS': 'ON', 'POR.BRAKE': 'APPLIED', 'DTR.STATUS': 'RUNNING' })
  await source.disconnect()

  // Timestamp-window boundaries are inclusive, and only accepted frames advance the watermark.
  const boundary = setup()
  for (const stamp of [now - 3_600_000, now + 60_000]) {
    boundary.socket.send(JSON.stringify({ timestamp: stamp, tags: minimal }))
    assert.equal(boundary.frames.at(-1)!.timestamp, stamp)
  }
  await boundary.source.disconnect()

  const life = setup()
  const frame = (stamp: number) => JSON.stringify({ timestamp: stamp, tags: minimal })
  life.socket.send(frame(now))
  const count = MockWebSocket.instances.length
  await life.source.connect()
  assert.equal(MockWebSocket.instances.length, count, 'connect is idempotent')
  life.socket.onerror?.()
  life.socket.send(frame(now + 1))
  assert.equal(life.source.getConnectionInfo().status, 'CONNECTED', 'socket error recovery')
  life.socket.onclose?.()
  const retry = runTimer(1000)
  const replacement = MockWebSocket.instances.at(-1)!
  replacement.onopen?.()
  const before = life.frames.length
  function lateCallbacks(): void {
    life.socket.onopen?.()
    life.socket.send(frame(now + 50))
    life.socket.onerror?.()
    life.socket.onclose?.()
  }
  lateCallbacks()
  assert.equal(life.frames.length, before, 'old socket cannot publish after reconnect')
  assert.equal(life.source.getConnectionInfo().status, 'CONNECTED')
  assert.equal(timers.size, 0)
  replacement.send(frame(now + 1))
  assert.equal(life.frames.length, before, 'reconnect retains replay watermark')
  replacement.send(frame(now + 2))
  assert.equal(life.frames.length, before + 1, 'new socket recovers')
  await life.source.disconnect()
  replacement.onopen?.()
  replacement.send(frame(now + 3))
  replacement.onerror?.()
  replacement.onclose?.()
  retry() // A canceled/queued retry from a previous generation is harmless.
  assert.equal(life.frames.length, before + 1)
  assert.equal(life.source.getConnectionInfo().status, 'DISCONNECTED')
  assert.equal(timers.size, 0)
  await life.source.connect()
  const restarted = MockWebSocket.instances.at(-1)!
  restarted.onopen?.()
  lateCallbacks()
  restarted.send(frame(now + 2))
  assert.equal(life.frames.length, before + 1, 'explicit reconnect retains watermark')
  restarted.send(frame(now + 3))
  assert.equal(life.frames.length, before + 2)
  restarted.onclose?.()
  const queued = [...timers.values()][0].callback
  await life.source.disconnect()
  const socketCount = MockWebSocket.instances.length
  queued()
  assert.equal(MockWebSocket.instances.length, socketCount, 'disconnect cancels retry')
  assert.equal(timers.size, 0)

  MockWebSocket.failConstruction = true
  const failed = new WebSocketDataSource({ url: 'ws://mock.invalid', maxBackoffMs: 2500 })
  sources.push(failed)
  await failed.connect()
  assert.equal(failed.getConnectionInfo().status, 'ERROR')
  runTimer(1000)
  runTimer(2000)
  runTimer(2500)
  MockWebSocket.failConstruction = false
  runTimer(2500)
  MockWebSocket.instances.at(-1)!.onopen?.()
  assert.equal(failed.getConnectionInfo().status, 'CONNECTED')
  await failed.disconnect()

  // A connection listener can synchronously switch sources during recovery.
  const switched = setup()
  switched.socket.send('null')
  switched.source.onConnectionChange((info) => {
    if (info.status === 'CONNECTED') void switched.source.disconnect()
  })
  switched.socket.send(frame(now))
  assert.equal(switched.frames.length, 0, 'disconnect during recovery prevents emission')
  assert.equal(timers.size, 0)
  console.log(`Gateway checks passed: ${accepted} accepted, ${rejected} rejected with recovery; boundaries and lifecycle passed. No network used.`)
} finally {
  for (const source of sources) await source.disconnect()
  Date.now = originalNow
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  if (originalSocket) Object.defineProperty(globalThis, 'WebSocket', originalSocket)
  else Reflect.deleteProperty(globalThis, 'WebSocket')
}
