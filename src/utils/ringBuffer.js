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
export class RingBuffer {
    capacity;
    times;
    values;
    /** Index where the next sample will be written. */
    head = 0;
    count = 0;
    constructor(capacity) {
        this.capacity = capacity;
        this.times = new Float64Array(capacity);
        this.values = new Float64Array(capacity);
    }
    get length() {
        return this.count;
    }
    push(timestamp, value) {
        this.times[this.head] = timestamp;
        this.values[this.head] = value;
        this.head = (this.head + 1) % this.capacity;
        if (this.count < this.capacity)
            this.count++;
    }
    /** Oldest-first snapshot. Allocates — call it at chart refresh rate, not per frame. */
    toArray() {
        const out = new Array(this.count);
        const start = this.count === this.capacity ? this.head : 0;
        for (let i = 0; i < this.count; i++) {
            const idx = (start + i) % this.capacity;
            out[i] = { timestamp: this.times[idx], value: this.values[idx] };
        }
        return out;
    }
    latest() {
        if (this.count === 0)
            return null;
        const idx = (this.head - 1 + this.capacity) % this.capacity;
        return { timestamp: this.times[idx], value: this.values[idx] };
    }
    /** Min/max over the buffer — used to scale a chart axis without a full copy. */
    extent() {
        if (this.count === 0)
            return null;
        let min = Infinity;
        let max = -Infinity;
        const start = this.count === this.capacity ? this.head : 0;
        for (let i = 0; i < this.count; i++) {
            const v = this.values[(start + i) % this.capacity];
            if (v < min)
                min = v;
            if (v > max)
                max = v;
        }
        return { min, max };
    }
    clear() {
        this.head = 0;
        this.count = 0;
    }
}
/**
 * Bounded event/alarm log. Same contract as the ring buffer but for objects:
 * keeps the newest N and discards the rest, so the event timeline cannot grow
 * without bound either (§15).
 */
export class BoundedLog {
    capacity;
    items = [];
    constructor(capacity) {
        this.capacity = capacity;
    }
    /** Newest first. */
    push(item) {
        this.items.unshift(item);
        if (this.items.length > this.capacity)
            this.items.length = this.capacity;
    }
    toArray() {
        return this.items.slice();
    }
    get length() {
        return this.items.length;
    }
    clear() {
        this.items = [];
    }
}
