import { beforeEach, expect, test, vi } from 'vitest';

import {
  BucketsActionFailed,
  getBucketReadToken,
  getBuckets,
  requestBucketReadToken,
  requestBucketsGrant,
  sendBucketsAction,
  subscribeToBuckets,
} from '../client/bucketsApi';
import { requestJson, scry, subscribe, unsubscribe } from '../client/urbit';
import type { BucketsFlag, BucketsSnapshot } from '../urbit/buckets';

vi.mock('../client/urbit', () => ({
  requestJson: vi.fn(),
  scry: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const flag: BucketsFlag = { host: '~zod', name: 'files' };

const snapshot = {
  flag,
  state: {
    bucket: {
      id: 1,
      title: 'Files',
      createdBy: '~zod',
      createdAt: 0,
      updatedBy: '~zod',
      updatedAt: 0,
    },
    group: { host: '~zod', name: 'group' },
    readers: ['member'],
    writers: ['admin'],
    entries: [],
    revision: 1,
  },
} satisfies BucketsSnapshot;

beforeEach(() => {
  vi.mocked(requestJson).mockReset();
  vi.mocked(scry).mockReset();
  vi.mocked(subscribe).mockReset();
  vi.mocked(unsubscribe).mockReset();
});

test('getBuckets returns the local snapshots', async () => {
  vi.mocked(scry).mockResolvedValueOnce([snapshot]);

  await expect(getBuckets()).resolves.toEqual([snapshot]);
});

test('sendBucketsAction submits over the v1 endpoint and returns the answer', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: { ok: null },
  });

  await expect(
    sendBucketsAction({ type: 'delete-bucket', flag })
  ).resolves.toEqual({ ok: null });

  expect(requestJson).toHaveBeenCalledWith('/buckets/~/v1', 'POST', {
    action: { type: 'delete-bucket', flag },
  });
});

test('sendBucketsAction raises a typed refusal', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: { error: { type: 'not-authorized', message: 'nope' } },
  });

  await expect(
    sendBucketsAction({ type: 'delete-bucket', flag })
  ).rejects.toMatchObject({
    name: 'BucketsActionFailed',
    type: 'not-authorized',
    message: 'nope',
  });
});

test('requestBucketsGrant returns the minted token', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: {
      grant: { token: '0vabc', entryId: 12, expiresAt: '~2026.1.1' },
    },
  });

  await expect(
    requestBucketsGrant({ type: 'issue-delete', flag, id: 12 })
  ).resolves.toEqual({ token: '0vabc', entryId: 12, expiresAt: '~2026.1.1' });
});

test('requestBucketsGrant rejects an answer that carries no grant', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: { ok: null },
  });

  await expect(
    requestBucketsGrant({ type: 'issue-delete', flag, id: 12 })
  ).rejects.toThrow(/did not return a grant/);
});

test('getBucketReadToken reads the token our own ship holds', async () => {
  vi.mocked(scry).mockResolvedValueOnce({
    token: '0vread',
    expiresAt: '~2026.1.1',
  });

  await expect(getBucketReadToken(flag)).resolves.toEqual({
    token: '0vread',
    expiresAt: '~2026.1.1',
  });
  expect(scry).toHaveBeenCalledWith({
    app: 'buckets',
    path: '/v1/buckets/~zod/files/read-token',
  });
});

test('getBucketReadToken yields null before the first refresh lands', async () => {
  vi.mocked(scry).mockRejectedValueOnce(new Error('404'));

  await expect(getBucketReadToken(flag)).resolves.toBeNull();
});

test('requestBucketReadToken mints one on a cold start', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: { token: { token: '0vread', expiresAt: '~2026.1.1' } },
  });

  await expect(requestBucketReadToken(flag)).resolves.toEqual({
    token: '0vread',
    expiresAt: '~2026.1.1',
  });
});

test('subscribeToBuckets unsubscribes the replacement id after a reset', async () => {
  vi.mocked(subscribe).mockImplementationOnce(
    async (_endpoint, _onUpdate, options) => {
      options?.onSubscriptionId?.(7);
      options?.onSubscriptionId?.(19);
      return 7;
    }
  );

  const stop = await subscribeToBuckets(vi.fn());
  await stop();

  expect(unsubscribe).toHaveBeenCalledWith(19);
});
