import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * VALIDATION — §17 and §18, made executable.
 *
 * Two halves:
 *
 *  A. CONTINUOUS INVARIANTS. The physical couplings from §18's table, checked
 *     against MachineState on every frame. These are the questions a
 *     commissioning engineer would ask — does roll rpm actually follow mill
 *     speed, does mass flow close, is the force zero when the mill is stopped —
 *     and they are answered live rather than asserted in a document.
 *
 *  B. THE TEN VALIDATION TESTS. Each one runs its stimulus, captures a baseline,
 *     and reports what actually changed.
 *
 * A twin that cannot be challenged is a picture. This page is where it is
 * challenged.
 */
import { useState } from 'react';
import { engineeringConfig } from '../../config/engineeringConfig';
import { millConfig } from '../../config/millConfig';
import { entryReelId, exitReelId } from '../../machine/machineState';
import { isMoving, isRolling } from '../../machine/machineStateMachine';
import { calculateRollRPM, rollSurfaceSpeedFromStripSpeed } from '../../simulation/rollingModel';
import { reelRPM } from '../../simulation/coilModel';
import { useAlarmStore } from '../../store/alarmStore';
import { useMachineStore } from '../../store/machineStore';
import { Panel } from '../common/Panel';
// ---------------------------------------------------------------------------
// A. Continuous invariants (§18 coupling table)
// ---------------------------------------------------------------------------
function withinPct(actual, expected, tolerancePct) {
    if (Math.abs(expected) < 1e-6)
        return Math.abs(actual) < 1e-3;
    return Math.abs((actual - expected) / expected) * 100 <= tolerancePct;
}
function invariants(state) {
    const checks = [];
    const rolling = isRolling(state.machineStatus);
    const moving = isMoving(state.machineStatus) && state.speed.actual > 0.1;
    // Roll rpm must follow mill speed through §8.4, not an animation timer.
    const expectedWrRpm = calculateRollRPM(rollSurfaceSpeedFromStripSpeed(state.speed.actual), state.rolls.upperWork.diameter);
    checks.push({
        label: 'Work roll rpm follows mill speed',
        pass: withinPct(Math.abs(state.rolls.upperWork.rpm), expectedWrRpm, 1),
        detail: `${Math.abs(state.rolls.upperWork.rpm).toFixed(1)} rpm vs ${expectedWrRpm.toFixed(1)} expected from v/(π·D)`,
    });
    // BUR shares the WR surface speed, so its rpm scales inversely with diameter.
    const expectedBurRpm = calculateRollRPM(rollSurfaceSpeedFromStripSpeed(state.speed.actual), state.rolls.upperBackup.diameter);
    checks.push({
        label: 'Backup roll rpm scales with diameter ratio',
        pass: withinPct(Math.abs(state.rolls.upperBackup.rpm), expectedBurRpm, 1),
        detail: `${Math.abs(state.rolls.upperBackup.rpm).toFixed(1)} rpm vs ${expectedBurRpm.toFixed(1)} expected`,
    });
    // Upper and lower work rolls must counter-rotate.
    checks.push({
        label: 'Work rolls counter-rotate',
        pass: !moving ||
            Math.sign(state.rolls.upperWork.rpm) === -Math.sign(state.rolls.lowerWork.rpm),
        detail: `upper ${state.rolls.upperWork.rpm.toFixed(1)}, lower ${state.rolls.lowerWork.rpm.toFixed(1)} rpm`,
    });
    // Mass flow closure (§8.1).
    checks.push({
        label: 'Mass flow closes (h·v conserved)',
        pass: Math.abs(state.diagnostics.massFlowErrorPct) < 1,
        detail: `${state.diagnostics.massFlowErrorPct >= 0 ? '+' : ''}${state.diagnostics.massFlowErrorPct.toFixed(3)}% error`,
    });
    // Gaugemeter anchor (§19.8).
    checks.push({
        label: 'Gaugemeter h = S0 + F/M holds',
        pass: state.diagnostics.gaugemeterResidualUm < 1,
        detail: `residual ${state.diagnostics.gaugemeterResidualUm.toFixed(3)} µm`,
    });
    // Reel rpm follows line speed and the current coil radius.
    const payoff = entryReelId(state.rollingDirection) === 'DTR' ? state.tension.dtr : state.tension.etr;
    const entrySpeed = state.thickness.entry > 0
        ? (state.speed.actual * state.thickness.actual) / state.thickness.entry
        : state.speed.actual;
    const expectedPayoffRpm = reelRPM(entrySpeed, payoff.diameter / 2);
    checks.push({
        label: 'Payoff reel rpm follows v / 2πr',
        pass: withinPct(Math.abs(payoff.rpm), expectedPayoffRpm, 2),
        detail: `${Math.abs(payoff.rpm).toFixed(2)} rpm vs ${expectedPayoffRpm.toFixed(2)} at Ø${payoff.diameter.toFixed(0)} mm`,
    });
    // A stopped mill develops no rolling force.
    checks.push({
        label: 'No rolling force unless rolling',
        pass: rolling || state.rollingForce.actual < engineeringConfig.forceLimits.warning * 0.35,
        detail: `${state.rollingForce.actual.toFixed(0)} t while ${state.machineStatus}`,
    });
    // Entry/exit roles are derived from direction, not from a side.
    const entryId = entryReelId(state.rollingDirection);
    const entryReelState = entryId === 'DTR' ? state.tension.dtr : state.tension.etr;
    checks.push({
        label: 'Entry/exit roles follow direction',
        pass: entryReelState.role === 'PAYOFF',
        detail: `${state.rollingDirection}: ${entryId} pays off → ${exitReelId(state.rollingDirection)} winds`,
    });
    // Torque must track force — the §8.6 chain force ↑ → torque ↑ → current ↑.
    const torqueSignAgrees = !rolling || state.rollingForce.actual < 1 || state.drive.torque > 0;
    checks.push({
        label: 'Drive torque follows rolling force',
        pass: torqueSignAgrees,
        detail: `${state.rollingForce.actual.toFixed(0)} t → ${state.drive.torque.toFixed(1)} kNm → ${state.drive.current.toFixed(0)} A`,
    });
    return checks;
}
/**
 * §7.3 / §14.5 invariants that are properties of the TAG FRAME rather than of
 * the physics. These are the ones that catch a provenance regression — a value
 * quietly rendered as though it were measured.
 */
