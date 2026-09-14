/**
 * CENTRAL MACHINE STATE — §6 of the master spec.
 *
 * There is exactly ONE authoritative MachineState object in the application.
 * Components subscribe to it; they never compute their own version of a value.
 * MachineState is a pure *projection* of the current TagFrame produced by
 * `communication/dataAdapter.ts` — it is never mutated from a component.
 */
export {};
