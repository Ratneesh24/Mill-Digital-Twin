import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * INTERLOCK PANEL — §13.2.
 *
 *   DRIVE ✓ → HYDRAULIC ✓ → TENSION ✓ → GAUGE ✓ → MILL READY ✓
 *
 * "On failure, NAME THE CAUSE:
 *      MILL NOT READY
 *      Reason: ETR GAUGE NOT READY
 *  Never display a bare 'MILL NOT READY'."
 *
 * The reason line is not optional in this component — `interlockReadout` always
 * returns one when the chain is broken, and the chain always identifies its
 * first failing link.
 */
import { interlockReadout } from '../../machine/interlockEngine';
import { useMachineStore, selectInterlockChain } from '../../store/machineStore';
import { Panel } from '../common/Panel';
export function InterlockStatus() {
    const chain = useMachineStore(selectInterlockChain);
    const readout = interlockReadout(chain);
    return (_jsxs(Panel, { title: "Mill interlock", children: [_jsxs("div", { className: `mb-2 border px-2.5 py-2 ${chain.millReady
                    ? 'border-healthy/45 bg-healthy/10'
                    : readout.unverified
                        ? 'border-warning/55 bg-warning/10'
                        : 'border-alarm/60 bg-alarm/10'}`, children: [_jsx("div", { className: `text-body font-semibold tracking-[0.12em] ${chain.millReady
                            ? 'text-healthy'
                            : readout.unverified
                                ? 'text-warning'
                                : 'text-alarm alarm-pulse'}`, children: readout.title }), readout.reason && (_jsx("div", { className: `mt-0.5 text-meta tracking-wide ${readout.unverified ? 'text-warning' : 'text-alarm'}`, children: readout.reason }))] }), _jsx("div", { className: "space-y-[3px]", children: chain.nodes.map((node) => {
                    const noTag = node.reason.endsWith('NO TAG ON THIS FEED');
                    const isBlocking = node.reason !== '' && node.reason === chain.blockingReason;
                    return (_jsxs("div", { title: node.reason || undefined, className: `flex items-center justify-between gap-2 border-l-2 pl-2 ${node.ok
                            ? 'border-l-healthy/50'
                            : noTag
                                ? 'border-l-prov-notag'
                                : isBlocking
                                    ? 'border-l-alarm'
                                    : 'border-l-line'}`, children: [_jsx("span", { className: `label truncate ${isBlocking && !noTag ? 'text-alarm' : ''}`, children: node.label }), _jsx("span", { className: `text-micro tracking-wider ${node.ok
                                    ? 'text-healthy'
                                    : noTag
                                        ? 'text-prov-notag'
                                        : isBlocking
                                            ? 'text-alarm'
                                            : 'text-text-faint'}`, children: node.ok ? 'OK' : noTag ? 'NO TAG' : 'BLOCKED' })] }, node.id));
                }) })] }));
}
