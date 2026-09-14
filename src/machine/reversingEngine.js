/**
 * REVERSING ENGINE — §9 of the master spec.
 *
 * "Reversing sequence (no instant flip): speed ramps to zero -> all motion stops
 *  -> direction flag changes -> entry/exit roles swap -> reel rotation directions
 *  swap -> strip accelerates the other way -> direction indicator updates."
 *
 * This module owns that sequence and nothing else. It is a pure sequencer: it is
 * told how much time has passed and what the mill is doing, and it reports which
 * phase of the reversal is active. The simulation engine applies the phase; the
 * state machine owns the status.
 *
 * Entry/exit are LOGICAL ROLES derived from direction (§1). The role mapping
 * lives here, and it is the only place in the codebase that decides which
 * physical reel is currently the payoff and which is the tension reel.
 */
/**
 * Reversal dwell times. These are SEQUENCE timings, not physics — they stand in
 * for the real mill's brake settling, reel role handover and gap prepositioning.
 * Documented as assumptions in docs/ASSUMPTIONS.md.
 */
export const REVERSAL_TIMINGS = {
    settle: 1.6,
    reposition: 2.2,
};
export const initialReversalState = {
    phase: 'NONE',
    elapsed: 0,
    pendingDirection: null,
};
export function startReversal(currentDirection, nextDirection) {
    return {
        phase: 'SETTLE',
        elapsed: 0,
        pendingDirection: nextDirection ?? oppositeDirection(currentDirection),
    };
}
export function oppositeDirection(direction) {
    return direction === 'FORWARD' ? 'REVERSE' : 'FORWARD';
}
/**
 * Advance the sequence.
 *
 * `speed` is passed in so the sequence physically cannot advance while the mill
 * is still moving — the "no instant flip" rule is enforced here rather than
 * trusted to the caller.
 */
export function stepReversal(state, dt, speed, timings = REVERSAL_TIMINGS) {
    if (state.phase === 'NONE' || state.phase === 'COMPLETE')
        return state;
    // Hard guard: no phase of a reversal runs while the strip is moving.
    if (Math.abs(speed) > 0.05) {
        return { ...state, phase: 'SETTLE', elapsed: 0 };
    }
    const elapsed = state.elapsed + dt;
    switch (state.phase) {
        case 'SETTLE':
            if (elapsed >= timings.settle) {
                return { ...state, phase: 'FLIP', elapsed: 0 };
            }
            return { ...state, elapsed };
        case 'FLIP':
            // FLIP is consumed by the simulation engine in a single tick — it applies
            // the direction change and role swap, then the sequence moves on.
            return { ...state, phase: 'REPOSITION', elapsed: 0 };
        case 'REPOSITION':
            if (elapsed >= timings.reposition) {
                return { ...state, phase: 'COMPLETE', elapsed: 0 };
            }
            return { ...state, elapsed };
        default:
            return state;
    }
}
/** Progress through the whole sequence, 0..1 — drives the reversal indicator. */
export function reversalProgress(state, timings = REVERSAL_TIMINGS) {
    const total = timings.settle + timings.reposition;
    switch (state.phase) {
        case 'NONE':
            return 0;
        case 'SETTLE':
            return Math.min(state.elapsed / total, 1);
        case 'FLIP':
            return timings.settle / total;
        case 'REPOSITION':
            return Math.min((timings.settle + state.elapsed) / total, 1);
        case 'COMPLETE':
            return 1;
    }
}
// ---------------------------------------------------------------------------
// LOGICAL ROLE DERIVATION — §1: "Entry/exit are logical roles derived from
// direction, never hardcoded to left/right."
// ---------------------------------------------------------------------------
/**
 * Which physical reel is upstream (paying off) for a given direction.
 *
 * Geometric convention used throughout the twin, following the OEM line layout
 * (FPE manual §3: POR -> pinch roll/flattener -> ETR -> entry deflector -> MILL
 * -> delivery deflector -> DTR):
 *
 *   ETR is the ENTRY tension reel. It sits on the -X side of the stand, sharing
 *   that side with the pay-off reel and the pinch roll cum flattener, which are
 *   outboard of it.
 *   DTR is the DELIVERY tension reel, alone on the +X side.
 *   FORWARD is the first pass: the strip travels -X -> +X, so ETR pays off and
 *   DTR winds. REVERSE is +X -> -X, so DTR pays off and ETR winds.
 *
 * The mill hand is right to left (§1.1). The default camera looks in from +X/+Z,
 * which renders -X on screen-right, so FORWARD reads right-to-left on screen as
 * it does on the shop floor.
 *
 * Everything else — labels in the 3D scene, which reel's diameter grows, which
 * tension is "entry" — is derived from this one function.
 */
export function payoffReel(direction) {
    return direction === 'FORWARD' ? 'ETR' : 'DTR';
}
export function tensionReel(direction) {
    return direction === 'FORWARD' ? 'DTR' : 'ETR';
}
export function reelRole(reel, direction) {
    if (payoffReel(direction) === reel)
        return 'PAYOFF';
    if (tensionReel(direction) === reel)
        return 'TENSION';
    return 'IDLE';
}
/**
 * Sign of motion along the pass line for a direction.
 * +1 = strip travels towards +X, -1 = towards -X. Used by every animated
 * element in the scene so a direction change reverses all of them together.
 */
export function directionSign(direction) {
    return direction === 'FORWARD' ? 1 : -1;
}
/** Scene-space X position of the entry side for a direction. */
export function entrySideX(direction, distance) {
    return direction === 'FORWARD' ? -distance : distance;
}
/** Scene-space X position of the exit side for a direction. */
export function exitSideX(direction, distance) {
    return direction === 'FORWARD' ? distance : -distance;
}
