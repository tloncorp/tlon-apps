import { describe, expect, test } from 'vitest';

import { CHAT_IMAGE_MAX_WINDOW_HEIGHT_FRACTION } from '../../../constants';
import {
  resolveConstrainedImageSize,
  resolveImageMaxHeight,
  shouldMeasureColumn,
} from './imageSizing';

const PHONE = { windowWidth: 402, windowHeight: 874, column: 330 };
const TABLET = { windowWidth: 1024, windowHeight: 1024, column: 1000 };

const PHOTO = { width: 4032, height: 3024 }; // landscape, short
const SCREENSHOT = { width: 1206, height: 2622 }; // tall, the common case
const LONG = { width: 1200, height: 9000 }; // what the cap exists for
const SMALL = { width: 120, height: 400 }; // tall ratio, but short anyway

type Device = typeof PHONE;
type Image = typeof PHOTO;

const capFor = (windowHeight: number) =>
  resolveImageMaxHeight({
    windowHeight,
    maxWindowHeightFraction: CHAT_IMAGE_MAX_WINDOW_HEIGHT_FRACTION,
  });

const measures = (image: Image, device: Device) =>
  shouldMeasureColumn({
    windowWidth: device.windowWidth,
    maxHeight: capFor(device.windowHeight),
    naturalAspectRatio: image.width / image.height,
    naturalPixelWidth: image.width,
  });

const fit = (image: Image, device: Device) =>
  resolveConstrainedImageSize({
    maxWidth: device.column,
    maxHeight: capFor(device.windowHeight),
    naturalAspectRatio: image.width / image.height,
    naturalPixelWidth: image.width,
  })!;

describe('resolveImageMaxHeight', () => {
  test('no fraction means no cap', () => {
    expect(resolveImageMaxHeight({ windowHeight: 874 })).toBeUndefined();
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'nonsense input (%p) means no cap',
    (n) => {
      expect(capFor(n)).toBeUndefined();
      expect(
        resolveImageMaxHeight({ windowHeight: 874, maxWindowHeightFraction: n })
      ).toBeUndefined();
    }
  );
});

// This gate keeps the probe, the extra layout pass and the state update off the
// images that never needed them.
describe('shouldMeasureColumn', () => {
  test.each([
    ['a short image, which no column can stretch past the cap', PHOTO, false],
    ['a small image, held to its own pixels', SMALL, false],
    ['the tall image the cap exists for', LONG, true],
  ])('%s', (_label, image, expected) => {
    expect(measures(image as Image, PHONE)).toBe(expected);
    expect(measures(image as Image, TABLET)).toBe(expected);
  });

  test('nothing is measured with no cap, or before dimensions are known', () => {
    const tall = { windowWidth: 402, naturalAspectRatio: 1200 / 9000 };
    expect(shouldMeasureColumn(tall)).toBe(false);
    expect(
      shouldMeasureColumn({ ...tall, maxHeight: 743, naturalAspectRatio: null })
    ).toBe(false);
  });

  test('never skips an image the fit would have shrunk', () => {
    // The contract the gate rests on: skipping is only safe when the image fits
    // at its widest, so anything skipped must be left alone by the fit.
    for (const device of [PHONE, TABLET]) {
      for (const image of [PHOTO, SCREENSHOT, LONG, SMALL]) {
        if (measures(image, device)) continue;
        expect(fit(image, device).width).toBe(
          Math.min(device.column, image.width)
        );
      }
    }
  });
});

describe('resolveConstrainedImageSize', () => {
  test.each([
    ['no width limit', { maxHeight: 743, naturalAspectRatio: 0.46 }],
    ['no height limit', { maxWidth: 330, naturalAspectRatio: 0.46 }],
    [
      'no ratio yet',
      { maxWidth: 330, maxHeight: 743, naturalAspectRatio: null },
    ],
    [
      'a nonsense limit',
      { maxWidth: 0, maxHeight: 743, naturalAspectRatio: 0.46 },
    ],
  ])('declines to size anything with %s', (_label, args) => {
    expect(resolveConstrainedImageSize(args)).toBeNull();
  });

  test('fixed-cap callers keep their box, and may still scale an image up', () => {
    expect(
      resolveConstrainedImageSize({
        maxWidth: 600,
        maxHeight: 400,
        naturalAspectRatio: 1,
      })
    ).toEqual({ width: 400, height: 400 });
  });

  test('the measured path holds an image to its own pixels instead', () => {
    expect(
      resolveConstrainedImageSize({
        maxWidth: 600,
        maxHeight: 400,
        naturalAspectRatio: 1,
        naturalPixelWidth: 100,
      })
    ).toEqual({ width: 100, height: 100 });
  });

  test('a tall image is narrowed to fit, never cropped or distorted', () => {
    const { width, height } = fit(LONG, PHONE);
    expect(height).toBeLessThanOrEqual(capFor(PHONE.windowHeight)!);
    expect(width).toBeLessThan(PHONE.column);
    expect(width / height).toBeCloseTo(LONG.width / LONG.height, 5);
  });

  test('a screenshot fills the column on a phone, and narrows on a wide one', () => {
    expect(fit(SCREENSHOT, PHONE).width).toBe(PHONE.column);
    // 1206x2622 across a 1000pt column would otherwise stand 2174pt tall.
    const onTablet = fit(SCREENSHOT, TABLET);
    expect(onTablet.height).toBeLessThanOrEqual(capFor(TABLET.windowHeight)!);
    expect(onTablet.width).toBeLessThan(TABLET.column);
  });
});
