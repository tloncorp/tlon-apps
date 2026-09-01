import { beforeEach, expect, test, vi } from 'vitest';

import {
  BucketsActionFailed,
  getBucket,
  getBucketReadToken,
  getBuckets,
  mintRequestId,
  requestBucketReadToken,
  requestBucketsGrant,
  sendBucketsAction,
  subscribeToBuckets,
} from '../client/bucketsApi';
import {
  BadResponseError,
  requestJson,
  scry,
  subscribe,
  unsubscribe,
} from '../client/urbit';
import type { BucketsFlag, BucketsSnapshot } from '../urbit/buckets';

vi.mock('../client/urbit', () => ({
  // A real class, not a stub: getBucket separates a missing bucket from a
  // failed read with instanceof, and a mocked-away constructor would make
  // every failure look like a missing bucket.
  BadResponseError: class BadResponseError extends Error {
    constructor(
      public status: number,
      message?: string
    ) {
      super(message);
      this.name = 'BadResponseError';
    }
  },
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

test('getBucket reads one bucket and unwraps its snapshot', async () => {
  vi.mocked(scry).mockResolvedValueOnce({
    type: 'snapshot',
    flag,
    state: snapshot.state,
  });

  await expect(getBucket(flag)).resolves.toEqual(snapshot);
  expect(scry).toHaveBeenCalledWith({
    app: 'buckets',
    path: '/v1/buckets/~zod/files',
  });
});

// The agent drops a bucket from this read under the same conditions it drops
// one from /v1/buckets, so a 404 means what an absence from that list meant.
test('getBucket reports a bucket this ship does not have as null', async () => {
  vi.mocked(scry).mockRejectedValueOnce(
    new BadResponseError(404, 'no such path')
  );

  await expect(getBucket(flag)).resolves.toBeNull();
});

// Anything else is a failed read. Reporting it as a missing bucket would clear
// one that is really there the first time a connection drops.
test('getBucket raises a read failure rather than calling it missing', async () => {
  vi.mocked(scry).mockRejectedValueOnce(new BadResponseError(500, 'boom'));

  await expect(getBucket(flag)).rejects.toThrow(BadResponseError);
});

test('sendBucketsAction submits over the v1 endpoint and returns the answer', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce({
    requestId: '0v5',
    body: { ok: null },
  });

  await expect(
    sendBucketsAction({ type: 'delete-bucket', flag }, '0v1abcd.efghi')
  ).resolves.toEqual({ ok: null });

  // The agent answers 401 for an expired cookie, which requestJson does not
  // reauth on by default — so the option is part of the contract, not noise.
  // The request id is ours, so a lost answer stays addressable.
  expect(requestJson).toHaveBeenCalledWith(
    '/buckets/~/v1',
    'POST',
    { action: { type: 'delete-bucket', flag }, requestId: '0v1abcd.efghi' },
    { reauthStatuses: [401, 403] }
  );
});

// The agent parses this with (slav %uv) and silently substitutes its own id
// for anything that does not parse, so a malformed one fails by doing nothing
// visible. /tests/app/buckets checks the Hoon side accepts this shape.
test('mintRequestId produces a canonical @uv', () => {
  for (let i = 0; i < 200; i += 1) {
    const id = mintRequestId();
    expect(id).toMatch(/^0v[1-9a-v][0-9a-v]{4}(\.[0-9a-v]{5})*$/);
  }
  expect(new Set(Array.from({ length: 50 }, mintRequestId)).size).toBe(50);
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

// One subscription for the app, the way every other agent is subscribed.
// Listeners come and go against it; it is never unsubscribed, so there is no
// replacement id to chase and nothing for a disposal to race.
test('subscribeToBuckets opens one subscription and fans out to listeners', async () => {
  let deliver: ((response: unknown) => void) | undefined;
  vi.mocked(subscribe).mockImplementation(async (_endpoint, onUpdate) => {
    deliver = onUpdate as (response: unknown) => void;
    return 7;
  });

  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = await subscribeToBuckets(first);
  await subscribeToBuckets(second);

  expect(vi.mocked(subscribe)).toHaveBeenCalledTimes(1);

  deliver?.({ type: 'snapshot' });
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);

  // Dropping one listener leaves the subscription and the other alone.
  await stopFirst();
  deliver?.({ type: 'snapshot' });
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
  expect(unsubscribe).not.toHaveBeenCalled();
});
