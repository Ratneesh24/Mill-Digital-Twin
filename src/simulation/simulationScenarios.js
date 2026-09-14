/**
 * SIMULATION SCENARIOS — the operating conditions the twin can be driven into
 * so the §17 validation tests are exercisable from the UI.
 *
 * A scenario is a set of MODIFIERS applied to the physics inputs, never a set
 * of fake outputs. Selecting HIGH_FORCE does not write a large number into the
 * force display — it closes the gap and stiffens the material, and the force
 * that results comes out of the same equations as always. That distinction is
 * the whole point: the twin must stay one coherent machine (§18) even while
 * being deliberately disturbed.
 */
import { engineeringConfig } from '../config/engineeringConfig';
const BASE = {
    flowStressScale: 1,
    gapOffsetMm: 0,
    forceScale: 1,
    agcEnabled: true,
    gaugeReady: true,
    hydraulicPressureFactor: 1,
    // Bending IS instrumented on the simulated mill (74-tag model). It becomes
    // NO TAG only in the 46-tag live profile, which is a tag-map decision, not a
    // scenario one.
    bendingForceKN: 320,
    bendingPressureBar: 145,
};
export const SCENARIOS = [
    {
        id: 'NORMAL',
        label: 'Normal production',
        description: 'Schedule followed, AGC closed, all media healthy.',
    },
    {
        id: 'HIGH_FORCE',
        label: 'High rolling force',
        description: 'Material 22% harder than the schedule assumed. AGC holds the delivered thickness, so the extra resistance shows up as force — which is what a real mill does. Force rises through the warning band by physics, not by injection.',
        validates: 'Test 7 — high force',
    },
    {
        id: 'THICKNESS_EXCURSION',
        label: 'Thickness excursion',
        description: 'Gap disturbed by +0.05 mm with AGC unable to fully reject it.',
        validates: 'Test 7 — thickness deviation alarm',
    },
    {
        id: 'AGC_OFF',
        label: 'AGC off (position mode)',
        description: 'HAGC loop opened. Incoming hot-band variation passes straight through to the exit gauge.',
    },
    {
        id: 'HYDRAULIC_LOW',
        label: 'Hydraulic pressure low',
        description: 'HAGC loading pressure collapses below the alarm limit; the interlock chain drops.',
    },
    {
        id: 'GAUGE_NOT_READY',
        label: 'ETR gauge not ready',
        description: 'X-ray gauge drops out of ready — MILL NOT READY names the gauge as the cause.',
        validates: 'Test 7 / §13.2 named-cause interlock',
    },
    {
        id: 'COMMUNICATION_LOSS',
        label: 'Communication loss',
        description: 'The simulated PLC stops publishing. Values go STALE, the twin stops animating and the last valid timestamp is held.',
        validates: 'Test 8 — communication loss',
    },
    {
        id: 'EMERGENCY_STOP',
        label: 'Emergency stop',
        description: 'E-stop asserted. Fast-stop ramp, status FAST STOP, alarm raised.',
        validates: 'Test 6 — fast stop',
    },
];
export function applyScenario(id) {
    switch (id) {
        case 'HIGH_FORCE':
            // Harder material only. The force that results is computed by the same
            // equations as always — never asserted.
            return { ...BASE, flowStressScale: 1.22 };
        case 'THICKNESS_EXCURSION':
            return { ...BASE, gapOffsetMm: 0.05, agcEnabled: false };
        case 'AGC_OFF':
            return { ...BASE, agcEnabled: false };
        case 'HYDRAULIC_LOW':
            return {
                ...BASE,
                hydraulicPressureFactor: engineeringConfig.hydraulicPressureMin /
                    engineeringConfig.hydraulicPressureAtMaxForce * 0.8,
            };
        case 'GAUGE_NOT_READY':
            return { ...BASE, gaugeReady: false };
        case 'COMMUNICATION_LOSS':
        case 'EMERGENCY_STOP':
        case 'NORMAL':
        default:
            return BASE;
    }
}
export function getScenario(id) {
    return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
