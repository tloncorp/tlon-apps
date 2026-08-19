import type { Kit } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import { createKitPackageStore } from './package-store.js';

function makeKit(id = 'book-club', version = '0.1.0'): Kit {
  return {
    manifest: {
      id,
      name: 'Book Club',
      version,
      publisher: '~zod',
      description: 'a club',
      image: null,
      scope: 'group',
      places: [],
      bindings: [],
      schedules: [],
      scaffolds: [],
      policy: null,
    },
    files: { 'instructions/runner.md': '# Runner' },
  };
}

const REF = { id: 'book-club', publisher: '~zod', version: '0.1.0' };

describe('createKitPackageStore', () => {
  it('returns the kit from a direct scry hit without poking', async () => {
    const scry = vi.fn().mockResolvedValue({ kit: makeKit() });
    const poke = vi.fn();
    const store = createKitPackageStore({ scry, poke });
    const kit = await store.get(REF);
    expect(kit?.manifest.id).toBe('book-club');
    expect(scry).toHaveBeenCalledWith('/kits/v1/kits/book-club.json');
    expect(poke).not.toHaveBeenCalled();
  });

  it('pokes a fetch and re-scries with backoff when missing', async () => {
    const scry = vi
      .fn()
      .mockRejectedValueOnce(new Error('Scry failed: 404')) // direct miss
      .mockRejectedValueOnce(new Error('Scry failed: 404')) // retry 1
      .mockResolvedValueOnce({ kit: makeKit() }); // retry 2
    const poke = vi.fn().mockResolvedValue(undefined);
    const slept: number[] = [];
    const store = createKitPackageStore({
      scry,
      poke,
      retryDelaysMs: [10, 20, 40],
      sleep: async (ms) => {
        slept.push(ms);
      },
    });

    const kit = await store.get(REF);
    expect(kit?.manifest.id).toBe('book-club');
    expect(poke).toHaveBeenCalledWith({
      app: 'kits',
      mark: 'kits-action-1',
      json: { fetch: { ship: '~zod', id: 'book-club' } },
    });
    // Stopped sleeping once the kit arrived.
    expect(slept).toEqual([10, 20]);
    expect(scry).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting the backoff schedule', async () => {
    const scry = vi.fn().mockRejectedValue(new Error('Scry failed: 404'));
    const poke = vi.fn().mockResolvedValue(undefined);
    const slept: number[] = [];
    const store = createKitPackageStore({
      scry,
      poke,
      retryDelaysMs: [1, 2],
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(await store.get(REF)).toBeNull();
    expect(slept).toEqual([1, 2]);
    // 1 direct + 2 retries.
    expect(scry).toHaveBeenCalledTimes(3);
  });

  it('returns null when the fetch poke itself fails', async () => {
    const scry = vi.fn().mockRejectedValue(new Error('Scry failed: 404'));
    const poke = vi.fn().mockRejectedValue(new Error('poke nack'));
    const store = createKitPackageStore({
      scry,
      poke,
      retryDelaysMs: [1],
      sleep: async () => {},
    });
    expect(await store.get(REF)).toBeNull();
    expect(scry).toHaveBeenCalledTimes(1); // no re-scry after failed poke
  });

  it('caches successful reads and invalidates on demand', async () => {
    const scry = vi.fn().mockResolvedValue({ kit: makeKit() });
    const store = createKitPackageStore({ scry, poke: vi.fn() });
    await store.get(REF);
    await store.get(REF);
    expect(scry).toHaveBeenCalledTimes(1);
    store.invalidate(REF.id);
    await store.get(REF);
    expect(scry).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent fetches of the same kit', async () => {
    let resolveScry!: (value: unknown) => void;
    const scry = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveScry = resolve;
      })
    );
    const store = createKitPackageStore({ scry, poke: vi.fn() });
    const [a, b] = [store.get(REF), store.get(REF)];
    resolveScry({ kit: makeKit() });
    expect((await a)?.manifest.id).toBe('book-club');
    expect((await b)?.manifest.id).toBe('book-club');
    expect(scry).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed scry responses', async () => {
    const scry = vi.fn().mockResolvedValue({ kit: { files: {} } }); // no manifest
    const poke = vi.fn().mockResolvedValue(undefined);
    const store = createKitPackageStore({
      scry,
      poke,
      retryDelaysMs: [],
      sleep: async () => {},
    });
    expect(await store.get(REF)).toBeNull();
  });

  it('logs a version mismatch but still returns the library copy', async () => {
    const log = vi.fn();
    const scry = vi
      .fn()
      .mockResolvedValue({ kit: makeKit('book-club', '0.2.0') });
    const store = createKitPackageStore({ scry, poke: vi.fn(), log });
    const kit = await store.get(REF);
    expect(kit?.manifest.version).toBe('0.2.0');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('0.1.0'));
  });
});
