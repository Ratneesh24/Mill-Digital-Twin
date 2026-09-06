/**
 * Coil and pass-schedule types.
 *
 * The pass schedule is the REFERENCE source (§7.3): every setpoint the mill
 * follows for a pass — gap, speed, tensions, target thickness — originates here
 * and is badged REF wherever it is displayed.
 */

export interface CoilData {
  id: string
  grade: string
  /** Strip width, mm. */
  width: number
  /** As-charged (hot band) thickness, mm. */
  entryThickness: number
  /** Final thickness after the last scheduled pass, mm. */
  finalThickness: number
  /** Charged coil mass, t. */
  mass: number
  /** Inner diameter (mandrel), mm. */
  innerDiameter: number
  /** As-charged outside diameter, mm. */
  outerDiameter: number
}

export interface PassScheduleEntry {
  pass: number
  /** Rolling direction for this pass. Pass 1 is FORWARD by convention. */
  direction: 'FORWARD' | 'REVERSE'
  /** Input thickness, mm. */
  inputThickness: number
  /** Output thickness reference, mm. */
  outputThickness: number
  /** Scheduled reduction, % (derived — kept explicit for display parity with MMS). */
  reduction: number
  /** Mill speed reference, m/min. */
  speedReference: number
  /** Entry (back) specific tension reference, N/mm². */
  entrySpecificTension: number
  /** Exit (front) specific tension reference, N/mm². */
  exitSpecificTension: number
  /** Predicted roll separating force from the schedule, t. */
  predictedForce: number
}

export interface PassSchedule {
  coil: CoilData
  passes: PassScheduleEntry[]
  /** Where this schedule came from — ABP / plant pass-schedule system (§2). */
  source: string
}
