import { beforeEach, expect, test, vi } from 'vitest';

const values = vi.hoisted(() => new Map<string, ArrayBuffer | string>());
vi.mock('./getStorageMethods', () => ({
  getStorageMethods: () => ({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  }),
  largeBinaryStorage: {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: ArrayBuffer | string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  },
}));

import { sqliteContent } from './keyValue';
import { clearSessionStorageItems } from './storageItem';

const bytes = [0x53, 0x51, 0x4c, 0x00, 0x80, 0xff];

beforeEach(() => {
  values.clear();
});

test('loads a snapshot saved in the legacy string format', async () => {
  values.set('sqliteContent', String.fromCharCode(...bytes));
  const loaded = await sqliteContent.getValue();
  expect(Array.from(new Uint8Array(loaded!))).toEqual(bytes);
});

test('treats the legacy reset value as no snapshot', async () => {
  values.set('sqliteContent', '');
  expect(await sqliteContent.getValue()).toBeNull();
});

test('round-trips a binary snapshot and clears it on logout', async () => {
  await sqliteContent.setValue(new Uint8Array(bytes).buffer);
  expect(values.get('sqliteContent')).toBeInstanceOf(ArrayBuffer);
  const loaded = await sqliteContent.getValue();
  expect(Array.from(new Uint8Array(loaded!))).toEqual(bytes);

  await clearSessionStorageItems();
  expect(await sqliteContent.getValue()).toBeNull();
});
