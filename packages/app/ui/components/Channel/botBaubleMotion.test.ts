import { describe, expect, it } from 'vitest';

import {
  type Hop,
  type SpringConfig,
  TICK_LEAN_MS,
  hopAirtime,
  hopLiftAt,
  hopSquashAt,
  springOffset,
  tickSquashAt,
  tiltAt,
} from './botBaubleMotion';

const FRAME_MS = 1000 / 60;
const ELASTIC: SpringConfig = { damping: 7.8, stiffness: 320, mass: 0.7 };
const SWING: SpringConfig = { damping: 10, stiffness: 220, mass: 0.7 };
const SNAPPY: SpringConfig = { damping: 9, stiffness: 420, mass: 0.7 };
const replyHop: Hop = { height: 4, tempo: 0.8, settle: SNAPPY };
const toolHop: Hop = { height: 6, tempo: 1, settle: ELASTIC };

function frames(curve: (t: number) => number, durationMs: number) {
  const values: number[] = [];
  for (let t = 0; t <= durationMs; t += FRAME_MS) values.push(curve(t));
  return values;
}

function largestStep(values: number[]) {
  let largest = 0;
  for (let i = 1; i < values.length; i++) {
    largest = Math.max(largest, Math.abs(values[i] - values[i - 1]));
  }
  return largest;
}

describe('springOffset', () => {
  it('starts where it is let go and comes to rest', () => {
    expect(springOffset(ELASTIC, 0.05, 0, 0)).toBeCloseTo(0.05, 6);
    expect(Math.abs(springOffset(ELASTIC, 0.05, 0, 2000))).toBeLessThan(1e-4);
  });

  it('overshoots rest when underdamped', () => {
    const values = frames((t) => springOffset(ELASTIC, 1, 0, t), 600);
    expect(Math.min(...values)).toBeLessThan(-0.3);
  });
});

describe('tiltAt', () => {
  const tick = { from: -2.5, lean: -1, to: 2.5, leanMs: TICK_LEAN_MS };

  it('joins the lean and the swing without a jump', () => {
    const move = { ...tick, spring: SWING };
    const before = tiltAt(move, TICK_LEAN_MS - 0.01);
    const after = tiltAt(move, TICK_LEAN_MS + 0.01);
    expect(Math.abs(after - before)).toBeLessThan(0.001);
  });

  it('moves a little each frame and settles on its target', () => {
    const move = { ...tick, spring: SWING };
    const values = frames((t) => tiltAt(move, t), 1200);
    // A 3.5° swing spread over several frames, not taken in one.
    expect(largestStep(values)).toBeLessThan(0.8);
    expect(values[values.length - 1]).toBeCloseTo(2.5, 2);
  });
});

describe('tickSquashAt', () => {
  it('crouches, stretches past rest, and settles', () => {
    const values = frames((t) => tickSquashAt(ELASTIC, t), 1200);
    expect(values[0]).toBe(0);
    expect(Math.max(...values)).toBeCloseTo(0.04, 3);
    expect(Math.min(...values)).toBeLessThan(-0.01);
    expect(largestStep(values)).toBeLessThan(0.01);
    expect(Math.abs(values[values.length - 1])).toBeLessThan(0.001);
  });
});

describe('hop', () => {
  for (const [name, hop] of [
    ['reply', replyHop],
    ['tool call', toolHop],
  ] as const) {
    describe(`${name} hop`, () => {
      const lift = frames((t) => hopLiftAt(hop, t), 1500);
      const squash = frames((t) => hopSquashAt(hop, t), 1500);

      it('rises to its height and comes back down', () => {
        expect(Math.min(...lift)).toBeCloseTo(-hop.height, 0);
        expect(lift[0]).toBe(0);
        expect(lift[lift.length - 1]).toBe(0);
        expect(largestStep(lift)).toBeLessThan(hop.height / 4);
      });

      it('never jumps in squash, even at launch and landing', () => {
        expect(largestStep(squash)).toBeLessThan(0.05);
      });

      it('stretches in the air and squashes on landing', () => {
        const land = Math.ceil(hopAirtime(hop) / FRAME_MS);
        expect(Math.min(...squash.slice(0, land))).toBeLessThan(-0.03);
        expect(Math.max(...squash.slice(land))).toBeGreaterThan(0.06);
        expect(Math.max(...squash.slice(land))).toBeLessThan(0.1);
        expect(Math.abs(squash[squash.length - 1])).toBeLessThan(0.002);
      });
    });
  }
});
