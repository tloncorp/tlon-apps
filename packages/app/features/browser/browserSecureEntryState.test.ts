import { afterEach, expect, it, vi } from 'vitest';
import {
  fetchSecureEntryState,
  rememberSecureEntry,
  secureEntryCache,
} from './browserSecureEntryState';
const storage = vi.hoisted(() => ({ value: null as any }));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({
  createStorageItem: () => ({
    getValue: async () => storage.value,
    setValue: async (update: any) => {
      storage.value = update(storage.value);
    },
  }),
}));
const url =
  'https://browser-session.tlon.network/s/payload.signature?clipboardBridge=true';
afterEach(() => {
  vi.unstubAllGlobals();
  storage.value = null;
});
it.each([
  [{ status: 'filled' }, 'used'],
  [{ status: 'pending' }, undefined],
  [{ status: 'failed', outcome: 'unknown' }, 'ended'],
  [{ status: 'failed', outcome: 'expired' }, 'expired'],
  [{ status: 'cancelled' }, 'ended'],
])(
  'classifies receipts without confusing an attempted fill with success: %j',
  async (body, expected) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchSecureEntryState(url, new AbortController().signal)).toBe(
      expected
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://browser-session.tlon.network/credential-result/payload.signature'
    );
  }
);
it('keeps missing receipts and temporary server failures retryable', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
  );
  expect(
    await fetchSecureEntryState(url, new AbortController().signal)
  ).toBeUndefined();
  await expect(
    fetchSecureEntryState(url, new AbortController().signal)
  ).rejects.toThrow();
  expect(await secureEntryCache.getValue()).toBeNull();
});
it('persists only the terminal status, keyed independently of viewer query parameters', async () => {
  await rememberSecureEntry(url, 'used');
  expect(await secureEntryCache.getValue()).toEqual({
    'https://browser-session.tlon.network/s/payload.signature': {
      state: 'used',
      checkedAt: expect.any(Number),
    },
  });
});
