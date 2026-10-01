import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  getModule: vi.fn(),
  createStorageItem: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  TurboModuleRegistry: { get: mocks.getModule },
}));
vi.mock('@tloncorp/shared/db', () => ({
  createStorageItem: mocks.createStorageItem,
}));

import {
  getNativeCacheGeneration,
  NATIVE_CACHE_GENERATION,
} from './nativeCacheGeneration';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = 'ios';
});

test('does not reset web databases', () => {
  mocks.platform.OS = 'web';
  expect(getNativeCacheGeneration()).toBeUndefined();
  expect(mocks.getModule).not.toHaveBeenCalled();
  expect(mocks.createStorageItem).not.toHaveBeenCalled();
});

test.each([null, { setLastSyncTimestamp: vi.fn() }])(
  'old iOS binaries cannot consume the recovery via an OTA update (%j)',
  (module) => {
    mocks.getModule.mockReturnValue(module);
    expect(getNativeCacheGeneration()).toBeUndefined();
    expect(mocks.createStorageItem).not.toHaveBeenCalled();
  }
);

test.each(['ios', 'android'])(
  '%s uses the shared generation with platform-specific native clearing',
  async (platform) => {
    mocks.platform.OS = platform;
    const setLastSyncTimestamp = vi.fn(async () => {});
    const getValue = vi.fn(async () => 0);
    const setValue = vi.fn(async () => {});
    mocks.getModule.mockReturnValue({
      setLastSyncTimestamp,
      acknowledgeBackgroundData: vi.fn(),
    });
    mocks.createStorageItem.mockReturnValue({ getValue, setValue });
    const policy = getNativeCacheGeneration()!;
    expect(policy.version).toBe(NATIVE_CACHE_GENERATION);
    expect(mocks.createStorageItem).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'nativeLocalCacheGeneration',
        defaultValue: 0,
        persistAfterLogout: true,
      })
    );
    expect(await policy.getVersion()).toBe(0);
    await policy.clearNativeCache();
    if (platform === 'ios') {
      expect(setLastSyncTimestamp).toHaveBeenCalledWith(0);
    } else {
      expect(mocks.getModule).not.toHaveBeenCalled();
      expect(setLastSyncTimestamp).not.toHaveBeenCalled();
    }
    await policy.setVersion(1);
    expect(setValue).toHaveBeenCalledWith(1);
  }
);
