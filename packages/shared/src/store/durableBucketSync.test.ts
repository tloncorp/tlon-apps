import type { BucketsState } from '@tloncorp/api';
import { DurableClient } from '@tloncorp/api/client/durable';
import { durableBucketState } from '@tloncorp/api/client/durableBuckets';
import { expect, test, vi } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import { durableBucketSync } from './durableBucketSync';

vi.mock('@tloncorp/api/client/durableBuckets', () => ({
  durableBucketState: vi.fn(),
}));
setupDatabaseTestSuite();

const channelId = 'buckets/~sampel-palnet/files';

function state(revision: number, names: string[]): BucketsState {
  return {
    bucket: {
      id: 1,
      title: 'Files',
      createdBy: '~sampel-palnet',
      createdAt: 0,
      updatedBy: '~sampel-palnet',
      updatedAt: 0,
    },
    group: { host: '~sampel-palnet', name: 'work' },
    writers: [],
    revision,
    entries: names.map((name, index) => ({
      id: index + 1,
      parentId: null,
      name,
      kind: 'folder',
      createdBy: '~sampel-palnet',
      createdAt: 0,
      updatedBy: '~sampel-palnet',
      updatedAt: 0,
    })),
  };
}

test('an open bucket skips unchanged reads and clears once it is gone', async () => {
  const stream: {
    onopen?: () => void;
    onmessage?: () => void;
    onerror?: () => void;
    close: () => void;
  } = { close: () => {} };
  const client = new DurableClient('token');
  client.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [],
    bot: null,
    revision: 0,
    groups: [],
    rooms: [
      {
        id: 'room',
        channelId,
        title: 'Files',
        members: ['brian'],
        groupId: '~sampel-palnet/work',
        kind: 'channel',
      },
    ],
  };
  vi.spyOn(client, 'events').mockReturnValue(stream as never);
  const read = vi.mocked(durableBucketState);
  read.mockResolvedValue(state(3, ['Docs']));
  const sync = durableBucketSync(client, channelId, (error) => {
    if (error) throw error;
  });
  await sync.start();
  expect((await db.getBucket({ channelId }))?.entries).toHaveLength(1);
  expect(read).toHaveBeenLastCalledWith(client, channelId, 0);

  const replace = vi.spyOn(db, 'replaceBucketEntries');
  read.mockResolvedValue('unchanged');
  stream.onopen?.();
  await vi.waitFor(() =>
    expect(read).toHaveBeenLastCalledWith(client, channelId, 3)
  );
  expect(replace).not.toHaveBeenCalled();

  read.mockResolvedValue(null);
  stream.onmessage?.();
  await vi.waitFor(async () =>
    expect(await db.getBucket({ channelId })).toBeFalsy()
  );
  sync.stop();
});
