/**
 * SIMULATION DATA SOURCE — §14.1.
 *
 * Drives the SimulationEngine on a fixed tick and publishes normalised tag
 * frames exactly the way the real gateway will. The engine has no idea it is
 * being displayed; the UI has no idea it is being simulated.
 *
 * Two modes share this source:
 *   SIMULATION  — full 74-tag model, everything badged SIM
 *   SIM_46TAG   — same numbers, presented with the provenance they will carry
 *                 on the real CRM04 46-tag feed (§7.4)
 * The mode only affects `makeTag`; the physics is identical, which is what makes
 * SIM_46TAG a genuine rehearsal rather than a different simulation.
 */
import { engineeringConfig } from '../config/engineeringConfig';
import { makeTag } from '../data/tagMap';
import { SimulationEngine } from '../simulation/simulationEngine';
import { BaseDataSource } from './dataSource';
export class SimulationDataSource extends BaseDataSource {
    id = 'simulation';
    name;
    mode;
    engine = new SimulationEngine();
    timer = null;
    lastTickMs = 0;
    constructor(mode = 'SIMULATION') {
        super(1000 / engineeringConfig.simulationTickMs, modeName(mode));
        this.mode = mode;
        this.name = modeName(mode);
    }
    async connect() {
        if (this.timer)
            return;
        this.setConnection({ status: 'CONNECTING' });
        this.lastTickMs = performance.now();
        this.timer = setInterval(() => this.tick(), engineeringConfig.simulationTickMs);
        this.setConnection({ status: 'CONNECTED' });
    }
    async disconnect() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.setConnection({ status: 'DISCONNECTED' });
    }
    command(cmd) {
        this.engine.command(cmd);
    }
    getDiagnostics() {
        return this.engine.getDiagnostics();
    }
    tick() {
        const now = performance.now();
        const dt = (now - this.lastTickMs) / 1000;
        this.lastTickMs = now;
        const raw = this.engine.tick(dt);
        // COMMUNICATION_LOSS scenario: the simulated PLC stops publishing. We do NOT
        // emit a frame with stale values — we emit nothing at all, exactly like a
        // dead link, and let the staleness watchdog in the store notice (§14.5).
        if (!this.engine.isPublishing()) {
            if (this.info.status === 'CONNECTED') {
                this.setConnection({ status: 'ERROR', error: 'Simulated PLC link lost' });
            }
            return;
        }
        if (this.info.status !== 'CONNECTED') {
            this.setConnection({ status: 'CONNECTED', error: undefined });
        }
        // Timestamp is taken from the wall clock because that is what a gateway
        // stamps frames with; the physics itself never reads the clock.
        const timestamp = Date.now();
        const tags = {};
        for (const [tagName, value] of Object.entries(raw)) {
            tags[tagName] = makeTag(tagName, value, { timestamp, mode: this.mode });
        }
        this.emit({ timestamp, tags });
    }
}
function modeName(mode) {
    return mode === 'SIM_46TAG'
        ? 'SIMULATION — CRM04 46-tag profile'
        : 'SIMULATION — full 74-tag model';
}
