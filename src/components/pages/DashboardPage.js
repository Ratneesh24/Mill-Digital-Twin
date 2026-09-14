import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * DASHBOARD — the primary operator screen.
 *
 * "What is happening RIGHT NOW?"
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ COIL · GRADE · WIDTH · PASS · DIRECTION · MILL STATE          │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ PRIMARY KPI RIBBON — thickness / rolling / shape / tension /  │
 *   │ drive / energy, each with actual, setpoint, deviation, status │
 *   ├───────────────────────────────────┬──────────────────────────┤
 *   │ PROCESS PARAMETERS (full set)     │ SYSTEM STATUS            │
 *   │                                   │ ALARMS & EVENTS          │
 *   ├───────────────────────────────────┴──────────────────────────┤
 *   │ PASS SCHEDULE          │ COIL INFORMATION │ 3D TWIN CARD      │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * No 3D model and no trend chart. The twin has its own page (reached by the
 * card at the bottom) and trends have theirs; keeping both off this screen is
 * what leaves room for the parameter depth an operator actually needs here.
 *
 * NO TAG IS EXPECTED. On the CRM04 46-tag extract the entire Work Roll & Shape
 * group, all hydraulics and most of System Status read NO TAG, because the
 * plant does not publish those values. Showing them greyed and labelled is the
 * §7.4 contract — a plausible-looking number would be worse than nothing.
 */
