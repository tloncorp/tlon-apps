import { beforeEach, expect, test, vi } from 'vitest';

import { getBuckets, subscribeToBuckets } from '../client/bucketsApi';
import { scry, subscribe } from '../client/urbit';
import type { BucketsResponse, BucketsSnapshot } from '../urbit/buckets';

vi.mock('../client/urbit', () => ({
  poke: vi.fn(),
  scry: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const legacySnapshot = {
  flag: { host: '~zod', name: 'files' },
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
    entries: [],
    sessions: [],
    revision: 1,
  },
} as unknown as BucketsSnapshot;

beforeEach(() => {
  vi.mocked(scry).mockReset();
  vi.mocked(subscribe).mockReset();
});

test('getBuckets gives legacy snapshots their implicit writer roles', async () => {
  vi.mocked(scry).mockResolvedValueOnce([legacySnapshot]);

  await expect(getBuckets()).resolves.toMatchObject([
    { state: { readers: ['member'], writers: ['member'] } },
  ]);
});

test('subscribeToBuckets normalizes legacy snapshot events', async () => {
  vi.mocked(subscribe).mockImplementationOnce(async (_endpoint, onUpdate) => {
    onUpdate({ type: 'snapshot', ...legacySnapshot } as BucketsResponse);
    return 7;
  });
  const handler = vi.fn();

  await subscribeToBuckets(handler);

  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      state: expect.objectContaining({ writers: ['member'] }),
    })
  );
});
