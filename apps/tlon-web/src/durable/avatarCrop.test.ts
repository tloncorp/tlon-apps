import { describe, expect, test } from 'vitest';

import {
  centeredCrop,
  clampCrop,
  maxZoom,
  sourceRect,
  zoomCrop,
} from './avatarCrop';

const landscape = { width: 1000, height: 500 };
const cropSize = 200;

describe('avatar crop', () => {
  test('starts centered with the short side filling the crop', () => {
    const crop = centeredCrop(landscape, cropSize);
    expect(crop).toEqual({ zoom: 1, x: -100, y: 0 });
    const rect = sourceRect(crop, landscape, cropSize);
    expect([rect.x, rect.y + 0, rect.size]).toEqual([250, 0, 500]);
  });

  test('panning stops at the image edges', () => {
    expect(clampCrop({ zoom: 1, x: 50, y: 30 }, landscape, cropSize)).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    });
    expect(
      clampCrop({ zoom: 1, x: -900, y: -30 }, landscape, cropSize)
    ).toEqual({ zoom: 1, x: -200, y: 0 });
  });

  test('zoom stays between covering the crop and the maximum', () => {
    expect(clampCrop({ zoom: 0.2, x: 0, y: 0 }, landscape, cropSize).zoom).toBe(
      1
    );
    expect(clampCrop({ zoom: 9, x: 0, y: 0 }, landscape, cropSize).zoom).toBe(
      maxZoom
    );
  });

  test('zooming keeps the focused point in place', () => {
    const crop = centeredCrop(landscape, cropSize);
    const zoomed = zoomCrop(crop, 2, { x: 100, y: 100 }, landscape, cropSize);
    expect(zoomed).toEqual({ zoom: 2, x: -300, y: -100 });
    // The crop's center showed source pixel (500, 250) before and after.
    const before = sourceRect(crop, landscape, cropSize);
    const after = sourceRect(zoomed, landscape, cropSize);
    expect(before.x + before.size / 2).toBe(500);
    expect(after).toEqual({ x: 375, y: 125, size: 250 });
    expect(after.x + after.size / 2).toBe(500);
    expect(after.y + after.size / 2).toBe(250);
  });

  test('zooming out near an edge clamps back inside the image', () => {
    const zoomed = { zoom: 2, x: 0, y: 0 };
    expect(
      zoomCrop(zoomed, 1, { x: 200, y: 200 }, landscape, cropSize)
    ).toEqual({ zoom: 1, x: 0, y: 0 });
    const out = zoomCrop(
      { zoom: 2, x: -1800, y: -200 },
      1,
      { x: 0, y: 0 },
      landscape,
      cropSize
    );
    expect(out).toEqual({ zoom: 1, x: -200, y: 0 });
    const rect = sourceRect(out, landscape, cropSize);
    expect(rect.x + rect.size).toBe(landscape.width);
    expect(rect.y + rect.size).toBe(landscape.height);
  });
});
