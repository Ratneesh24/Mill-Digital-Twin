import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * REEL PANEL — DTR / ETR / POR (§11.4).
 *
 *   DTR / ETR : tension, diameter, length, torque, current, thickness, brake,
 *               gauge ready
 *   POR       : tension, diameter, layers, length, torque, current, brake
 *
 * The ROLE chip is the important part. DTR is not "the entry reel" — it is the
 * entry reel *when the mill is running forward*. The chip is computed from the
 * rolling direction and flips on every reversal (§1).
 */
import { useMachineStore } from '../../store/machineStore';
import { Panel } from '../common/Panel';
import { ReadoutRow } from '../common/ValueReadout';
const ROLE_STYLE = {
    PAYOFF: 'border-normal/50 text-normal bg-normal/10',
    TENSION: 'border-warning/50 text-warning bg-warning/10',
    IDLE: 'border-line text-text-faint',
};
const ROLE_LABEL = {
    PAYOFF: 'PAYOFF · ENTRY',
    TENSION: 'WINDING · EXIT',
    IDLE: 'IDLE',
};
function ReelBlock({ reel }) {
    const state = useMachineStore((s) => reel === 'DTR' ? s.state.tension.dtr : reel === 'ETR' ? s.state.tension.etr : s.state.tension.por);
    const gaugeReady = useMachineStore((s) => reel === 'DTR' ? s.state.gauges.dtr.ready : reel === 'ETR' ? s.state.gauges.etr.ready : null);
    const isPor = reel === 'POR';
    return (_jsxs("div", { className: "border-line not-last:mb-2 not-last:border-b not-last:pb-2", children: [_jsxs("div", { className: "mb-1 flex items-center justify-between gap-2", children: [_jsx("span", { className: "num text-text text-meta font-semibold tracking-[0.1em]", children: reel }), _jsx("span", { className: `border px-1.5 text-micro leading-[15px] tracking-wider ${ROLE_STYLE[state.role]}`, children: isPor ? 'PARKED' : ROLE_LABEL[state.role] })] }), _jsx(ReadoutRow, { label: "Tension", tagName: `${reel}.TENSION`, decimals: 1 }), _jsx(ReadoutRow, { label: "Diameter", tagName: `${reel}.DIAMETER`, decimals: 0 }), _jsx(ReadoutRow, { label: "Length", tagName: `${reel}.LENGTH`, decimals: 0 }), _jsx(ReadoutRow, { label: "Torque", tagName: `${reel}.TORQUE`, decimals: 1 }), _jsx(ReadoutRow, { label: "Current", tagName: `${reel}.CURRENT`, decimals: 0 }), _jsx(ReadoutRow, { label: "Speed", tagName: `${reel}.RPM`, decimals: 1 }), isPor ? (_jsx(ReadoutRow, { label: "Layers", tagName: "POR.LAYERS", decimals: 0 })) : (_jsx(ReadoutRow, { label: "Thickness", tagName: `${reel}.THICKNESS`, decimals: 3 })), _jsxs("div", { className: "mt-1 flex items-center gap-2", children: [_jsx("span", { className: "label", children: "BRAKE" }), state.brake === null ? (_jsx("span", { className: "text-prov-notag border-prov-notag/60 border border-dashed px-1 text-micro leading-[14px]", children: "NO TAG" })) : (_jsx("span", { className: `border px-1 text-micro leading-[14px] tracking-wider ${state.brake === 'APPLIED'
                            ? 'border-warning/50 text-warning bg-warning/10'
                            : 'border-healthy/40 text-healthy bg-healthy/10'}`, children: state.brake })), !isPor && (_jsxs(_Fragment, { children: [_jsx("span", { className: "label ml-2", children: "GAUGE" }), gaugeReady === null ? (_jsx("span", { className: "text-prov-notag border-prov-notag/60 border border-dashed px-1 text-micro leading-[14px]", children: "NO TAG" })) : (_jsx("span", { className: `border px-1 text-micro leading-[14px] tracking-wider ${gaugeReady
                                    ? 'border-healthy/40 text-healthy bg-healthy/10'
                                    : 'border-alarm/50 text-alarm bg-alarm/10'}`, children: gaugeReady ? 'READY' : 'NOT READY' }))] }))] })] }));
}
export function ReelPanel() {
    return (_jsxs(Panel, { title: "Reels \u00B7 DTR / ETR / POR", children: [_jsx(ReelBlock, { reel: "DTR" }), _jsx(ReelBlock, { reel: "ETR" }), _jsx(ReelBlock, { reel: "POR" })] }));
}
