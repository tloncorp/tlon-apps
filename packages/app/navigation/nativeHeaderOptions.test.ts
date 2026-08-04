import { Platform } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getNativeHeaderScrollOptions,
  nativeHeaderPresentationOptions,
} from './nativeHeaderOptions';

vi.mock('@tloncorp/ui', () => ({
  mobileTypeStyles: {
    '$label/2xl': { fontSize: 17, fontWeight: '500' },
  },
}));

const originalPlatform = { ...Platform };

afterEach(() => {
  Object.assign(Platform, originalPlatform);
});

describe('native header options', () => {
  it('shares the standard screen header presentation', () => {
    expect(nativeHeaderPresentationOptions).toEqual({
      headerShadowVisible: false,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: '500',
      },
    });
  });

  it('configures iOS scroll chrome independently of the header model', () => {
    Object.assign(Platform, { OS: 'ios', Version: '26' });
    expect(getNativeHeaderScrollOptions({ isDarkMode: true })).toMatchObject({
      headerTransparent: true,
      scrollEdgeEffects: {
        top: 'soft',
        bottom: 'hidden',
        left: 'hidden',
        right: 'hidden',
      },
    });
  });
});
