import { describe, expect, test } from 'vitest';

import { CHAT_IMAGE_MAX_WINDOW_HEIGHT_FRACTION } from '../../../constants';
import { resolveImageFit, resolveImageMaxHeight } from './imageSizing';

const chatCap = (windowHeight: number) =>
  resolveImageMaxHeight({
    windowHeight,
    maxWindowHeightFraction: CHAT_IMAGE_MAX_WINDOW_HEIGHT_FRACTION,
  });

// Device shapes the app runs at: window height, and the width of the message
// column inside it.
const DEVICES = [
  { name: 'iPhone SE', windowHeight: 667, column: 320 },
  { name: 'iPhone 17', windowHeight: 874, column: 330 },
  { name: 'iPad 12.9 portrait', windowHeight: 1366, column: 750 },
  { name: 'iPad 12.9 landscape', windowHeight: 1024, column: 1000 },
];

const IMAGES = [
  { name: 'landscape photo', width: 4032, height: 3024 },
  { name: 'portrait photo', width: 3024, height: 4032 },
  { name: 'phone screenshot', width: 1206, height: 2622 },
  { name: '21:9 screenshot', width: 1080, height: 2520 },
  { name: 'full-page screenshot', width: 1200, height: 9000 },
  { name: 'narrow but short', width: 120, height: 400 },
];

const fitInChat = (
  image: { width: number; height: number },
  device: { windowHeight: number; column: number }
) =>
  resolveImageFit({
    availableWidth: device.column,
    maxHeight: chatCap(device.windowHeight),
    naturalAspectRatio: image.width / image.height,
    naturalPixelWidth: image.width,
  })!;

const cross = DEVICES.flatMap((device) =>
  IMAGES.map(
    (image) => [`${image.name} on ${device.name}`, image, device] as const
  )
);

describe('resolveImageMaxHeight', () => {
  test('imposes no cap when the caller sets no fraction', () => {
    expect(resolveImageMaxHeight({ windowHeight: 874 })).toBeUndefined();
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'imposes no cap on a nonsense window height (%p)',
    (windowHeight) => {
      expect(chatCap(windowHeight)).toBeUndefined();
    }
  );

  test.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'imposes no cap on a nonsense fraction (%p)',
    (maxWindowHeightFraction) => {
      expect(
        resolveImageMaxHeight({ windowHeight: 874, maxWindowHeightFraction })
      ).toBeUndefined();
    }
  );
});

describe('resolveImageFit', () => {
  test('declines to size anything until the column has been measured', () => {
    expect(
      resolveImageFit({
        availableWidth: null,
        maxHeight: 743,
        naturalAspectRatio: 0.46,
      })
    ).toBeNull();
  });

  test('declines when the caller set no cap, however tall the image', () => {
    expect(
      resolveImageFit({
        availableWidth: 330,
        naturalAspectRatio: 1200 / 9000,
      })
    ).toBeNull();
  });

  test.each([null, 0, Number.NaN, Number.POSITIVE_INFINITY, -2])(
    'declines on a nonsense ratio (%p)',
    (naturalAspectRatio) => {
      expect(
        resolveImageFit({
          availableWidth: 330,
          maxHeight: 743,
          naturalAspectRatio: naturalAspectRatio as number | null,
        })
      ).toBeNull();
    }
  );

  test.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'declines on a nonsense cap (%p)',
    (maxHeight) => {
      expect(
        resolveImageFit({
          availableWidth: 330,
          maxHeight,
          naturalAspectRatio: 0.46,
        })
      ).toBeNull();
    }
  );

  test.each([0, -10, Number.NaN])(
    'declines on a nonsense column width (%p)',
    (availableWidth) => {
      expect(
        resolveImageFit({
          availableWidth,
          maxHeight: 743,
          naturalAspectRatio: 0.46,
        })
      ).toBeNull();
    }
  );

  test.each([undefined, null, 0])(
    'ignores an unknown pixel width (%p) and uses the other limits',
    (naturalPixelWidth) => {
      expect(
        resolveImageFit({
          availableWidth: 330,
          maxHeight: 743,
          naturalAspectRatio: 4 / 3,
          naturalPixelWidth,
        })
      ).toEqual({ width: 330, height: 330 / (4 / 3) });
    }
  );

  test('a tiny image is held to its own pixel width, not stretched to the column', () => {
    expect(
      resolveImageFit({
        availableWidth: 330,
        maxHeight: 743,
        naturalAspectRatio: 1,
        naturalPixelWidth: 40,
      })
    ).toEqual({ width: 40, height: 40 });
  });

  // The whole point of the cap: no image may make a row taller than its window.
  test.each(cross)('%s is bounded by the window', (_n, image, device) => {
    expect(fitInChat(image, device).height).toBeLessThanOrEqual(
      chatCap(device.windowHeight)!
    );
  });

  // And the cap must do it by fitting, never by cropping or distorting.
  test.each(cross)('%s keeps its proportions', (_n, image, device) => {
    const { width, height } = fitInChat(image, device);
    expect(width / height).toBeCloseTo(image.width / image.height, 5);
  });

  test.each(cross)(
    '%s is never upscaled past its own pixels',
    (_n, image, device) => {
      expect(fitInChat(image, device).width).toBeLessThanOrEqual(image.width);
    }
  );

  test.each(cross)('%s never overflows its column', (_n, image, device) => {
    expect(fitInChat(image, device).width).toBeLessThanOrEqual(device.column);
  });

  test('uses the full column when the image is not the binding constraint', () => {
    // A landscape photo on a phone: short enough that only the column limits it.
    expect(fitInChat(IMAGES[0], DEVICES[1]).width).toBe(330);
  });

  test('narrows a tall image rather than cropping it', () => {
    // A portrait photo across a 1000pt tablet column would stand 1333pt tall;
    // fitting keeps all of it by rendering it narrower instead.
    const { width, height } = fitInChat(IMAGES[1], DEVICES[3]);
    expect(height).toBeLessThanOrEqual(chatCap(1024)!);
    expect(width).toBeLessThan(1000);
  });
});
