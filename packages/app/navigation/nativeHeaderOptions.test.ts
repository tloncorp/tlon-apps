import { describe, expect, it, vi } from 'vitest';

import { getNativeHeaderScrollOptions } from './nativeHeaderOptions';

vi.mock('@tloncorp/ui', () => ({
  mobileTypeStyles: {
    '$label/2xl': { fontSize: 17, fontWeight: '500' },
  },
}));

describe('native header options', () => {
  it('configures iOS scroll chrome independently of the header model', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: 26,
        liquidGlassAvailable: true,
      })
    ).toMatchObject({
      headerTransparent: true,
      scrollEdgeEffects: {
        top: 'soft',
        bottom: 'hidden',
        left: 'hidden',
        right: 'hidden',
      },
    });
  });

  it('lets conversations expose their bottom scroll edge', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: 26,
        liquidGlassAvailable: true,
        bottomEdgeEffect: 'soft',
      }).scrollEdgeEffects
    ).toMatchObject({ top: 'soft', bottom: 'soft' });
  });

  it('keeps the standard opaque header before iOS 26', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: 18,
        liquidGlassAvailable: true,
      })
    ).toEqual({});
  });

  it('keeps the standard opaque header when Liquid Glass is unavailable', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: 26,
        liquidGlassAvailable: false,
      })
    ).toEqual({});
  });
});
