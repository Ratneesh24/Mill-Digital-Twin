/**
 * INTERLOCK ENGINE — §13.2 of the master spec.
 *
 *   DRIVE ✓ -> HYDRAULIC ✓ -> TENSION ✓ -> GAUGE ✓ -> MILL READY ✓
 *
 *   MILL READY = Drive Ready AND Hydraulic Ready AND Tension Ready
 *                AND Gauge Ready AND NOT E-Stop AND NOT critical interlock
 *
 * On failure the chain NAMES THE CAUSE. A bare "MILL NOT READY" is explicitly
 * forbidden, so `blockingReason` is always populated when the mill is not ready.
 *
 * THREE STATES, NOT TWO. A link can be OK, BLOCKED, or NO_TAG — because on the
 * CRM04 46-tag feed there are no interlock status words at all (§7.4). Reporting
 * "MAIN DRIVE NOT READY" when the truth is "nothing on this feed tells us"
 * would be exactly the plausible-looking falsehood the provenance contract
 * exists to prevent. The mill is still held not-ready, because a mill whose
 * interlocks cannot be verified must not be treated as ready — but the operator
 * is told which of the two situations they are in.
 */

import type { InterlockChain, InterlockNode } from '../types/alarms'

/** `null` means the active feed carries no tag for this link. */
export interface InterlockInputs {
  driveReady: boolean | null
  hydraulicReady: boolean | null
  tensionReady: boolean | null
  gaugeReady: boolean | null
  emergencyStop: boolean | null
  fastStop: boolean | null
  /** True when the data feed is stale — a stale feed cannot arm the mill (§14.5). */
  communicationHealthy: boolean
}

interface NodeSpec {
  id: string
  label: string
  /** Value that means "this link is satisfied". */
  ok: boolean | null
  /** Reason text when the value is definitively bad. */
  blockedReason: string
  /** Name used in the "no tag" reason. */
  tagLabel: string
}

function buildNode(spec: NodeSpec): InterlockNode {
  if (spec.ok === null) {
    return {
      id: spec.id,
      label: spec.label,
      ok: false,
      reason: `${spec.tagLabel} — NO TAG ON THIS FEED`,
    }
  }
  return {
    id: spec.id,
    label: spec.label,
    ok: spec.ok,
    reason: spec.ok ? '' : spec.blockedReason,
  }
}

/**
 * Evaluate the chain in ORDER. The first failing link is the blocking reason,
 * because on a real mill that is the one the operator has to go and fix — the
 * downstream links are usually failing *because* of it.
 *
 * A definitively BLOCKED link outranks a missing one: if the drive is genuinely
 * faulted and the gauge status simply has no tag, the fault is what matters.
 */
export function evaluateInterlocks(inputs: InterlockInputs): InterlockChain {
  const nodes: InterlockNode[] = [
    buildNode({
      id: 'ESTOP',
      label: 'EMERGENCY STOP',
      ok: inputs.emergencyStop === null ? null : !inputs.emergencyStop,
      blockedReason: 'EMERGENCY STOP ACTIVE',
      tagLabel: 'EMERGENCY STOP STATUS',
    }),
    buildNode({
      id: 'FAST_STOP',
      label: 'FAST STOP',
      ok: inputs.fastStop === null ? null : !inputs.fastStop,
      blockedReason: 'FAST STOP ACTIVE',
      tagLabel: 'FAST STOP STATUS',
    }),
    buildNode({
      id: 'COMMS',
      label: 'DATA FEED',
      ok: inputs.communicationHealthy,
      blockedReason: 'DATA FEED STALE OR LOST',
      tagLabel: 'DATA FEED',
    }),
    buildNode({
      id: 'DRIVE',
      label: 'DRIVE READY',
      ok: inputs.driveReady,
      blockedReason: 'MAIN DRIVE NOT READY',
      tagLabel: 'MAIN DRIVE READY',
    }),
    buildNode({
      id: 'HYDRAULIC',
      label: 'HYDRAULIC READY',
      ok: inputs.hydraulicReady,
      blockedReason: 'HYDRAULIC SYSTEM NOT READY',
      tagLabel: 'HYDRAULIC READY',
    }),
    buildNode({
      id: 'TENSION',
      label: 'TENSION READY',
      ok: inputs.tensionReady,
      blockedReason: 'REEL TENSION NOT READY',
      tagLabel: 'REEL TENSION READY',
    }),
    buildNode({
      id: 'GAUGE',
      label: 'GAUGE READY',
      ok: inputs.gaugeReady,
      blockedReason: 'ETR GAUGE NOT READY',
      tagLabel: 'GAUGE READY',
    }),
  ]

  // A genuinely blocked link is reported ahead of a merely unknown one.
  const definitelyBlocked = nodes.find((n) => !n.ok && !n.reason.endsWith('NO TAG ON THIS FEED'))
  const firstFailure = definitelyBlocked ?? nodes.find((n) => !n.ok)

  return {
    nodes,
    millReady: !firstFailure,
    blockingReason: firstFailure ? firstFailure.reason : null,
  }
}

/**
 * Formatted two-line readout for the interlock panel (§13.2).
 *
 * "MILL READY UNVERIFIED" rather than "MILL NOT READY" when the only thing
 * stopping it is a missing tag: the mill may well be ready, we simply cannot
 * see it from here. Both are held as not-ready by `millReady`.
 */
export function interlockReadout(chain: InterlockChain): {
  title: string
  reason: string | null
  unverified: boolean
} {
  if (chain.millReady) return { title: 'MILL READY', reason: null, unverified: false }

  const unverified = chain.blockingReason?.endsWith('NO TAG ON THIS FEED') ?? false
  return {
    title: unverified ? 'MILL READY UNVERIFIED' : 'MILL NOT READY',
    reason: `Reason: ${chain.blockingReason ?? 'UNKNOWN INTERLOCK'}`,
    unverified,
  }
}
