/**
 * The bot bauble's gestures as functions of time, so each one plays from a
 * single clock. Chained timing steps each repeat a frame where one hands off
 * to the next, and restart from rest, which reads as a stutter. These curves
 * join with matching position and speed; only a hop's launch and landing
 * change speed suddenly, and even those never jump in position.
 *
 * Times are in milliseconds. `squash` is one number: positive squashes the
 * tile (shorter and wider), negative stretches it (taller and thinner).
 */

export type SpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
};

/**
 * Where a damped spring is, relative to its rest point, `t` ms after it is let
 * go at offset `x0` with speed `v0` (per ms).
 */
export function springOffset(
  spring: SpringConfig,
  x0: number,
  v0: number,
  t: number
): number {
  'worklet';
  const omega = Math.sqrt(spring.stiffness / spring.mass) / 1000;
  const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  const decay = Math.exp(-zeta * omega * t);
  if (zeta >= 1) {
    return decay * (x0 + (v0 + omega * x0) * t);
  }
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  return (
    decay *
    (x0 * Math.cos(omegaD * t) +
      ((v0 + zeta * omega * x0) / omegaD) * Math.sin(omegaD * t))
  );
}

/** Eases from 0 to 1 and back to rest at both ends. */
export function smoothstep(t: number): number {
  'worklet';
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** A move of the tile's tilt, in degrees. */
export type TiltMove = {
  from: number;
  /** Where to lean before the swing; equal to `from` for no lean. */
  lean: number;
  to: number;
  leanMs: number;
  spring: SpringConfig;
};

/** The tilt `t` ms into a move: an eased lean, then a spring to `to`. */
export function tiltAt(move: TiltMove, t: number): number {
  'worklet';
  if (t < move.leanMs) {
    return move.from + (move.lean - move.from) * smoothstep(t / move.leanMs);
  }
  return (
    move.to + springOffset(move.spring, move.lean - move.to, 0, t - move.leanMs)
  );
}

export const TICK_LEAN_MS = 140;
const TICK_CROUCH = 0.04;

/**
 * A tick's squash: a crouch while the tile leans back, then a springy release
 * that stretches past rest and wobbles in.
 */
export function tickSquashAt(spring: SpringConfig, t: number): number {
  'worklet';
  if (t < TICK_LEAN_MS) {
    return TICK_CROUCH * smoothstep(t / TICK_LEAN_MS);
  }
  return springOffset(spring, TICK_CROUCH, 0, t - TICK_LEAN_MS);
}

export type Hop = {
  /** Height of the jump, in points. */
  height: number;
  /** Scales every beat; below 1 is quicker. */
  tempo: number;
  /** The wobble after landing. */
  settle: SpringConfig;
};

const HOP_CROUCH_MS = 120;
const HOP_RISE_MS = 200;
const HOP_FALL_MS = 170;
const HOP_RELEASE_MS = 70;
const HOP_CROUCH = 0.07;
const HOP_LAUNCH_STRETCH = 0.06;
const HOP_FALL_STRETCH = 0.035;
// How fast the landing squashes the tile, per ms; it peaks near 0.08.
const HOP_IMPACT_SPEED = 0.0029;

function hopBeats(hop: Hop) {
  'worklet';
  const crouch = HOP_CROUCH_MS * hop.tempo;
  const rise = HOP_RISE_MS * hop.tempo;
  const fall = HOP_FALL_MS * hop.tempo;
  return { crouch, rise, fall, land: crouch + rise + fall };
}

/** Milliseconds until a hop touches down; a new hop waits for this. */
export function hopAirtime(hop: Hop): number {
  'worklet';
  return hopBeats(hop).land;
}

/** How far a hop has lifted the tile, in points (negative is up). */
export function hopLiftAt(hop: Hop, t: number): number {
  'worklet';
  const { crouch, rise, fall, land } = hopBeats(hop);
  if (t < crouch || t >= land) return 0;
  if (t < crouch + rise) {
    // Slowing as it climbs.
    const s = (t - crouch) / rise;
    return -hop.height * (1 - (1 - s) * (1 - s));
  }
  // Speeding up as it falls.
  const s = (t - crouch - rise) / fall;
  return -hop.height * (1 - s * s);
}

function hopAirSquash(hop: Hop, t: number): number {
  'worklet';
  const { crouch, rise, fall } = hopBeats(hop);
  // Stretched by speed: most at launch and landing, round at the top.
  const stretch =
    t < crouch + rise
      ? -HOP_LAUNCH_STRETCH * (1 - (t - crouch) / rise)
      : -HOP_FALL_STRETCH * ((t - crouch - rise) / fall);
  // The crouch lets go over a few frames rather than in one.
  const release = smoothstep((t - crouch) / (HOP_RELEASE_MS * hop.tempo));
  return HOP_CROUCH * (1 - release) + stretch * release;
}

/** A hop's squash: crouch, stretch through the air, squash on landing. */
export function hopSquashAt(hop: Hop, t: number): number {
  'worklet';
  const { crouch, land } = hopBeats(hop);
  if (t < 0) return 0;
  if (t < crouch) return HOP_CROUCH * smoothstep(t / crouch);
  if (t < land) return hopAirSquash(hop, t);
  return springOffset(
    hop.settle,
    hopAirSquash(hop, land),
    HOP_IMPACT_SPEED,
    t - land
  );
}
