/**
 * Telemetry hooks.
 *
 * Charts and sparklines pull snapshots on their OWN interval (§12: "Real-time
 * update, throttled independently of the 3D render loop"). They never subscribe
 * to the machine store, so a 20 Hz process feed cannot drive 20 Hz React
 * re-renders of nine chart series.
 */
import { useEffect, useState } from 'react';
import { engineeringConfig } from '../config/engineeringConfig';
import { telemetryStore } from '../store/telemetryStore';
/** One signal, one window, refreshed at the chart repaint rate. */
export function useTrend(signal, window) {
    const [points, setPoints] = useState(() => telemetryStore.read(signal, window));
    useEffect(() => {
        setPoints(telemetryStore.read(signal, window));
        const id = setInterval(() => setPoints(telemetryStore.read(signal, window)), engineeringConfig.chartRefreshMs);
        return () => clearInterval(id);
    }, [signal, window]);
    return points;
}
/** Several signals merged on timestamp, for a multi-series chart. */
export function useMergedTrend(signals, window) {
    // The array identity changes every render at the call site, so the effect keys
    // on the joined names instead.
    const key = signals.join('|');
    const [rows, setRows] = useState([]);
    useEffect(() => {
        const list = key ? key.split('|') : [];
        const pull = () => setRows(telemetryStore.readMerged(list, window));
        pull();
        const id = setInterval(pull, engineeringConfig.chartRefreshMs);
        return () => clearInterval(id);
    }, [key, window]);
    return rows;
}
