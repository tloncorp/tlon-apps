import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchChangesSince: vi.fn(),
  addToChannelPosts: vi.fn(),
  deleteFromChannelPosts: vi.fn(),
}));

vi.mock('@tloncorp/api/client/changesApi', () => ({
  fetchChangesSince: mocks.fetchChangesSince,
}));

vi.mock('../useChannelPosts/subscriptions', async () => {
  const actual = await vi.importActual<
    typeof import('../useChannelPosts/subscriptions')
  >('../useChannelPosts/subscriptions');
  return {
    ...actual,
    addToChannelPosts: mocks.addToChannelPosts,
    deleteFromChannelPosts: mocks.deleteFromChannelPosts,
  };
});

import type * as db from '../../db';
import { batchEffects } from '../../db/query';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { handleChannelsUpdate, syncLatestChanges } from './sync';

setupDatabaseTestSuite();

afterEach(() => {
  mocks.fetchChangesSince.mockReset();
  mocks.addToChannelPosts.mockReset();
  mocks.deleteFromChannelPosts.mockReset();
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

test('the changes feed reports tombstones as deletes, not new posts', async () => {
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
  expect(mocks.deleteFromChannelPosts).toHaveBeenCalledTimes(1);
  expect(mocks.deleteFromChannelPosts).toHaveBeenCalledWith(
    expect.objectContaining({ id: tombstone.id })
  );
});

test('a subscription deletePost update reports the delete to channel post listeners', async () => {
  await batchEffects('test:deletePost', (ctx) =>
    handleChannelsUpdate(
      { type: 'deletePost', postId: livePost.id, channelId },
      ctx
    )
  );

  expect(mocks.addToChannelPosts).not.toHaveBeenCalled();
  expect(mocks.deleteFromChannelPosts).toHaveBeenCalledWith({
    id: livePost.id,
  });
});
