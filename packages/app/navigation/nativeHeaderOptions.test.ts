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
        isDarkMode: true,
        platform: 'ios',
        platformVersion: 26,
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
        isDarkMode: false,
        platform: 'ios',
        platformVersion: 26,
        bottomEdgeEffect: 'soft',
      }).scrollEdgeEffects
    ).toMatchObject({ top: 'soft', bottom: 'soft' });
  });
});
