import { describe, expect, it, vi } from 'vitest';

import {
  channelTypeUsesNativeHeader,
  getNativeHeaderScrollOptions,
} from './nativeHeaderOptions';

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

describe('channelTypeUsesNativeHeader', () => {
  it('uses the native bar for conversations and notes', () => {
    for (const type of ['chat', 'dm', 'groupDm', 'notes']) {
      expect(channelTypeUsesNativeHeader(type)).toBe(true);
    }
  });

  it('leaves inline-header channel types alone', () => {
    for (const type of ['gallery', 'notebook', 'buckets']) {
      expect(channelTypeUsesNativeHeader(type)).toBe(false);
    }
  });
});
