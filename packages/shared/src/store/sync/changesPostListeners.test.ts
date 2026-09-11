import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchChangesSince: vi.fn(),
  addToChannelPosts: vi.fn(),
}));

vi.mock('@tloncorp/api/client/changesApi', () => ({
  fetchChangesSince: mocks.fetchChangesSince,
}));

vi.mock('../useChannelPosts/subscriptions', async () => {
  const actual = await vi.importActual<
    typeof import('../useChannelPosts/subscriptions')
  >('../useChannelPosts/subscriptions');
  return { ...actual, addToChannelPosts: mocks.addToChannelPosts };
});

import type * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { syncLatestChanges } from './sync';

setupDatabaseTestSuite();

afterEach(() => {
  mocks.fetchChangesSince.mockReset();
  mocks.addToChannelPosts.mockReset();
});

const channelId = 'chat/~zod/test';

const livePost: db.Post = {
  id: '170.141.184.508.156.063.143.615.883.506.463.277.056',
  channelId,
  type: 'chat',
  authorId: '~zod',
  sentAt: 1789144000000,
  receivedAt: 1789144000100,
  sequenceNum: 7,
  content: '[]',
};

const tombstone: db.Post = {
  id: '170.141.184.508.156.080.359.755.299.686.700.810.240',
  channelId,
  type: 'chat',
  authorId: '~zod',
  sentAt: 1789144001100,
  receivedAt: 1789144001100,
  sequenceNum: 8,
  isDeleted: true,
};

test('the changes feed does not push tombstones into channel post listeners', async () => {
  mocks.fetchChangesSince.mockResolvedValue({
    groups: [],
    posts: [livePost, tombstone],
    contacts: [],
    deletedChannelIds: [],
    unreads: {
      channelUnreads: [],
      groupUnreads: [],
      threadActivity: [],
    },
  });

  await syncLatestChanges({ since: Date.now(), callCtx: { cause: 'test' } });

  expect(mocks.addToChannelPosts).toHaveBeenCalledTimes(1);
  expect(mocks.addToChannelPosts).toHaveBeenCalledWith(
    expect.objectContaining({ id: livePost.id })
  );
});
