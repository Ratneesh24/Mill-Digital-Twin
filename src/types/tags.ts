/**
 * TAG MODEL — §7 of the master spec.
 *
 * Every value that reaches a pixel travels as a Tag. The Tag carries not just the
 * number but *where the number came from* (provenance) and *whether it can be
 * trusted right now* (quality). The UI is forbidden from rendering a CALCULATED,
 * SIMULATED or ESTIMATED value with the appearance of a MEASURED one (§7.3), so
 * provenance is a first-class field, not a styling afterthought.
 */

/**
 * §7.3 provenance contract.
 *
 *  MEASURED   — real PLC / instrument value, GOOD quality
 *  REFERENCE  — setpoint from pass schedule / MMS
 *  CALCULATED — derived from measured values (e.g. gaugemeter thickness)
 *  SIMULATED  — produced by the simulation engine
 *  ESTIMATED  — model fill-in where no instrument exists
 *  UNAVAILABLE— no tag exists on this feed; render "NO TAG", never a number
 */
export type Provenance =
  | 'MEASURED'
  | 'REFERENCE'
  | 'CALCULATED'
  | 'SIMULATED'
  | 'ESTIMATED'
  | 'UNAVAILABLE'

export type TagQuality = 'GOOD' | 'BAD' | 'STALE' | 'SIMULATION' | 'NO_TAG'

export type TagStatus = 'NORMAL' | 'WARNING' | 'ALARM' | 'TRIP' | 'UNKNOWN'

export interface TagLimits {
  low?: number
  high?: number
  warningLow?: number
  warningHigh?: number
  alarmLow?: number
  alarmHigh?: number
  tripHigh?: number
}

export type TagValue = number | string | boolean | null

export interface Tag<T extends TagValue = TagValue> {
  tagName: string
  value: T
  unit?: string
  timestamp: number
  quality: TagQuality
  status: TagStatus
  provenance: Provenance
  limits?: TagLimits
}

/** A single normalised frame from any data source: tagName -> Tag. */
export type TagFrame = Record<string, Tag>

/**
 * How a tag behaves once we leave SIMULATION and face the real CRM04 feed (§7.4).
 *
 *  MEASURED    — the tag genuinely exists in the historian / PLC extract
 *  REFERENCE   — the tag exists and carries an MMS/pass-schedule setpoint
 *  CALCULATED  — no instrument, but a defensible inverse model exists
 *                (e.g. roll gap from the gaugemeter inverse)
 *  ESTIMATED   — no instrument and only a forward model exists
 *                (e.g. roll force from torque + reduction)
 *  UNAVAILABLE — nothing to show. Render "NO TAG". Never animate a fake value.
 *
 * Promoting a tag from ESTIMATED/CALCULATED/UNAVAILABLE to MEASURED once OEM
 * raises PLC sampling is a one-line edit in `tagMap.ts` — no component changes.
 */
export type LiveAvailability =
  | 'MEASURED'
  | 'REFERENCE'
  | 'CALCULATED'
  | 'ESTIMATED'
  | 'UNAVAILABLE'

export interface TagDefinition {
  tagName: string
  description: string
  unit?: string
  /** Provenance to use when the simulation engine is the source. */
  simulationProvenance: Provenance
  /** Provenance/availability once bound to the real 46-tag CRM04 extract (§7.4). */
  liveAvailability: LiveAvailability
  /** Free-text note explaining a non-MEASURED live availability. */
  liveNote?: string
  limits?: TagLimits
  /** Higher-is-worse (true) vs lower-is-worse (false) for limit evaluation. */
  decimals?: number
}
