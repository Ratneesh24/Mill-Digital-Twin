/**
 * FIXED-CAPACITY RING BUFFER — §12 / §15.
 *
 * "Rolling buffers only. Never unbounded append."
 *
 * This is a 24/7 control-room application: a naive array append would grow
 * without limit and eventually take the browser tab down. Capacity is fixed at
 * construction and backed by typed arrays, so memory is allocated once and never
 * grows, no matter how many days the screen stays up.
 */

import type { TelemetryPoint } from '../types/telemetry'

export class RingBuffer {
  private readonly times: Float64Array
  private readonly values: Float64Array
  /** Index where the next sample will be written. */
  private head = 0
  private count = 0

  constructor(readonly capacity: number) {
    this.times = new Float64Array(capacity)
    this.values = new Float64Array(capacity)
  }

  get length(): number {
    return this.count
  }

  push(timestamp: number, value: number): void {
    this.times[this.head] = timestamp
    this.values[this.head] = value
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  /** Oldest-first snapshot. Allocates — call it at chart refresh rate, not per frame. */
  toArray(): TelemetryPoint[] {
    const out: TelemetryPoint[] = new Array(this.count)
    const start = this.count === this.capacity ? this.head : 0
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity
      out[i] = { timestamp: this.times[idx], value: this.values[idx] }
    }
    return out
  }

  latest(): TelemetryPoint | null {
    if (this.count === 0) return null
    const idx = (this.head - 1 + this.capacity) % this.capacity
    return { timestamp: this.times[idx], value: this.values[idx] }
  }

  /** Min/max over the buffer — used to scale a chart axis without a full copy. */
  extent(): { min: number; max: number } | null {
    if (this.count === 0) return null
    let min = Infinity
    let max = -Infinity
    const start = this.count === this.capacity ? this.head : 0
    for (let i = 0; i < this.count; i++) {
      const v = this.values[(start + i) % this.capacity]
      if (v < min) min = v
      if (v > max) max = v
    }
    return { min, max }
  }

  clear(): void {
    this.head = 0
    this.count = 0
  }
}

/**
 * Bounded event/alarm log. Same contract as the ring buffer but for objects:
 * keeps the newest N and discards the rest, so the event timeline cannot grow
 * without bound either (§15).
 */
export class BoundedLog<T> {
  private items: T[] = []

  constructor(readonly capacity: number) {}

  /** Newest first. */
  push(item: T): void {
    this.items.unshift(item)
    if (this.items.length > this.capacity) this.items.length = this.capacity
  }

  toArray(): T[] {
    return this.items.slice()
  }

  get length(): number {
    return this.items.length
  }

  clear(): void {
    this.items = []
  }
}