import { engineeringConfig } from '../../config/engineeringConfig';
import { millConfig } from '../../config/millConfig';
import { ArrowDownWideNarrow, Droplets, Gauge, Layers, Ruler, Settings2, Snowflake, UnfoldVertical, Zap, } from 'lucide-react';
import { specificEnergy, throughput } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { AlarmPanel } from '../panels/AlarmPanel';
import { CoilDetails } from '../panels/CoilDetails';
import { EventTimeline } from '../panels/EventTimeline';
import { ParameterGroup } from '../panels/ParameterGroup';
import { PassSchedulePanel } from '../panels/PassSchedulePanel';
import { SystemStatusBoard } from '../panels/SystemStatusBoard';
import { KpiTile, KpiSlot } from '../dashboard/KpiTile';
import { MillStatusHero } from '../dashboard/MillStatusHero';
import { OperatingContext } from '../dashboard/OperatingContext';
import { TwinLaunchCard } from '../dashboard/TwinLaunchCard';
const ACCENT = {
    thickness: 'var(--accent-thickness)',
    rolling: 'var(--accent-rolling)',
    workroll: 'var(--accent-workroll)',
    tension: 'var(--accent-tension)',
    drive: 'var(--accent-drive)',
    hydraulic: 'var(--accent-hydraulic)',
    energy: 'var(--accent-energy)',
    coil: 'var(--accent-coil)',
};
export function DashboardPage() {
    return (_jsxs(_Fragment, { children: [_jsx(OperatingContext, {}), _jsx(MillStatusHero, {}), _jsx(KpiRibbon, {}), _jsxs("div", { className: "dashboard-main grid min-h-0", children: [_jsx(ProcessParameters, {}), _jsxs("div", { className: "grid min-h-0 min-w-0 content-start gap-[14px]", children: [_jsx(SystemStatusBoard, {}), _jsx(AlarmPanel, {})] })] }), _jsxs("div", { className: "dashboard-lower grid", children: [_jsxs("div", { className: "grid min-h-0 min-w-0 content-start gap-[14px]", children: [_jsx(PassSchedulePanel, {}), _jsx(EventTimeline, {})] }), _jsxs("div", { className: "grid min-h-0 min-w-0 content-start gap-[14px]", children: [_jsx(CoilDetails, {}), _jsx(TwinLaunchCard, {})] })] })] }));
}
/* ── Primary KPIs ───────────────────────────────────────────────────────── */
function KpiRibbon() {
    return (_jsxs("div", { className: "kpi-ribbon", children: [_jsxs(KpiGroup, { title: "PRODUCT / THICKNESS", accent: ACCENT.thickness, children: [_jsx(KpiTile, { label: "EXIT THICKNESS", tagName: "STRIP.THICKNESS", decimals: 3, accent: ACCENT.thickness, setpointTag: "STRIP.THICKNESS.REF", deviationTag: "STRIP.THICKNESS.DEVIATION", deviationDecimals: 1, deviationUnit: "\u00B5m", icon: _jsx(Ruler, { size: 15, "aria-hidden": true }), spark: "thickness" }), _jsx(KpiTile, { label: "ENTRY THICKNESS", tagName: "STRIP.THICKNESS.ENTRY", decimals: 3, accent: ACCENT.thickness, icon: _jsx(Ruler, { size: 15, "aria-hidden": true }), spark: "thicknessEntry" }), _jsx(KpiTile, { label: "REDUCTION", tagName: "STRIP.REDUCTION", decimals: 2, accent: ACCENT.thickness, icon: _jsx(Layers, { size: 15, "aria-hidden": true }), spark: "reduction" }), _jsx(KpiTile, { label: "STRIP WIDTH", tagName: "STRIP.WIDTH", decimals: 0, accent: ACCENT.thickness, icon: _jsx(Ruler, { size: 15, "aria-hidden": true }) })] }), _jsxs(KpiGroup, { title: "ROLLING", accent: ACCENT.rolling, children: [_jsx(KpiTile, { label: "ROLL FORCE", tagName: "ROLL.FORCE.ACTUAL", decimals: 0, accent: ACCENT.rolling, setpointTag: "ROLL.FORCE.REF", icon: _jsx(ArrowDownWideNarrow, { size: 15, "aria-hidden": true }), spark: "rollingForce" }), _jsx(KpiTile, { label: "MILL SPEED", tagName: "MILL.SPEED.ACTUAL", decimals: 0, accent: ACCENT.rolling, setpointTag: "MILL.SPEED.REF", icon: _jsx(Gauge, { size: 15, "aria-hidden": true }), spark: "speed" }), _jsx(KpiTile, { label: "ROLL GAP", tagName: "ROLL.GAP.ACTUAL", decimals: 3, accent: ACCENT.rolling, setpointTag: "ROLL.GAP.REF", icon: _jsx(Settings2, { size: 15, "aria-hidden": true }), spark: "rollGap" }), _jsx(KpiTile, { label: "WORK ROLL RPM", tagName: "WR.TOP.RPM", decimals: 0, accent: ACCENT.rolling, icon: _jsx(Gauge, { size: 15, "aria-hidden": true }), spark: "rollRpm" })] }), _jsxs(KpiGroup, { title: "WORK ROLL & SHAPE CONTROL", accent: ACCENT.workroll, children: [_jsx(KpiTile, { label: "WR BENDING (TOP)", tagName: "WR.TOP.BENDING", decimals: 0, accent: ACCENT.workroll, icon: _jsx(Settings2, { size: 15, "aria-hidden": true }), spark: "wrTopBending" }), _jsx(KpiTile, { label: "WR BENDING (BOTTOM)", tagName: "WR.BOTTOM.BENDING", decimals: 0, accent: ACCENT.workroll, icon: _jsx(Settings2, { size: 15, "aria-hidden": true }), spark: "wrBottomBending" }), _jsx(KpiTile, { label: "DRF SETPOINT", tagName: "ROLL.FORCE.DIFF_REF", decimals: 1, accent: ACCENT.workroll, icon: _jsx(ArrowDownWideNarrow, { size: 15, "aria-hidden": true }) }), _jsx(KpiTile, { label: "TILTING (OS\u2212DS)", tagName: "ROLL.GAP.TILT", decimals: 1, accent: ACCENT.workroll, signed: true, icon: _jsx(Settings2, { size: 15, "aria-hidden": true }), spark: "rollGapTilt" })] }), _jsxs(KpiGroup, { title: "TENSION", accent: ACCENT.tension, children: [_jsx(KpiTile, { label: "ENTRY TENSION", tagName: "TENSION.ENTRY", decimals: 1, accent: ACCENT.tension, setpointTag: "TENSION.ENTRY.REF", icon: _jsx(UnfoldVertical, { size: 15, "aria-hidden": true }), spark: "entryTension" }), _jsx(KpiTile, { label: "EXIT TENSION", tagName: "TENSION.EXIT", decimals: 1, accent: ACCENT.tension, setpointTag: "TENSION.EXIT.REF", icon: _jsx(UnfoldVertical, { size: 15, "aria-hidden": true }), spark: "exitTension" })] }), _jsxs(KpiGroup, { title: "DRIVE", accent: ACCENT.drive, children: [_jsx(KpiTile, { label: "DRIVE TORQUE", tagName: "DRIVE.TORQUE", decimals: 1, accent: ACCENT.drive, icon: _jsx(Zap, { size: 15, "aria-hidden": true }), spark: "torque" }), _jsx(KpiTile, { label: "DRIVE CURRENT", tagName: "DRIVE.CURRENT", decimals: 0, accent: ACCENT.drive, icon: _jsx(Zap, { size: 15, "aria-hidden": true }), spark: "current" }), _jsx(KpiTile, { label: "DRIVE RPM", tagName: "DRIVE.RPM", decimals: 0, accent: ACCENT.drive, icon: _jsx(Gauge, { size: 15, "aria-hidden": true }), spark: "driveRpm" }), _jsx(MotorLoadTile, {})] }), _jsxs(KpiGroup, { title: "ENERGY", accent: ACCENT.energy, children: [_jsx(KpiTile, { label: "CURRENT POWER", tagName: "DRIVE.POWER", decimals: 0, accent: ACCENT.energy, icon: _jsx(Zap, { size: 15, "aria-hidden": true }), spark: "power" }), _jsx(CoilEnergyTiles, {})] })] }));
}
function KpiGroup({ title, accent, children, }) {
    return (_jsxs("section", { className: "kpi-group", "aria-label": title, style: { '--group-accent': accent }, children: [_jsx("h2", { className: "kpi-group-title", children: title }), _jsx("div", { className: "kpi-group-grid", children: children })] }));
}
/** Motor load is a derived percentage, not a tag — so it gets the dim treatment. */
function MotorLoadTile() {
    const pct = useMachineStore((s) => s.state.drive.torquePercentage);
    const over = pct >= 100;
    const warn = pct >= 80;
    return (_jsxs(KpiSlot, { label: "MOTOR LOAD", accent: ACCENT.drive, children: [_jsxs("div", { className: "mt-1", children: [_jsx("span", { className: "num text-text text-value-lg font-semibold tracking-tight", children: pct.toFixed(1) }), _jsx("span", { className: "text-text-faint text-micro ml-1", children: "%" })] }), _jsxs("div", { className: "text-text-faint text-micro mt-1.5", children: ["OF ", millConfig.ratings.mainDriveRatedTorque, " kNm RATING"] }), _jsxs("div", { className: "mt-2 inline-flex items-center gap-1.5", children: [_jsx("span", { "aria-hidden": true, className: `h-2 w-2 shrink-0 rounded-full ${over ? 'bg-alarm' : warn ? 'bg-warning' : 'bg-healthy'}` }), _jsx("span", { className: `text-micro font-semibold tracking-wide ${over ? 'text-alarm' : warn ? 'text-warning' : 'text-healthy'}`, children: over ? 'OVERLOAD' : warn ? 'WARNING' : 'NORMAL' })] })] }));
}
/**
 * Energy totals. Specific energy is honestly derivable from power and
 * throughput; the cumulative figures are not — integrating power in the browser
 * would only measure how long this tab has been open, which is not what
 * "today's energy" means. Those stay NO TAG until the historian supplies them.
 */
