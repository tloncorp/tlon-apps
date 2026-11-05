import { afterEach, expect, test, vi } from 'vitest';

import { loadConstants } from './constants';
import { getPostClientMetadata } from './postClientMetadata';
import { getPostClientMetadata as getNativePostClientMetadata } from './postClientMetadata.native';

const mocks = vi.hoisted(() => ({
  setPostClientMetadata: vi.fn(),
  platform: { OS: 'ios' },
  application: {
    nativeApplicationVersion: '9.5.10' as string | null,
    nativeBuildVersion: '501' as string | null,
  },
}));

vi.mock('@tloncorp/shared', () => ({
  setPostClientMetadata: mocks.setPostClientMetadata,
}));
vi.mock('../constants', () => ({ GIT_HASH: 'abc1234', ENV_VARS: {} }));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo-application', () => mocks.application);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mocks.application.nativeApplicationVersion = '9.5.10';
  mocks.application.nativeBuildVersion = '501';
});

test('web identifies the JavaScript build without inventing a mobile version', () => {
  expect(getPostClientMetadata()).toEqual({
    version: 1,
    platform: 'web',
    gitHash: 'abc1234',
  });
});

test.each(['ios', 'android'])(
  '%s uses the installed app version and build',
  (platform) => {
    mocks.platform.OS = platform;
    expect(getNativePostClientMetadata()).toEqual({
      version: 1,
      platform,
      appVersion: '9.5.10',
      build: '501',
      gitHash: 'abc1234',
    });
  }
);

test('missing native version information stays absent', () => {
  mocks.application.nativeApplicationVersion = null;
  mocks.application.nativeBuildVersion = null;
  expect(JSON.parse(JSON.stringify(getNativePostClientMetadata()))).toEqual({
    version: 1,
    platform: mocks.platform.OS,
    gitHash: 'abc1234',
  });
});

test('the app bootstrap configures post stamping before sends', () => {
  mocks.platform.OS = 'web';
  vi.stubGlobal('window', {});
  loadConstants();
  expect(mocks.setPostClientMetadata).toHaveBeenCalledWith(
    getPostClientMetadata()
  );
});
