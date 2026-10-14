import { beforeEach, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  value: '1',
  setItem: vi.fn(),
}));
vi.mock('./getStorageMethods', () => ({
  getStorageMethods: () => ({
    getItem: async () => storage.value,
    setItem: storage.setItem,
  }),
}));
vi.mock('./reactQuery', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

import { createStorageItem } from './storageItem';

beforeEach(() => {
  storage.value = '1';
  storage.setItem.mockReset();
  storage.setItem.mockImplementation(async (_key, value) => {
    storage.value = value;
  });
});

it('reports a failed write while allowing a queued update and locked read to finish', async () => {
  const item = createStorageItem({ key: 'retry-write', defaultValue: 0 });
  let fail!: (error: Error) => void;
  storage.setItem.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      })
  );
  const first = item.setValue(2);
  const rejected = expect(first).rejects.toThrow('disk unavailable');
  const second = item.setValue((value) => value + 10);
  const read = item.getValue(true);
  await vi.waitFor(() => expect(fail).toBeDefined());
  fail(new Error('disk unavailable'));
  await rejected;
  await second;
  expect(await read).toBe(11);
  expect(storage.setItem.mock.calls.map(([, value]) => value)).toEqual([
    '2',
    '11',
  ]);
});

it('allows reads and a reset retry after a failed reset', async () => {
  const item = createStorageItem({ key: 'retry-reset', defaultValue: 0 });
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(item.resetValue()).rejects.toThrow('disk unavailable');
  expect(await item.getValue(true)).toBe(1);
  expect(await item.resetValue()).toBe(0);
  expect(await item.getValue(true)).toBe(0);
});