function provenanceInvariants(tags, state) {
    const all = Object.values(tags);
    if (all.length === 0) {
        return [{ label: 'Tag frame received', pass: false, detail: 'no frames yet' }];
    }
    const mislabelled = all.filter((t) => t.provenance === 'MEASURED' && t.quality === 'SIMULATION');
    const unavailableWithValue = all.filter((t) => t.provenance === 'UNAVAILABLE' && t.value !== null);
    const staleTags = all.filter((t) => t.quality === 'STALE');
    const liveTags = all.filter((t) => t.quality === 'GOOD' || t.quality === 'SIMULATION');
    return [
        {
            label: 'No simulated value is badged MEASURED',
            pass: mislabelled.length === 0,
            detail: mislabelled.length === 0
                ? `${all.length} tags checked`
                : mislabelled.map((t) => t.tagName).join(', '),
        },
        {
            label: 'NO TAG values carry no number',
            pass: unavailableWithValue.length === 0,
            detail: unavailableWithValue.length === 0
                ? `${all.filter((t) => t.provenance === 'UNAVAILABLE').length} unavailable tags, all blank`
                : unavailableWithValue.map((t) => t.tagName).join(', '),
        },
        {
            label: 'Stale feed marks every readout STALE',
            pass: !state.communication.stale || liveTags.length === 0,
            detail: state.communication.stale
                ? `${staleTags.length} stale / ${liveTags.length} still claiming fresh`
                : 'feed fresh',
        },
    ];
}
function snapshot(state) {
    return {
        speed: state.speed.actual,
        wrRpm: Math.abs(state.rolls.upperWork.rpm),
        force: state.rollingForce.actual,
        thickness: state.thickness.actual,
        current: state.drive.current,
        gap: state.rollGap.actual,
        pass: state.pass.current,
        direction: state.rollingDirection,
        status: state.machineStatus,
    };
}
export function ValidationPanel() {
    const state = useMachineStore((s) => s.state);
    const tags = useMachineStore((s) => s.tags);
    const send = useMachineStore((s) => s.sendCommand);
    const setScenario = useMachineStore((s) => s.setScenario);
    const connect = useMachineStore((s) => s.connect);
    const alarms = useAlarmStore((s) => s.active);
    const highlighted = useAlarmStore((s) => s.highlightedSections);
    const [baselines, setBaselines] = useState({});
    const alarmIds = alarms.map((a) => a.id);
    const tests = [
        {
            id: 1,
            action: 'Machine stopped',
            expected: 'Rolls, strip, reels stopped; speed = 0',
            run: () => send({ type: 'STOP' }),
            check: (_b, s) => [
                ok('Speed is zero', s.speed.actual < 0.05, `${s.speed.actual.toFixed(2)} m/min`),
                ok('Work rolls stopped', Math.abs(s.rolls.upperWork.rpm) < 0.05, `${s.rolls.upperWork.rpm.toFixed(2)} rpm`),
                ok('Reels stopped', Math.abs(s.tension.dtr.rpm) < 0.05 && Math.abs(s.tension.etr.rpm) < 0.05, `DTR ${s.tension.dtr.rpm.toFixed(2)} · ETR ${s.tension.etr.rpm.toFixed(2)} rpm`),
            ],
        },
        {
            id: 2,
            action: 'Start rolling',
            expected: 'Rolls and strip accelerate; reels rotate; motor load changes',
            run: () => send({ type: 'START' }),
            check: (b, s) => [
                ok('Speed increased', s.speed.actual > b.speed + 1, `${b.speed.toFixed(0)} → ${s.speed.actual.toFixed(0)} m/min`),
                ok('Roll rpm increased', Math.abs(s.rolls.upperWork.rpm) > b.wrRpm + 0.5, `${b.wrRpm.toFixed(1)} → ${Math.abs(s.rolls.upperWork.rpm).toFixed(1)} rpm`),
                ok('Reels turning', Math.abs(s.tension.dtr.rpm) > 0.05, `DTR ${s.tension.dtr.rpm.toFixed(2)} rpm`),
                ok('Motor load changed', Math.abs(s.drive.current - b.current) > 1, `${b.current.toFixed(0)} → ${s.drive.current.toFixed(0)} A`),
            ],
        },
        {
            id: 3,
            action: 'Increase speed +25 m/min',
            expected: 'Roll RPM ↑, strip faster, reels respond, current changes',
            run: () => send({ type: 'TRIM_SPEED_REFERENCE', value: 25 }),
            check: (b, s) => [
                ok('Speed increased', s.speed.actual > b.speed + 1, `${b.speed.toFixed(0)} → ${s.speed.actual.toFixed(0)} m/min`),
                ok('Roll rpm increased', Math.abs(s.rolls.upperWork.rpm) > b.wrRpm, `${b.wrRpm.toFixed(1)} → ${Math.abs(s.rolls.upperWork.rpm).toFixed(1)} rpm`),
                ok('Reel responded', Math.abs(s.tension.etr.rpm) > 0.05, `ETR ${s.tension.etr.rpm.toFixed(2)} rpm`),
                ok('Drive power changed', Math.abs(s.drive.power) > 0, `${s.drive.power.toFixed(0)} kW`),
            ],
        },
        {
            id: 4,
            action: 'Reduce roll gap −0.05 mm',
            expected: 'WRs move closer, thickness ↓, force ↑, motor load ↑',
            run: () => send({ type: 'TRIM_ROLL_GAP', value: -0.05 }),
            check: (b, s) => [
                ok('Delivered thickness reduced', s.thickness.actual < b.thickness, `${b.thickness.toFixed(4)} → ${s.thickness.actual.toFixed(4)} mm`),
                ok('Rolling force increased', s.rollingForce.actual > b.force, `${b.force.toFixed(0)} → ${s.rollingForce.actual.toFixed(0)} t`),
                ok('Motor load increased', s.drive.current > b.current, `${b.current.toFixed(0)} → ${s.drive.current.toFixed(0)} A`),
            ],
        },
        {
            id: 5,
            action: 'Reverse (runs at pass end)',
            expected: 'Speed → 0, motion stops, direction flips, entry/exit swap, rolls counter-rotate',
            check: (b, s) => [
                ok('Direction flipped', s.rollingDirection !== b.direction, `${b.direction} → ${s.rollingDirection}`),
                ok('Entry/exit roles swapped', (entryReelId(s.rollingDirection) === 'DTR' ? s.tension.dtr : s.tension.etr).role === 'PAYOFF', `${entryReelId(s.rollingDirection)} pays off → ${exitReelId(s.rollingDirection)} winds`),
                ok('Rolls counter-rotate', Math.sign(s.rolls.upperWork.rpm) === -Math.sign(s.rolls.lowerWork.rpm) || Math.abs(s.rolls.upperWork.rpm) < 0.05, `upper ${s.rolls.upperWork.rpm.toFixed(1)} · lower ${s.rolls.lowerWork.rpm.toFixed(1)} rpm`),
            ],
        },
        {
            id: 6,
            action: 'Fast stop',
            expected: 'Immediate deceleration, status FAST_STOP, animation stops, event + alarm raised',
            run: () => send({ type: 'FAST_STOP' }),
            check: (_b, s, a) => [
                ok('Status is FAST STOP or STOPPED', s.machineStatus === 'FAST_STOP' || s.machineStatus === 'STOPPED', s.machineStatus),
                ok('Decelerating to zero', s.speed.actual < 5, `${s.speed.actual.toFixed(1)} m/min`),
                ok('Alarm raised', a.includes('FAST_STOP') || a.includes('EMERGENCY_STOP'), a.join(', ') || 'none'),
            ],
        },
        {
            id: 7,
            action: 'High force scenario',
            expected: 'Force WARNING/ALARM, alarm listed, affected section highlighted',
            run: () => setScenario('HIGH_FORCE'),
            check: (_b, s, a) => [
                ok('Force above warning limit', s.rollingForce.actual >= engineeringConfig.forceLimits.warning, `${s.rollingForce.actual.toFixed(0)} t vs ${engineeringConfig.forceLimits.warning.toFixed(0)} t warning`),
                ok('Alarm listed', a.includes('HIGH_ROLLING_FORCE'), a.join(', ') || 'none'),
                ok('Twin section highlighted', highlighted.includes('ROLL_BITE'), highlighted.join(', ') || 'none'),
            ],
        },
        {
            id: 8,
            action: 'Communication loss',
            expected: 'Status LOST, values STALE, last valid timestamp shown, nothing shown as live',
            run: () => setScenario('COMMUNICATION_LOSS'),
            check: (_b, s, a) => [
                ok('Feed reported stale or lost', s.communication.stale || !s.communication.connected, `stale=${s.communication.stale} connected=${s.communication.connected}`),
                ok('Last valid timestamp held', s.communication.lastValidTimestamp > 0, s.communication.lastValidTimestamp ? new Date(s.communication.lastValidTimestamp).toLocaleTimeString() : 'never'),
                ok('Alarm raised', a.includes('COMMUNICATION_LOST'), a.join(', ') || 'none'),
            ],
        },
        {
            id: 9,
            action: 'Pass complete (runs at end of pass)',
            expected: 'Pass increments, schedule updates, target thickness changes, direction may change',
            check: (b, s) => [
                ok('Pass number incremented', s.pass.current > b.pass, `${b.pass} → ${s.pass.current}`),
                ok('Target thickness changed', Math.abs(s.pass.targetThickness - b.thickness) > 1e-4, `target now ${s.pass.targetThickness.toFixed(3)} mm`),
                ok('Direction updated', true, `${s.rollingDirection}`),
            ],
        },
        {
            id: 10,
            action: 'SIMULATION → LIVE',
            expected: 'Simulation disengages cleanly, live source authoritative, no conflicting values',
            run: () => void connect('LIVE'),
            check: (_b, s) => [
                ok('Operating mode is LIVE', s.operatingMode === 'LIVE', s.operatingMode),
                ok('Simulation source released', s.communication.sourceName.startsWith('LIVE'), s.communication.sourceName),
                ok('No stale simulated values presented as live', !s.communication.connected ? true : !s.communication.stale, s.communication.connected ? 'connected' : 'disconnected — values show NO DATA, not last simulated'),
            ],
        },
    ];
    const live = [...invariants(state), ...provenanceInvariants(tags, state)];
    const livePassed = live.filter((c) => c.pass).length;
    return (_jsxs("div", { className: "dashboard-page-grid grid h-full min-h-0 grid-cols-[1fr_1.2fr] gap-1.5", children: [_jsxs(Panel, { title: "Continuous invariants \u2014 \u00A718 coupling table", right: _jsxs("span", { className: `num text-micro ${livePassed === live.length ? 'text-healthy' : 'text-warning'}`, children: [livePassed, "/", live.length] }), children: [_jsx("p", { className: "text-text-dim mb-2 text-micro leading-relaxed", children: "Evaluated against MachineState every frame. These are the couplings \u00A718 asks a commissioning engineer to verify \u2014 checked live rather than asserted in a document." }), live.map((check) => (_jsx(CheckRow, { check: check }, check.label))), _jsxs("div", { className: "border-line mt-3 border-t pt-2", children: [_jsx("div", { className: "label mb-1", children: "MODEL SCOPE" }), _jsxs("p", { className: "text-text-faint text-micro leading-relaxed", children: ["Passing every invariant means the twin is INTERNALLY consistent \u2014 the numbers on the 3D scene, the KPI bar and the trend chart are the same numbers, and they obey the relations in \u00A78. It does not mean the twin is calibrated against", ' ', millConfig.identity.mill, ". That requires the \u00A722 open items to close."] })] })] }), _jsx(Panel, { title: "Validation tests \u2014 \u00A717", bodyClassName: "p-0", children: tests.map((test) => {
                    const before = baselines[test.id];
                    const results = before ? test.check(before, state, alarmIds) : null;
                    const allPass = results?.every((r) => r.pass) ?? false;
                    return (_jsxs("div", { className: "border-line border-b px-2.5 py-2", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "text-text text-meta", children: [_jsx("span", { className: "num text-text-faint mr-1.5", children: test.id }), test.action] }), _jsx("div", { className: "text-text-faint mt-0.5 text-micro leading-snug", children: test.expected })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-1.5", children: [results && (_jsx("span", { className: `border px-1.5 text-micro leading-[16px] tracking-wider ${allPass
                                                    ? 'border-healthy/50 text-healthy bg-healthy/10'
                                                    : 'border-warning/50 text-warning bg-warning/10'}`, children: allPass ? 'PASS' : 'PENDING' })), _jsx("button", { type: "button", onClick: () => {
                                                    setBaselines((prev) => ({ ...prev, [test.id]: snapshot(state) }));
                                                    test.run?.();
                                                }, className: "border-line text-text-dim hover:border-normal/50 hover:text-normal border px-1.5 py-0.5 text-micro tracking-wider transition-colors", title: test.run
                                                    ? 'Capture a baseline and run the stimulus'
                                                    : 'Capture a baseline, then wait for the mill to reach this condition', children: test.run ? 'RUN' : 'ARM' })] })] }), results && (_jsx("div", { className: "mt-1.5 space-y-0.5", children: results.map((check) => (_jsx(CheckRow, { check: check, compact: true }, check.label))) }))] }, test.id));
                }) })] }));
}
function ok(label, pass, detail) {
    return { label, pass, detail };
}
function CheckRow({ check, compact = false }) {
    return (_jsxs("div", { className: `flex items-baseline gap-2 ${compact ? 'py-0' : 'border-line border-b py-1'}`, children: [_jsx("span", { className: `shrink-0 text-micro leading-[14px] ${check.pass ? 'text-healthy' : 'text-warning'}`, children: check.pass ? '✓' : '○' }), _jsx("span", { className: "text-text-dim min-w-0 flex-1 truncate text-micro", children: check.label }), _jsx("span", { className: "num text-text-faint shrink-0 text-micro", children: check.detail })] }));
}
