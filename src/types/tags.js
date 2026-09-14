/**
 * TAG MODEL — §7 of the master spec.
 *
 * Every value that reaches a pixel travels as a Tag. The Tag carries not just the
 * number but *where the number came from* (provenance) and *whether it can be
 * trusted right now* (quality). The UI is forbidden from rendering a CALCULATED,
 * SIMULATED or ESTIMATED value with the appearance of a MEASURED one (§7.3), so
 * provenance is a first-class field, not a styling afterthought.
 */
export {};
