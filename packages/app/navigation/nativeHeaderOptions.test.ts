import { Platform } from 'react-native';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getNativeHeaderOptions,
  getNativeHeaderScrollOptions,
} from './nativeHeaderOptions';

const originalPlatform = { ...Platform };

afterEach(() => {
  Object.assign(Platform, originalPlatform);
});

describe('native header options', () => {
  it('hides native headers on web', () => {
    Object.assign(Platform, { OS: 'web', Version: '26' });
    expect(getNativeHeaderOptions({ title: 'Home' })).toEqual({
      headerShown: false,
    });
  });

  it('uses centered opaque headers on Android', () => {
    Object.assign(Platform, { OS: 'android', Version: '35' });
    const options = getNativeHeaderOptions({
      title: 'Home',
      backgroundColor: '#ffffff',
    });

    expect(options).toMatchObject({
      headerShown: true,
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: '#ffffff' },
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
