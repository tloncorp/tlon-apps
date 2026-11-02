import { beforeEach, expect, test, vi } from 'vitest';

const values = vi.hoisted(() => new Map<string, Blob | string>());
vi.mock('./getStorageMethods', () => ({
  getStorageMethods: () => ({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  }),
  largeBinaryStorage: {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: Blob | string) => {
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

async function readBytes(blob: Blob | null) {
  return Array.from(new Uint8Array(await blob!.arrayBuffer()));
}

beforeEach(() => {
  values.clear();
});

test('loads a snapshot saved in the legacy string format', async () => {
  values.set('sqliteContent', String.fromCharCode(...bytes));
  expect(await readBytes(await sqliteContent.getValue())).toEqual(bytes);
});

test('treats the legacy reset value as no snapshot', async () => {
  values.set('sqliteContent', '');
  expect(await sqliteContent.getValue()).toBeNull();
});

test('round-trips a Blob snapshot and clears it on logout', async () => {
  const snapshot = new Blob([new Uint8Array(bytes)]);
  await sqliteContent.setValue(snapshot);
  expect(await sqliteContent.getValue()).toBe(snapshot);

  await clearSessionStorageItems();
  expect(await sqliteContent.getValue()).toBeNull();
});
