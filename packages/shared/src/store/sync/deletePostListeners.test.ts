import { beforeEach, expect, test, vi } from 'vitest';

import * as db from '../../db';
import { setupDatabaseTestSuite } from '../../test/helpers';
import {
  addToChannelPosts,
  deleteFromChannelPosts,
} from '../useChannelPosts/subscriptions';
import { handleChannelsUpdate, syncCachedChanges } from './sync';

vi.mock('../useChannelPosts/subscriptions', () => ({
  addToChannelPosts: vi.fn(),
  deleteFromChannelPosts: vi.fn(),
}));

setupDatabaseTestSuite();

const channelId = 'chat/~zod/test';
const livePost: db.Post = {
  id: '170.141.184.508.156.853.761.867.717.508.987.879.424',
  type: 'chat',
  channelId,
  authorId: '~zod',
  sentAt: 1789187602325,
  receivedAt: 1789187602325,
  sequenceNum: 5,
  content: null,
  hidden: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('a deletePost update reaches the deleted-post listeners', async () => {
  await db.insertChannels([{ id: channelId, type: 'chat' }]);
  await db.insertChannelPosts({ posts: [livePost] });

  await handleChannelsUpdate(
    { type: 'deletePost', postId: livePost.id, channelId },
    undefined as never
  );

  expect(deleteFromChannelPosts).toHaveBeenCalledWith({ id: livePost.id });
  expect(addToChannelPosts).not.toHaveBeenCalled();
  const row = await db.getPost({ postId: livePost.id });
  expect(row?.isDeleted).toBe(true);
});

test('a tombstone in the changes feed reaches the deleted-post listeners', async () => {
  vi.spyOn(db.changesSyncedAt, 'getValue').mockResolvedValue(10);
  const tombstone: db.Post = { ...livePost, isDeleted: true, content: null };

  await syncCachedChanges({
    begin: 5,
    end: 20,
    changes: {
      groups: [],
      posts: [tombstone, { ...livePost, id: 'other', sequenceNum: 6 }],
      contacts: [],
      unreads: { groupUnreads: [], channelUnreads: [], threadActivity: [] },
      deletedChannelIds: [],
    },
  });

  expect(deleteFromChannelPosts).toHaveBeenCalledTimes(1);
  expect(deleteFromChannelPosts).toHaveBeenCalledWith(tombstone);
  expect(addToChannelPosts).toHaveBeenCalledTimes(1);
  expect(addToChannelPosts).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'other' })
  );
});
