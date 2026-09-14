/**
 * WEBSOCKET DATA SOURCE — §14.2 / §14.3.
 *
 * Target path:
 *   PLC -> OPC-UA Server -> Industrial Edge Gateway -> Backend -> WebSocket -> Twin UI
 *
 * The browser NEVER connects directly to a plant PLC (§14.3). This client talks
 * to the backend only.
 *
 * Expected payload (§14.2):
 *   { "timestamp": 1756660000000,
 *     "tags": { "MILL.SPEED.ACTUAL": 175, "ROLL.GAP.ACTUAL": 2.000, ... } }
 *
 * Values and timestamps are validated, unknown tags are ignored
 * rather than displayed, and only then does MachineState update.
 */
import { makeTag } from '../data/tagMap';
import { getTagDefinition } from '../data/tagDefinitions';
import { BaseDataSource } from './dataSource';
// Every numOr input in dataAdapter, excluding nullable/unavailable instruments.
const requiredNumericTags = [
    'MILL.SPEED.REF', 'MILL.SPEED.ACTUAL', 'MILL.MASSFLOW.ERROR',
    'ROLL.GAP.ACTUAL', 'ROLL.FORCE.ACTUAL', 'ROLL.FORCE.REF',
    'STRIP.WIDTH', 'STRIP.THICKNESS', 'STRIP.THICKNESS.ENTRY',
    'STRIP.THICKNESS.REF', 'STRIP.THICKNESS.DEVIATION', 'STRIP.REDUCTION',
    'TENSION.ENTRY', 'TENSION.EXIT', 'TENSION.ENTRY.REF', 'TENSION.EXIT.REF',
    'COIL.LENGTH', 'COIL.REMAINING_LENGTH', 'COIL.DIAMETER',
    'PASS.NUMBER', 'PASS.TOTAL', 'PASS.PROGRESS',
    'DRIVE.TORQUE', 'DRIVE.CURRENT', 'DRIVE.POWER', 'DRIVE.RPM',
    ...['DTR', 'ETR', 'POR'].flatMap((reel) => ['TENSION', 'DIAMETER', 'LENGTH', 'TORQUE', 'CURRENT', 'RPM'].map((field) => `${reel}.${field}`)),
    'WR.TOP.RPM', 'WR.BOTTOM.RPM', 'BUR.TOP.RPM', 'BUR.BOTTOM.RPM',
];
const requiredTags = [...requiredNumericTags, 'MILL.STATUS', 'MILL.DIRECTION', 'DTR.ROLE', 'ETR.ROLE'];
const machineStatuses = [
    'IDLE', 'READY', 'THREADING', 'ROLLING', 'DECELERATING', 'REVERSING',
    'STOPPED', 'FAST_STOP', 'WARMUP', 'SKIN_PASS', 'REWIND', 'ROLL_CHANGE', 'FAULT',
];
export class WebSocketDataSource extends BaseDataSource {
    id = 'websocket';
    name;
    mode = 'LIVE';
    socket = null;
    url;
    maxBackoffMs;
    backoffMs = 1000;
    reconnectTimer = null;
    closedByUs = true;
    generation = 0;
    lastTimestamp = -Infinity;
    constructor({ url, nominalRateHz = 5, maxBackoffMs = 15000 }) {
        super(nominalRateHz, `LIVE — ${url}`);
        this.url = url;
        this.maxBackoffMs = maxBackoffMs;
        this.name = `LIVE — ${url}`;
    }
    async connect() {
        if (!this.closedByUs)
            return;
        this.closedByUs = false;
        this.backoffMs = 1000;
        this.open();
    }
    async disconnect() {
        this.closedByUs = true;
        this.generation++;
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        const socket = this.socket;
        this.socket = null;
        socket?.close();
        this.setConnection({ status: 'DISCONNECTED', error: undefined });
    }
    open() {
        if (this.closedByUs)
            return;
        const generation = this.generation;
        this.setConnection({ status: 'CONNECTING', error: undefined });
        if (this.closedByUs || generation !== this.generation)
            return;
        let socket;
        try {
            socket = new WebSocket(this.url);
            this.socket = socket;
        }
        catch (err) {
            this.handleFailure(err instanceof Error ? err.message : 'WebSocket construction failed');
            return;
        }
        const isCurrent = () => !this.closedByUs && generation === this.generation && this.socket === socket;
        socket.onopen = () => {
            if (!isCurrent())
                return;
            this.backoffMs = 1000;
            this.setConnection({ status: 'CONNECTED', error: undefined });
        };
        socket.onmessage = (event) => {
            if (!isCurrent())
                return;
            const frame = this.parseFrame(event.data);
            if (!frame || !isCurrent())
                return;
            this.lastTimestamp = frame.timestamp;
            if (this.info.status !== 'CONNECTED') {
                this.setConnection({ status: 'CONNECTED', error: undefined });
            }
            if (isCurrent())
                this.emit(frame);
        };
        socket.onerror = () => {
            if (!isCurrent())
                return;
            // The browser gives no detail on a WebSocket error by design; say so
            // rather than inventing a cause.
            this.setConnection({ status: 'ERROR', error: 'WebSocket error — see backend logs' });
        };
        socket.onclose = () => {
            if (!isCurrent())
                return;
            this.socket = null;
            this.handleFailure('Connection to edge gateway lost');
        };
    }
    handleFailure(message) {
        const generation = this.generation;
        this.setConnection({ status: 'ERROR', error: message });
        if (this.closedByUs || generation !== this.generation)
            return;
        // Exponential backoff, capped. Never hammer a plant gateway.
        this.reconnectTimer = setTimeout(() => {
            if (this.closedByUs || generation !== this.generation)
                return;
            this.reconnectTimer = null;
            this.open();
        }, this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    }
    /**
     * Parse and validate one wire frame.
     *
     * A frame is rejected outright — not partially displayed — when it is
     * malformed or its timestamp is unusable. Displaying half a frame is worse
     * than displaying none, because the operator cannot tell which half.
     */
    parseFrame(data) {
        const reject = (error) => {
            this.setConnection({ status: 'ERROR', error });
            return null;
        };
        if (typeof data !== 'string')
            return reject('Gateway frame must be JSON text');
        let payload;
        try {
            payload = JSON.parse(data);
        }
        catch {
            return reject('Malformed frame from gateway (not JSON)');
        }
        if (!isRecord(payload) || !isRecord(payload.tags)) {
            return reject('Gateway frame must contain a timestamp and tags object');
        }
        const now = Date.now();
        const timestamp = payload.timestamp;
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) ||
            timestamp > now + 60_000 || timestamp < now - 3_600_000) {
            return reject('Gateway timestamp must be finite epoch milliseconds within -1 hour / +1 minute');
        }
        if (timestamp <= this.lastTimestamp)
            return reject('Replayed or out-of-order gateway frame');
        const tags = {};
        for (const [tagName, raw] of Object.entries(payload.tags)) {
            if (!getTagDefinition(tagName))
                continue; // unknown tag: not displayed
            if (!validValue(tagName, raw))
                return reject(`Invalid gateway value for ${tagName}`);
            tags[tagName] = makeTag(tagName, raw, { timestamp, mode: this.mode });
        }
        if (Object.keys(tags).length === 0)
            return reject('Gateway frame contained no known tags');
        for (const tagName of requiredTags) {
            if (!tags[tagName] || tags[tagName].value === null) {
                return reject(`Incomplete gateway snapshot: missing ${tagName}`);
            }
        }
        return { timestamp, tags };
    }
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Strict wire types; no coercion of bad measurements into plausible values. */
function validValue(tagName, raw) {
    const def = getTagDefinition(tagName);
    if (raw === null)
        return def.liveAvailability === 'UNAVAILABLE';
    if (def.unit !== undefined || def.decimals !== undefined) {
        return typeof raw === 'number' && Number.isFinite(raw);
    }
    if (tagName.endsWith('.READY') || tagName.endsWith('.STOP') || tagName === 'MILL.INTERLOCK') {
        return typeof raw === 'boolean';
    }
    if (typeof raw !== 'string')
        return false;
    if (tagName === 'MILL.STATUS')
        return machineStatuses.includes(raw);
    if (tagName === 'MILL.DIRECTION')
        return raw === 'FORWARD' || raw === 'REVERSE';
    if (tagName.endsWith('.ROLE'))
        return ['PAYOFF', 'TENSION', 'IDLE'].includes(raw);
    if (tagName.endsWith('.BRAKE'))
        return ['APPLIED', 'RELEASED'].includes(raw);
    if (/^(DTR|ETR|POR)\.STATUS$/.test(tagName)) {
        return ['RUNNING', 'STOPPED', 'FAULT', 'UNKNOWN'].includes(raw);
    }
    if (/^(LP|HP\.LOADING|HP\.BENDING|COOLANT|LUBRICATION|EXHAUST)\.STATUS$/.test(tagName)) {
        return ['HEALTHY', 'WARNING', 'FAULT', 'OFF', 'UNKNOWN', 'NO_TAG'].includes(raw);
    }
    if (tagName.endsWith('.STATUS'))
        return ['ON', 'OFF', 'FAULT', 'UNKNOWN', 'NO_TAG'].includes(raw);
    return tagName === 'COIL.ID' || tagName === 'COIL.GRADE' || tagName === 'MILL.STATUS.REASON';
}
