import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  getModule: vi.fn(),
  values: new Map<string, string>(),
  getStorageMethods: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  TurboModuleRegistry: { get: mocks.getModule },
}));
// Use the real storage-item registry, including the first-install/logout clears.
vi.mock('@tloncorp/shared/db', async () =>
  vi.importActual('../../shared/src/db/storageItem')
);
vi.mock('../../shared/src/db/getStorageMethods', () => ({
  getStorageMethods: mocks.getStorageMethods,
}));
vi.mock('../../shared/src/db/reactQuery', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock('../../shared/src/debug', () => ({
  createDevLogger: () => ({ log: vi.fn(), trackEvent: vi.fn() }),
}));

import {
  clearAllStorageItems,
  clearSessionStorageItems,
  createStorageItem,
} from '@tloncorp/shared/db';

import {
  getNativeCacheGeneration,
  NATIVE_CACHE_GENERATION,
} from './nativeCacheGeneration';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.values.clear();
  mocks.platform.OS = 'ios';
  mocks.getStorageMethods.mockImplementation(() => ({
    getItem: async (key: string) => mocks.values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mocks.values.set(key, value);
    },
  }));
});

test('does not reset web databases', () => {
  mocks.platform.OS = 'web';
  expect(getNativeCacheGeneration()).toBeUndefined();
  expect(mocks.getModule).not.toHaveBeenCalled();
  expect(mocks.getStorageMethods).not.toHaveBeenCalled();
});

test.each([null, { setLastSyncTimestamp: vi.fn() }])(
  'old iOS binaries cannot consume the recovery via an OTA update (%j)',
  (module) => {
    mocks.getModule.mockReturnValue(module);
    expect(getNativeCacheGeneration()).toBeUndefined();
    expect(mocks.getStorageMethods).not.toHaveBeenCalled();
  }
);

test.each(['ios', 'android'])(
  '%s keeps DB generation across first-install cleanup, logout, and another launch',
  async (platform) => {
    mocks.platform.OS = platform;
    const setLastSyncTimestamp = vi.fn(async () => {});
    mocks.getModule.mockReturnValue({
      setLastSyncTimestamp,
      acknowledgeBackgroundData: vi.fn(),
    });
    const policy = getNativeCacheGeneration()!;
    expect(policy.version).toBe(NATIVE_CACHE_GENERATION);
    expect(await policy.getVersion()).toBe(0);
    await policy.clearNativeCache();
    if (platform === 'ios') {
      expect(setLastSyncTimestamp).toHaveBeenCalledWith(0);
    } else {
      expect(mocks.getModule).not.toHaveBeenCalled();
      expect(setLastSyncTimestamp).not.toHaveBeenCalled();
    }

    // DB startup writes the marker before navigation's first-install cleanup.
    await policy.setVersion(NATIVE_CACHE_GENERATION);
    const session = createStorageItem({
      key: `session-${platform}`,
      defaultValue: 0,
    });
    const preference = createStorageItem({
      key: `preference-${platform}`,
      defaultValue: 0,
      persistAfterLogout: true,
    });
    await session.setValue(1);
    await preference.setValue(1);
    await clearAllStorageItems();
    expect(await session.getValue()).toBe(0);
    expect(await preference.getValue()).toBe(0);
    expect(await policy.getVersion()).toBe(NATIVE_CACHE_GENERATION);

    await session.setValue(2);
    await preference.setValue(2);
    await clearSessionStorageItems();
    expect(await session.getValue()).toBe(0);
    expect(await preference.getValue()).toBe(2);
    // New policy instance reads the persisted marker, so next launch won't wipe.
    expect(await getNativeCacheGeneration()!.getVersion()).toBe(
      NATIVE_CACHE_GENERATION
    );
  }
);
