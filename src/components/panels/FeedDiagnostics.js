import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FEED & MODEL DIAGNOSTICS — the twin's own self-check, plus link health.
 *
 * §8.1 asks that the mass-flow cross-check be surfaced "as a diagnostic, not as
 * a hidden correction", and §19 asks that the model be internally consistent
 * rather than merely plausible. This is where the twin is held to that: it
 * shows the residuals of its own physics so an engineer can challenge it.
 *
 * A digital twin that cannot be checked is a picture.
 *
 * Lives inside the MODEL / DATA STATUS dialog rather than on the dashboard —
 * frame counts and solver iterations are engineering data, not operator data.
 */
import { engineeringConfig } from '../../config/engineeringConfig';
import { calculateConsistency } from '../../machine/rollingEngine';
import { useMachineStore } from '../../store/machineStore';
import { DerivedRow } from '../common/ValueReadout';
import { Panel } from '../common/Panel';
export function FeedDiagnostics() {
    const state = useMachineStore((s) => s.state);
    const checks = calculateConsistency(state);
    const comm = state.communication;
    /**
     * Solver iterations and the gaugemeter residual are produced by the
     * simulation's coupled solve. On any other source the store has no solver to
     * report and passes zeros (machineStore `diagnostics` fallback) — which would
     * render as a flawless 0.000 µm residual and a green tick. That is a
     * placeholder wearing the costume of a measurement, so say so instead.
     */
    const hasSolver = state.operatingMode !== 'LIVE';
    return (_jsxs("div", { className: "grid min-h-0 gap-3.5 lg:grid-cols-2", children: [_jsxs(Panel, { title: "Data feed", children: [_jsx(DerivedRow, { label: "Source", value: comm.sourceName, tone: "dim" }), _jsx(DerivedRow, { label: "Operating mode", value: state.operatingMode, tone: "dim" }), _jsx(DerivedRow, { label: "Link", value: !comm.connected ? 'LOST' : comm.stale ? 'STALE' : 'CONNECTED', tone: !comm.connected || comm.stale ? 'alarm' : 'healthy' }), _jsx(DerivedRow, { label: "Update rate", value: comm.updateRateHz.toFixed(1), unit: "Hz", tone: comm.updateRateHz > 0.15 ? 'normal' : 'alarm' }), _jsx(DerivedRow, { label: "Frame age", value: (comm.ageMs / 1000).toFixed(1), unit: "s", tone: comm.stale ? 'alarm' : 'normal', title: `Stale after ${engineeringConfig.staleAfterMs / 1000} s` }), _jsx(DerivedRow, { label: "Frames received", value: comm.framesReceived.toFixed(0), tone: "dim" }), _jsx(DerivedRow, { label: "Last valid data", value: comm.lastValidTimestamp
                            ? new Date(comm.lastValidTimestamp).toLocaleTimeString()
                            : 'NEVER', tone: comm.lastValidTimestamp ? 'dim' : 'alarm' })] }), _jsxs(Panel, { title: "Physics consistency", children: [_jsx(DerivedRow, { label: "Mass flow closure", value: `${checks.massFlowErrorPct >= 0 ? '+' : ''}${checks.massFlowErrorPct.toFixed(3)}`, unit: "%", tone: checks.massFlowOk ? 'healthy' : 'warning', title: "h_entry\u00B7v_entry vs h_exit\u00B7v_exit (\u00A78.1). Surfaced as a diagnostic \u2014 the simulation never silently corrects itself with this number." }), _jsx(DerivedRow, { label: "Gaugemeter residual", value: hasSolver ? checks.gaugemeterResidualUm.toFixed(3) : 'N/A', unit: hasSolver ? 'µm' : undefined, tone: hasSolver ? (checks.gaugemeterOk ? 'healthy' : 'warning') : 'dim', title: hasSolver
                            ? '|h − (S0 + F/M)| after the coupled solve. Near zero means force, gap and thickness are mutually consistent.'
                            : 'No coupled solve runs on a live feed — this residual is only meaningful against the simulation.' }), _jsx(DerivedRow, { label: "Solver iterations", value: hasSolver ? state.diagnostics.solverIterations.toFixed(0) : 'N/A', tone: "dim", title: hasSolver
                            ? `Fixed-point iterations used on the last tick, of ${engineeringConfig.solver.maxIterations} allowed`
                            : 'No solver runs on a live feed.' }), _jsx(DerivedRow, { label: "Force vs schedule", value: `${checks.forceVsScheduleErrorPct >= 0 ? '+' : ''}${checks.forceVsScheduleErrorPct.toFixed(1)}`, unit: "%", tone: Math.abs(checks.forceVsScheduleErrorPct) < 12 ? 'normal' : 'warning', title: "Live force against the pass schedule's prediction. Both come from the same force model, so a divergence means the mill is not on schedule \u2014 not that two formulas disagree." }), _jsx(DerivedRow, { label: "Thickness in tolerance", value: checks.thicknessInTolerance ? 'YES' : 'NO', tone: checks.thicknessInTolerance ? 'healthy' : 'warning', title: `±${engineeringConfig.thicknessTolerance} µm target` })] })] }));
}
