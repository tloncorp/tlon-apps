import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createStorageItem } from './storageItem';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('./getStorageMethods', () => ({
  getStorageMethods: () => storage,
}));

describe('createStorageItem update queue', () => {
  beforeEach(() => {
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.removeItem.mockReset();
  });

  test('allows a reset to retry after an earlier write rejects', async () => {
    const item = createStorageItem({
      key: 'retry-after-rejection',
      defaultValue: null,
    });
    storage.setItem
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(item.resetValue()).rejects.toThrow('storage unavailable');
    await expect(item.resetValue()).resolves.toBeNull();

    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });
});
