/** Alarm & interlock types — §13. */

export type AlarmSeverity = 'INFO' | 'WARNING' | 'ALARM' | 'TRIP'

export interface Alarm {
  id: string
  timestamp: number
  severity: AlarmSeverity
  /** Human-readable parameter name, e.g. "Rolling force". */
  parameter: string
  /** Tag the rule watches — lets the UI highlight the affected section. */
  tagName: string
  actualValue: number
  limit: number
  unit: string
  message: string
  acknowledged: boolean
  active: boolean
  /** When the alarm cleared, if it has. */
  clearedAt?: number
  /** Twin section to highlight when this alarm is active (§17 test 7). */
  section?: TwinSection
}

/** Named regions of the 3D twin that an alarm can highlight. */
export type TwinSection =
  | 'STAND'
  | 'ROLL_BITE'
  | 'ENTRY_REEL'
  | 'EXIT_REEL'
  | 'HYDRAULICS'
  | 'DRIVE'
  | 'GAUGE_ENTRY'
  | 'GAUGE_EXIT'
  | 'STRIP'

export interface AlarmRuleContext {
  value: number
  limit: number
}

export interface AlarmRule {
  id: string
  tagName: string
  parameter: string
  severity: AlarmSeverity
  unit: string
  section?: TwinSection
  /** Returns the limit that was violated, or null when the rule is satisfied. */
  evaluate: (value: number, limits: AlarmLimitLookup) => number | null
  message: (ctx: AlarmRuleContext) => string
  /** Rule only armed while the mill is in one of these states (empty = always). */
  armedStates?: string[]
}

export type AlarmLimitLookup = {
  forceWarning: number
  forceAlarm: number
  forceTrip: number
  thicknessToleranceUm: number
  hydraulicPressureMin: number
  entryTensionMin: number
  entryTensionMax: number
  exitTensionMin: number
  exitTensionMax: number
  currentMax: number
  staleAfterMs: number
}

export interface InterlockNode {
  id: string
  label: string
  ok: boolean
  /** Why it is not OK. Never show a bare "NOT READY" (§13.2). */
  reason: string
}

export interface InterlockChain {
  nodes: InterlockNode[]
  millReady: boolean
  /** First failing node, used for the "Reason: …" line. */
  blockingReason: string | null
}
