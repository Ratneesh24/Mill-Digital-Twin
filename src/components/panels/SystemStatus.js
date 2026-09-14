import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SYSTEM STATUS — the twin's own self-check.
 *
 * §8.1 asks that the mass-flow cross-check be surfaced "as a diagnostic, not as
 * a hidden correction", and §19 asks that the model be internally consistent
 * rather than merely plausible. This panel is where the twin is held to that:
 * it shows the residuals of its own physics so an engineer can challenge it.
 *
 * A digital twin that cannot be checked is a picture.
 */
import { engineeringConfig } from '../../config/engineeringConfig';
import { calculateConsistency } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { DerivedRow } from '../common/ValueReadout';
import { Panel } from '../common/Panel';
export function SystemStatus() {
    const state = useMachineStore((s) => s.state);
    const checks = calculateConsistency(state);
    const comm = state.communication;
    return (_jsxs(Panel, { title: "System status \u00B7 model self-check", children: [_jsxs("div", { className: "mb-1.5", children: [_jsx("div", { className: "label mb-1", children: "DATA FEED" }), _jsx(DerivedRow, { label: "Source", value: comm.sourceName, tone: "dim" }), _jsx(DerivedRow, { label: "Update rate", value: comm.updateRateHz.toFixed(1), unit: "Hz", tone: comm.updateRateHz > 0.15 ? 'normal' : 'alarm' }), _jsx(DerivedRow, { label: "Frame age", value: (comm.ageMs / 1000).toFixed(1), unit: "s", tone: comm.stale ? 'alarm' : 'normal', title: `Stale after ${engineeringConfig.staleAfterMs / 1000} s` }), _jsx(DerivedRow, { label: "Frames received", value: comm.framesReceived.toFixed(0), tone: "dim" })] }), _jsxs("div", { className: "border-line border-t pt-1.5", children: [_jsx("div", { className: "label mb-1", children: "PHYSICS CONSISTENCY" }), _jsx(DerivedRow, { label: "Mass flow closure", value: `${checks.massFlowErrorPct >= 0 ? '+' : ''}${checks.massFlowErrorPct.toFixed(3)}`, unit: "%", tone: checks.massFlowOk ? 'healthy' : 'warning', title: "h_entry\u00B7v_entry vs h_exit\u00B7v_exit (\u00A78.1). Surfaced as a diagnostic \u2014 the simulation never silently corrects itself with this number." }), _jsx(DerivedRow, { label: "Gaugemeter residual", value: checks.gaugemeterResidualUm.toFixed(3), unit: "\u00B5m", tone: checks.gaugemeterOk ? 'healthy' : 'warning', title: "|h \u2212 (S0 + F/M)| after the coupled solve. Near zero means force, gap and thickness are mutually consistent." }), _jsx(DerivedRow, { label: "Solver iterations", value: state.diagnostics.solverIterations.toFixed(0), tone: "dim", title: `Fixed-point iterations used on the last tick, of ${engineeringConfig.solver.maxIterations} allowed` }), _jsx(DerivedRow, { label: "Force vs schedule", value: `${checks.forceVsScheduleErrorPct >= 0 ? '+' : ''}${checks.forceVsScheduleErrorPct.toFixed(1)}`, unit: "%", tone: Math.abs(checks.forceVsScheduleErrorPct) < 12 ? 'normal' : 'warning', title: "Live force against the pass schedule's prediction. Both come from the same force model, so a divergence means the mill is not on schedule \u2014 not that two formulas disagree." }), _jsx(DerivedRow, { label: "Thickness in tolerance", value: checks.thicknessInTolerance ? 'YES' : 'NO', tone: checks.thicknessInTolerance ? 'healthy' : 'warning', title: `±${engineeringConfig.thicknessTolerance} µm target` })] })] }));
}
