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
  getIOSCacheGeneration,
  IOS_CACHE_GENERATION,
} from './iosCacheGeneration';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.OS = 'ios';
});

test.each(['android', 'web'])('does not reset %s databases', (platform) => {
  mocks.platform.OS = platform;
  expect(getIOSCacheGeneration()).toBeUndefined();
  expect(mocks.getModule).not.toHaveBeenCalled();
  expect(mocks.createStorageItem).not.toHaveBeenCalled();
});

test('old binaries cannot consume the recovery via an OTA update', () => {
  mocks.getModule.mockReturnValue({ setLastSyncTimestamp: vi.fn() });
  expect(getIOSCacheGeneration()).toBeUndefined();
  expect(mocks.createStorageItem).not.toHaveBeenCalled();
});

test('fixed binaries use a persistent marker and await clearing native cache/cursor', async () => {
  const setLastSyncTimestamp = vi.fn(async () => {});
  const getValue = vi.fn(async () => 0);
  const setValue = vi.fn(async () => {});
  mocks.getModule.mockReturnValue({
    setLastSyncTimestamp,
    acknowledgeBackgroundData: vi.fn(),
  });
  mocks.createStorageItem.mockReturnValue({ getValue, setValue });
  const policy = getIOSCacheGeneration()!;
  expect(policy.version).toBe(IOS_CACHE_GENERATION);
  expect(mocks.createStorageItem).toHaveBeenCalledWith(
    expect.objectContaining({ defaultValue: 0, persistAfterLogout: true })
  );
  expect(await policy.getVersion()).toBe(0);
  await policy.clearNativeCache();
  expect(setLastSyncTimestamp).toHaveBeenCalledWith(0);
  await policy.setVersion(1);
  expect(setValue).toHaveBeenCalledWith(1);
});
