import { afterEach, expect, test, vi } from 'vitest';

import { loadConstants } from './constants';
import { getPostClientMetadata } from './postClientMetadata';

const mocks = vi.hoisted(() => ({
  setPostClientMetadata: vi.fn(),
  platform: { OS: 'web' },
}));

vi.mock('@tloncorp/shared', () => ({
  setPostClientMetadata: mocks.setPostClientMetadata,
}));
vi.mock('../constants', () => ({ ENV_VARS: {} }));
vi.mock('react-native', () => ({ Platform: mocks.platform }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('the stamp advertises renderer capabilities without identifying the platform or build', () => {
  expect(getPostClientMetadata()).toEqual({
    version: 1,
    rendererRevision: 1,
  });
});

test.each(['web', 'ios', 'android'])(
  '%s bootstrap configures the shared renderer revision before sends',
  (platform) => {
    mocks.platform.OS = platform;
    vi.stubGlobal('window', {});
    loadConstants();
    expect(mocks.setPostClientMetadata).toHaveBeenCalledWith({
      version: 1,
      rendererRevision: 1,
    });
  }
);
