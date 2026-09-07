import { describe, expect, it } from 'vitest';

import {
  assessImageLoadWitness,
  imageGestureDisplacementErrorPt,
  type ImageLoadEvent,
} from './scrollStabilityImageLoad';

const row = 'image-row';
const src = 'http://127.0.0.1:8337/image/unique.png';
const event = (
  time: number,
  name: string,
  values?: ImageLoadEvent['values']
) => ({ time, name, values });
const release = [
  event(110, 'image-release-request', { key: row, src }),
  event(115, 'image-release', { key: row, src }),
  event(140, 'row-layout', { key: row, height: 240 }),
];
const input = {
  gate: {
    key: row,
    src,
    token: 'unique',
    pendingAt: 0,
    requested: true as const,
    released: false as const,
  },
  recordingStartTime: 50,
  baselineHeight: 80,
  baselineComposerHeight: 50,
  propsUnchanged: true,
  measurements: [{ time: 150, height: 240 }],
};

describe('native image causal overlap detector controls', () => {
  it('accepts an acknowledged native load with independently measured changed height', () => {
    expect(assessImageLoadWitness({ ...input, events: release }).observed).toBe(
      true
    );
  });
  it('accepts only actual load inside the real drag interval', () => {
    const result = assessImageLoadWitness({
      ...input,
      interaction: 'gesture',
      events: [event(100, 'drag-begin'), ...release, event(180, 'drag-end')],
    });
    expect(result.observed).toBe(true);
    expect(result.interval).toEqual({ startTime: 100, endTime: 180 });
  });
  it('rejects a load after the drag despite both events occurring in the capture', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'gesture',
        events: [event(70, 'drag-begin'), event(90, 'drag-end'), ...release],
      }).observed
    ).toBe(false);
  });
  it('rejects a release before the drag even if layout happens during it', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'gesture',
        events: [
          ...release.slice(0, 2),
          event(120, 'drag-begin'),
          release[2],
          event(180, 'drag-end'),
        ],
      }).observed
    ).toBe(false);
  });
  it('rejects a drag start with no actual end event', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'gesture',
        events: [event(100, 'drag-begin'), ...release],
      }).observed
    ).toBe(false);
  });
  it('accepts a matching native keyboard transition', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'keyboard',
        events: [
          event(100, 'keyboardWillShow'),
          ...release,
          event(200, 'keyboardDidShow'),
        ],
      }).observed
    ).toBe(true);
  });
  it('rejects mismatched keyboard directions', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'keyboard',
        events: [
          event(100, 'keyboardWillShow'),
          ...release,
          event(200, 'keyboardDidHide'),
        ],
      }).observed
    ).toBe(false);
  });
  it('rejects a load between distinct keyboard cycles', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'keyboard',
        events: [
          event(70, 'keyboardWillShow'),
          event(90, 'keyboardDidShow'),
          ...release,
          event(160, 'keyboardWillHide'),
          event(200, 'keyboardDidHide'),
        ],
      }).observed
    ).toBe(false);
  });
  it('accepts draft input through a contemporaneous height-changing composer layout', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'composer',
        events: [
          event(100, 'composer-input'),
          ...release,
          event(180, 'composer-layout', { height: 80 }),
        ],
      }).observed
    ).toBe(true);
  });
  it('rejects an input event whose composer height never changes', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'composer',
        events: [
          event(100, 'composer-input'),
          ...release,
          event(180, 'composer-layout', { height: 50 }),
        ],
      }).observed
    ).toBe(false);
  });
  it('rejects an arbitrarily delayed composer layout', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'composer',
        events: [
          event(100, 'composer-input'),
          ...release,
          event(300, 'composer-layout', { height: 80 }),
        ],
      }).observed
    ).toBe(false);
  });
  it('does not reuse an earlier input through a superseding input', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'composer',
        events: [
          event(100, 'composer-input'),
          ...release,
          event(160, 'composer-input'),
          event(180, 'composer-layout', { height: 80 }),
        ],
      }).observed
    ).toBe(false);
  });
  it.each([
    ['missing gate', { gate: undefined }],
    ['late gate', { gate: { ...input.gate, pendingAt: 51 } }],
    ['changed post props', { propsUnchanged: false }],
    ['missing baseline', { baselineHeight: undefined }],
    ['missing measured load', { measurements: [] }],
    [
      'unchanged measured height',
      { measurements: [{ time: 150, height: 80 }] },
    ],
    [
      'pre-load measurement only',
      { measurements: [{ time: 130, height: 240 }] },
    ],
  ])('rejects %s', (_label, override) => {
    expect(
      assessImageLoadWitness({ ...input, events: release, ...override })
        .observed
    ).toBe(false);
  });
  it('rejects release success without actual image layout', () => {
    expect(
      assessImageLoadWitness({ ...input, events: release.slice(0, 2) }).observed
    ).toBe(false);
  });
  it('rejects another source or row satisfying the witness', () => {
    const wrongSource = release.map((e) =>
      e.name === 'image-release'
        ? { ...e, values: { key: row, src: 'other' } }
        : e
    );
    const wrongRow = release.map((e) =>
      e.name === 'row-layout'
        ? { ...e, values: { key: 'other', height: 240 } }
        : e
    );
    expect(
      assessImageLoadWitness({ ...input, events: wrongSource }).observed
    ).toBe(false);
    expect(
      assessImageLoadWitness({ ...input, events: wrongRow }).observed
    ).toBe(false);
  });
  it('rejects invalid or out-of-order event time', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        events: [release[1], release[0], release[2]],
      }).observed
    ).toBe(false);
    expect(
      assessImageLoadWitness({
        ...input,
        events: [{ ...release[0], time: NaN }, ...release.slice(1)],
      }).observed
    ).toBe(false);
  });
  it('does not stitch a cancelled keyboard animation to its late completion', () => {
    expect(
      assessImageLoadWitness({
        ...input,
        interaction: 'keyboard',
        events: [
          event(80, 'keyboardWillShow'),
          event(100, 'keyboardWillHide'),
          ...release,
          event(160, 'keyboardDidShow'),
        ],
      }).observed
    ).toBe(false);
  });
  it('accounts for measured image growth above a moving witness without hiding a jump', () => {
    const deltas = {
      rowDelta: -20,
      scrollDelta: 180,
      viewportDelta: 0,
      imageHeightDelta: 160,
      imageBeforeWitness: true,
    };
    expect(imageGestureDisplacementErrorPt(deltas)).toBe(0);
    expect(imageGestureDisplacementErrorPt({ ...deltas, rowDelta: 10 })).toBe(
      30
    );
  });
  it('does not subtract image growth below a witness, and rejects invalid delta evidence', () => {
    const deltas = {
      rowDelta: -20,
      scrollDelta: 20,
      viewportDelta: 0,
      imageHeightDelta: 160,
      imageBeforeWitness: false,
    };
    expect(imageGestureDisplacementErrorPt(deltas)).toBe(0);
    expect(
      imageGestureDisplacementErrorPt({ ...deltas, imageHeightDelta: NaN })
    ).toBeUndefined();
  });
});
