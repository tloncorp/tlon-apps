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

  it('lets iOS 27 choose the top edge style behind the title', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: '27.0',
        liquidGlassAvailable: true,
        bottomEdgeEffect: 'soft',
      })
    ).toMatchObject({
      headerTransparent: true,
      scrollEdgeEffects: {
        top: 'automatic',
        bottom: 'soft',
        left: 'hidden',
        right: 'hidden',
      },
    });
  });

  it('keeps the soft top edge through iOS 26 point releases', () => {
    expect(
      getNativeHeaderScrollOptions({
        platform: 'ios',
        platformVersion: '26.5',
        liquidGlassAvailable: true,
      }).scrollEdgeEffects
    ).toMatchObject({ top: 'soft' });
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
