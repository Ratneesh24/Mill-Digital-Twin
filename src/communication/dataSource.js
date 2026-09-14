/**
 * DATA SOURCE ABSTRACTION — §14.1 of the master spec.
 *
 * "The UI must not know where data originates."
 *
 * Every source — simulation, WebSocket gateway, OPC-UA, historian replay —
 * implements this one interface and emits the same normalised TagFrame. Swapping
 * the source is a one-line change in the provider; no component is aware that
 * anything changed.
 */
/**
 * Shared connection-listener plumbing. Every concrete source extends this so
 * connection reporting behaves identically regardless of transport.
 */
export class BaseDataSource {
    dataListeners = new Set();
    connectionListeners = new Set();
    info;
    constructor(nominalRateHz, sourceName) {
        this.info = { status: 'DISCONNECTED', sourceName, nominalRateHz };
    }
    subscribe(_tags, callback) {
        this.dataListeners.add(callback);
        return () => this.dataListeners.delete(callback);
    }
    onConnectionChange(listener) {
        this.connectionListeners.add(listener);
        listener(this.info);
        return () => this.connectionListeners.delete(listener);
    }
    getConnectionInfo() {
        return this.info;
    }
    emit(frame) {
        for (const listener of this.dataListeners)
            listener(frame);
    }
    setConnection(patch) {
        this.info = { ...this.info, ...patch };
        for (const listener of this.connectionListeners)
            listener(this.info);
    }
}