function CoilEnergyTiles() {
    const state = useMachineStore((s) => s.state);
    // Both from `rollingEngine`, so "throughput" and "specific energy" mean the
    // same thing here as everywhere else in the app (§18).
    const throughputTph = throughput(state);
    const specific = throughputTph > 0.01 ? specificEnergy(state) : null;
    return (_jsxs(_Fragment, { children: [_jsxs(KpiSlot, { label: "SPECIFIC ENERGY", accent: ACCENT.energy, children: [_jsxs("div", { className: "mt-1", children: [specific === null ? (_jsx("span", { className: "num text-text-faint text-value-lg", children: "\u2014" })) : (_jsx("span", { className: "num text-text text-value-lg font-semibold tracking-tight", children: specific.toFixed(1) })), _jsx("span", { className: "text-text-faint text-micro ml-1", children: "kWh/t" })] }), _jsx("div", { className: "text-text-faint text-micro mt-1.5", children: specific === null ? 'MILL AT STANDSTILL' : `${throughputTph.toFixed(1)} t/h THROUGHPUT` }), _jsx("div", { className: "text-text-faint text-micro mt-2", children: "DERIVED" })] }), _jsx(KpiTile, { label: "COIL ENERGY", tagName: "MILL.ENERGY.COIL", decimals: 1, accent: ACCENT.energy }), _jsx(KpiTile, { label: "ENERGY TODAY", tagName: "MILL.ENERGY.TODAY", decimals: 0, accent: ACCENT.energy })] }));
}
/* ── Process parameters ─────────────────────────────────────────────────── */
function ProcessParameters() {
    return (_jsxs("div", { className: "param-grid grid min-h-0 content-start", children: [_jsx(ParameterGroup, { title: "ROLLING", accent: ACCENT.rolling, icon: _jsx(ArrowDownWideNarrow, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Roll force', tagName: 'ROLL.FORCE.ACTUAL', decimals: 0 },
                    { label: 'Roll force setpoint', tagName: 'ROLL.FORCE.REF', decimals: 0 },
                    { label: 'Roll gap', tagName: 'ROLL.GAP.ACTUAL', decimals: 3 },
                    { label: 'Gap setpoint S0', tagName: 'ROLL.GAP.REF', decimals: 3 },
                    { label: 'Mill speed', tagName: 'MILL.SPEED.ACTUAL', decimals: 0 },
                    { label: 'Speed setpoint', tagName: 'MILL.SPEED.REF', decimals: 0 },
                    { label: 'Entry speed', tagName: 'MILL.SPEED.ENTRY', decimals: 0 },
                    { label: 'Reduction', tagName: 'STRIP.REDUCTION', decimals: 2 },
                    { label: 'Work roll RPM (top)', tagName: 'WR.TOP.RPM', decimals: 0 },
                    { label: 'Backup roll RPM (top)', tagName: 'BUR.TOP.RPM', decimals: 0 },
                ] }), _jsx(ParameterGroup, { title: "WORK ROLL CONTROL", accent: ACCENT.workroll, icon: _jsx(Settings2, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'WR bending (top)', tagName: 'WR.TOP.BENDING', decimals: 0 },
                    { label: 'WR bending (bottom)', tagName: 'WR.BOTTOM.BENDING', decimals: 0 },
                    { label: 'DRF setpoint', tagName: 'ROLL.FORCE.DIFF_REF', decimals: 1 },
                    { label: 'Roll force OS', tagName: 'ROLL.FORCE.OS', decimals: 0 },
                    { label: 'Roll force DS', tagName: 'ROLL.FORCE.DS', decimals: 0 },
                    { label: 'Tilting (OS−DS)', tagName: 'ROLL.GAP.TILT', decimals: 1, signed: true },
                    { label: 'Roll gap OS', tagName: 'ROLL.GAP.OS', decimals: 3 },
                    { label: 'Roll gap DS', tagName: 'ROLL.GAP.DS', decimals: 3 },
                ] }), _jsx(ParameterGroup, { title: "THICKNESS CONTROL", accent: ACCENT.thickness, icon: _jsx(Ruler, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Entry thickness', tagName: 'STRIP.THICKNESS.ENTRY', decimals: 3 },
                    { label: 'Exit thickness', tagName: 'STRIP.THICKNESS', decimals: 3 },
                    { label: 'Target thickness', tagName: 'STRIP.THICKNESS.REF', decimals: 3 },
                    { label: 'Thickness deviation', tagName: 'STRIP.THICKNESS.DEVIATION', decimals: 1, signed: true },
                    { label: 'DTR gauge', tagName: 'GAUGE.DTR.THICKNESS', decimals: 3 },
                    { label: 'ETR gauge', tagName: 'GAUGE.ETR.THICKNESS', decimals: 3 },
                    { label: 'AGC error', tagName: 'AGC.ERROR', decimals: 1 },
                    { label: 'AGC output', tagName: 'AGC.OUTPUT', decimals: 3 },
                    { label: 'Gap correction', tagName: 'AGC.GAP.CORRECTION', decimals: 3 },
                    { label: 'Mass flow closure', tagName: 'MILL.MASSFLOW.ERROR', decimals: 2, signed: true },
                ] }), _jsx(ParameterGroup, { title: "TENSION", accent: ACCENT.tension, icon: _jsx(UnfoldVertical, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Entry tension', tagName: 'TENSION.ENTRY', decimals: 1 },
                    { label: 'Entry setpoint', tagName: 'TENSION.ENTRY.REF', decimals: 1 },
                    { label: 'Exit tension', tagName: 'TENSION.EXIT', decimals: 1 },
                    { label: 'Exit setpoint', tagName: 'TENSION.EXIT.REF', decimals: 1 },
                    { label: 'DTR tension', tagName: 'DTR.TENSION', decimals: 1 },
                    { label: 'ETR tension', tagName: 'ETR.TENSION', decimals: 1 },
                    { label: 'POR tension', tagName: 'POR.TENSION', decimals: 1 },
                ] }), _jsx(ParameterGroup, { title: "DRIVE", accent: ACCENT.drive, icon: _jsx(Zap, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Torque', tagName: 'DRIVE.TORQUE', decimals: 1 },
                    { label: 'Current', tagName: 'DRIVE.CURRENT', decimals: 0 },
                    { label: 'Power', tagName: 'DRIVE.POWER', decimals: 0 },
                    { label: 'RPM', tagName: 'DRIVE.RPM', decimals: 0 },
                ], footer: _jsx(DriveRatings, {}) }), _jsx(ParameterGroup, { title: "HYDRAULIC", accent: ACCENT.hydraulic, icon: _jsx(Droplets, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Loading pressure', tagName: 'HYD.LOADING.PRESSURE', decimals: 0 },
                    { label: 'Bending pressure', tagName: 'HYD.BENDING.PRESSURE', decimals: 0 },
                    { label: 'Capsule position', tagName: 'HYD.GAP.POSITION', decimals: 3 },
                    { label: 'LP system pressure', tagName: 'LP.PRESSURE', decimals: 1 },
                    { label: 'Hydraulic flow', tagName: 'HYD.FLOW', decimals: 0 },
                    { label: 'Oil temperature', tagName: 'HYD.TEMPERATURE', decimals: 1 },
                ] }), _jsx(ParameterGroup, { title: "COOLING", accent: ACCENT.coil, icon: _jsx(Snowflake, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'Coolant temperature', tagName: 'COOLANT.TEMPERATURE', decimals: 1 },
                    { label: 'Coolant flow', tagName: 'COOLANT.FLOW', decimals: 0 },
                    { label: 'Coolant pressure', tagName: 'COOLANT.PRESSURE', decimals: 1 },
                    { label: 'Tank level', tagName: 'COOLANT.TANK.LEVEL', decimals: 0 },
                ], footer: _jsxs("p", { className: "text-text-faint text-micro border-line mt-2 border-t pt-2 leading-snug", children: ["Design flow ", millConfig.ratings.coolantFlowLpm, " LPM. The extract carries a coolant health word only \u2014 no instrumented values."] }) }), _jsx(ParameterGroup, { title: "LUBRICATION", accent: ACCENT.energy, icon: _jsx(Droplets, { size: 13, "aria-hidden": true }), rows: [
                    { label: 'LP system pressure', tagName: 'LP.PRESSURE', decimals: 1 },
                    { label: 'Lube flow', tagName: 'LUBRICATION.FLOW', decimals: 0 },
                    { label: 'Lube temperature', tagName: 'LUBRICATION.TEMPERATURE', decimals: 1 },
                ] })] }));
}
function DriveRatings() {
    return (_jsxs("p", { className: "text-text-faint text-micro border-line mt-2 border-t pt-2 leading-snug", children: ["Rated ", millConfig.ratings.mainDriveRating, " kW \u00B7", ' ', millConfig.ratings.mainDriveRatedTorque, " kNm \u00B7 ", engineeringConfig.motorLimits.currentMax, " A"] }));
}
