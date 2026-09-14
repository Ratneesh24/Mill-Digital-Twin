/**
 * THE DAMPING ENGINE. Port of TwinEngine.advance in src/machine/twinEngine.ts.
 *
 * WHY THIS RUNS IN THE BROWSER AND NOT ON THE SERVER. The feed arrives at 10 Hz and the scene
 * renders at 60. Damping server-side and pushing the damped result would still deliver six
 * identical frames followed by a step - visible stepping, exactly what
 * millConfig.visual.dampingHalfLife exists to prevent. So the server sends TARGETS and the scene
 * chases them at render rate.
 *
 * Only continuous values are damped. Direction, animate, stale and the bending null-ness switch
 * immediately: smoothly interpolating "is the feed alive" would be meaningless, and easing
 * bendingNormalised out of null would animate a bend that no tag reports (§7.4).
 */
import { damp } from './config.js';

export class TwinEngine {
  constructor(halfLife) {
    this.halfLife = halfLife;
    this.lastElapsed = 0;

    this.targets = TwinEngine.zeroTargets();
    this.visuals = {
      ...this.targets,
      wrAngle: 0,
      burAngle: 0,
      dtrAngle: 0,
      etrAngle: 0,
      porAngle: 0,
      stripTravel: 0,
      stripTravelEntry: 0,
    };
  }

  static zeroTargets() {
    return {
      direction: 'FORWARD',
      directionSign: 1,
      stripSpeed: 0,
      entryStripSpeed: 0,
      wrRpm: 0,
      burRpm: 0,
      payoffRpm: 0,
      winderRpm: 0,
      rollGap: 0,
      stripThickness: 0,
      entryThickness: 0,
      stripWidth: 0,
      forceNormalised: 0,
      forceEstimated: false,
      entryTensionNormalised: 0,
      exitTensionNormalised: 0,
      dtrRadius: 254,
      etrRadius: 254,
      porRadius: 254,
      bendingNormalised: null,
      animate: false,
      stale: true,
    };
  }

  /** Cheap - just swaps the target set. Called on every feed message, ten times a second. */
  setTargets(targets) {
    this.targets = targets;
  }

  /**
   * Advance the smoothed values. Called once per rendered frame.
   *
   * dt is clamped: a backgrounded tab hands back a multi-second delta on the first frame after
   * focus, which would teleport every damped value and spin the rolls through several turns at
   * once.
   */
  advance(nowSeconds) {
    const dt = this.lastElapsed === 0 ? 1 / 60 : Math.min(nowSeconds - this.lastElapsed, 0.1);
    this.lastElapsed = nowSeconds;

    const t = this.targets;
    const v = this.visuals;
    const hl = this.halfLife;

    // Discrete values switch immediately.
    v.direction = t.direction;
    v.animate = t.animate;
    v.stale = t.stale;
    v.bendingNormalised = t.bendingNormalised;
    v.forceEstimated = t.forceEstimated ?? false;

    v.directionSign = damp(v.directionSign, t.directionSign, hl, dt);
    v.stripSpeed = damp(v.stripSpeed, t.stripSpeed, hl, dt);
    v.entryStripSpeed = damp(v.entryStripSpeed, t.entryStripSpeed, hl, dt);
    v.wrRpm = damp(v.wrRpm, t.wrRpm, hl, dt);
    v.burRpm = damp(v.burRpm, t.burRpm, hl, dt);
    v.payoffRpm = damp(v.payoffRpm, t.payoffRpm, hl, dt);
    v.winderRpm = damp(v.winderRpm, t.winderRpm, hl, dt);
    v.rollGap = damp(v.rollGap, t.rollGap, hl, dt);
    v.stripThickness = damp(v.stripThickness, t.stripThickness, hl, dt);
    v.entryThickness = damp(v.entryThickness, t.entryThickness, hl, dt);
    v.forceNormalised = damp(v.forceNormalised, t.forceNormalised, hl, dt);
    v.entryTensionNormalised = damp(v.entryTensionNormalised, t.entryTensionNormalised, hl, dt);
    v.exitTensionNormalised = damp(v.exitTensionNormalised, t.exitTensionNormalised, hl, dt);

    // Width and coil diameters change slowly. A longer half-life keeps them from jittering on a
    // coarse historian feed, where a 0.2 Hz update would otherwise make the coil pulse.
    v.stripWidth = damp(v.stripWidth, t.stripWidth, hl * 4, dt);
    v.dtrRadius = damp(v.dtrRadius, t.dtrRadius, hl * 4, dt);
    v.etrRadius = damp(v.etrRadius, t.etrRadius, hl * 4, dt);
    v.porRadius = damp(v.porRadius, t.porRadius, hl * 4, dt);

    // Rotation is integrated from the SMOOTHED rpm, so a step change in the feed produces a
    // smooth spin-up rather than a jump in angle.
    if (t.animate) {
      const s = v.directionSign;
      const radiansPerRpmSecond = (2 * Math.PI) / 60;

      v.wrAngle += v.wrRpm * radiansPerRpmSecond * dt * s;
      v.burAngle += v.burRpm * radiansPerRpmSecond * dt * s;

      // Both reels turn the same way in space - two pulleys with the strip between them. What
      // differs is their RATE: the payoff reel runs at entry speed on a shrinking coil, the
      // winder at exit speed on a growing one. Which is which comes from the direction-derived
      // role, never from their position on the line.
      const payoffIsDtr = t.direction === 'REVERSE';
      v.dtrAngle += (payoffIsDtr ? v.payoffRpm : v.winderRpm) * radiansPerRpmSecond * dt * s;
      v.etrAngle += (payoffIsDtr ? v.winderRpm : v.payoffRpm) * radiansPerRpmSecond * dt * s;
      // POR is parked with its brake applied — it does not turn. Its coil diameter still
      // tracks the feed (the coil is physically there), but there is no spin integration.

      v.stripTravel += (v.stripSpeed / 60) * dt * s;
      v.stripTravelEntry += (v.entryStripSpeed / 60) * dt * s;
    }

    return v;
  }
}
