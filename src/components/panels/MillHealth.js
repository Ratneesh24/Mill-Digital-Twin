import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MILL HEALTH — auxiliary media, drive loading and roll data (§11.4).
 *
 *   "LP system, HP loading, HP bending, roll coolant, lubrication, exhaust,
 *    hydraulics → HEALTHY / WARNING / FAULT"
 *
 * On the 46-tag CRM04 feed none of the media status words exist, so this whole
 * panel degrades to NO TAG. That is the honest outcome and it is deliberately
 * visible: it tells the automation team exactly what the twin is missing.
 */
import { engineeringConfig } from '../../config/engineeringConfig';
import { millConfig } from '../../config/millConfig';
import { calculateUtilisation } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { HealthPill, Panel, UtilisationBar } from '../common/Panel';
import { DerivedRow, ReadoutRow } from '../common/ValueReadout';
const MEDIA = [
    ['lpSystem', 'LP system'],
    ['hpLoading', 'HP loading'],
    ['hpBending', 'HP bending'],
    ['coolant', 'Roll coolant'],
    ['lubrication', 'Lubrication'],
    ['exhaust', 'Exhaust'],
];
export function MillHealth() {
    const state = useMachineStore((s) => s.state);
    const utilisation = calculateUtilisation(state);
    const { forceLimits, motorLimits } = engineeringConfig;
    // Coolant is per-mill (§2): CRM04 runs Bamerol Aquarol 411B, CRM06 runs
    // Servosteeroll C105. Indexed off the configured mill so it follows the config.
    const coolantName = millConfig.media[millConfig.identity.mill].coolant;
    return (_jsxs(Panel, { title: "Mill health", children: [_jsx(UtilisationBar, { label: "Roll force", value: utilisation.force, warningAt: (forceLimits.warning / millConfig.ratings.maxRollingForce) * 100, alarmAt: (forceLimits.alarm / millConfig.ratings.maxRollingForce) * 100 }), _jsx("div", { className: "h-1.5" }), _jsx(UtilisationBar, { label: "Drive torque", value: utilisation.torque, warningAt: 90, alarmAt: 100 }), _jsx("div", { className: "h-1.5" }), _jsx(UtilisationBar, { label: "Drive current", value: utilisation.current, warningAt: 90, alarmAt: 100 }), _jsxs("div", { className: "border-line mt-2 border-t pt-1.5", children: [_jsx(ReadoutRow, { label: "Drive torque", tagName: "DRIVE.TORQUE", decimals: 1 }), _jsx(ReadoutRow, { label: "Drive current", tagName: "DRIVE.CURRENT", decimals: 0 }), _jsx(ReadoutRow, { label: "Drive power", tagName: "DRIVE.POWER", decimals: 0 }), _jsx(ReadoutRow, { label: "Drive speed", tagName: "DRIVE.RPM", decimals: 0 }), _jsx(DerivedRow, { label: "Drive rating", value: millConfig.ratings.mainDriveRating.toFixed(0), unit: "kW", tone: "dim", title: "UNVERIFIED placeholder \u2014 see Plant Config" }), _jsx(DerivedRow, { label: "Current rating", value: motorLimits.currentMax.toFixed(0), unit: "A", tone: "dim" })] }), _jsxs("div", { className: "border-line mt-2 border-t pt-1.5", children: [_jsx("div", { className: "label mb-1", children: "HYDRAULICS" }), _jsx(ReadoutRow, { label: "HAGC loading pressure", tagName: "HYD.LOADING.PRESSURE", decimals: 0 }), _jsx(ReadoutRow, { label: "Bending pressure", tagName: "HYD.BENDING.PRESSURE", decimals: 0 }), _jsx(ReadoutRow, { label: "Capsule position", tagName: "HYD.GAP.POSITION", decimals: 3 }), _jsx(ReadoutRow, { label: "LP pressure", tagName: "LP.PRESSURE", decimals: 1 })] }), _jsxs("div", { className: "border-line mt-2 border-t pt-1.5", children: [_jsxs("div", { className: "label mb-1", children: ["MEDIA \u00B7 ", coolantName] }), _jsx("div", { className: "grid grid-cols-2 gap-x-3 gap-y-1", children: MEDIA.map(([key, label]) => (_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "label truncate", children: label }), _jsx(HealthPill, { health: state.auxiliarySystems[key] })] }, key))) })] }), _jsxs("div", { className: "border-line mt-2 border-t pt-1.5", children: [_jsx("div", { className: "label mb-1", children: "ROLLS" }), _jsx(DerivedRow, { label: "WR diameter (design)", value: state.rolls.upperWork.diameter.toFixed(0), unit: "mm", tone: "dim", title: "From millConfig \u2014 UNVERIFIED placeholder, drives both the physics and the 3D scene" }), _jsx(ReadoutRow, { label: "WR diameter (roll shop)", tagName: "WR.TOP.DIAMETER", decimals: 1 }), _jsx(DerivedRow, { label: "BUR diameter (design)", value: state.rolls.upperBackup.diameter.toFixed(0), unit: "mm", tone: "dim" }), _jsx(ReadoutRow, { label: "Upper WR speed", tagName: "WR.TOP.RPM", decimals: 0 }), _jsx(ReadoutRow, { label: "Upper WR bending", tagName: "WR.TOP.BENDING", decimals: 0 }), _jsxs("div", { className: "flex items-baseline justify-between gap-3 py-[3px]", children: [_jsx("span", { className: "label", children: "Rolled length since change" }), _jsx("span", { className: "text-prov-notag border-prov-notag/60 border border-dashed px-1 text-micro leading-[14px]", children: "NO TAG \u00B7 PHASE 4" })] })] })] }));
}
