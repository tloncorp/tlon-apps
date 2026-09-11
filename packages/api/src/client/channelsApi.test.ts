import { expect, test, vi } from 'vitest';

import rawChannelPostsData from '../__tests__/fixtures/channelPosts.json';
import type * as ub from '../urbit';
import { toChannelsUpdate } from './channelsApi';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return {
    ...actual,
    poke: vi.fn(),
    scry: vi.fn(),
    subscribe: vi.fn(),
    subscribeOnce: vi.fn(),
    thread: vi.fn(),
    trackedPoke: vi.fn(),
  };
});

const channelId = 'chat/~zod/test';
const postId = '170141184508156063143615883506463277056';
const replyId = '170141184508156080359755299686700810240';

const tombstone = (id: string): ub.PostTombstone => ({
  id,
  author: '~zod',
  seq: 7,
  'deleted-at': 1789144000000,
  type: 'tombstone',
});

const event = (response: ub.ChannelsResponse['response']) =>
  ({
    nest: channelId,
    response,
  }) as unknown as ub.ChannelsSubscribeResponse;

test('a post set to a live post is still an add', () => {
  const [id, post] = Object.entries(
    (rawChannelPostsData as unknown as ub.PagedPosts).posts
  )[0];
  const update = toChannelsUpdate(
    event({ post: { id, 'r-post': { set: post } } })
  );
  expect(update).toMatchObject({ type: 'addPost', post: { id, channelId } });
  expect((update as { post: { isDeleted?: boolean } }).post.isDeleted).toBe(
    undefined
  );
});

test('a post set to a tombstone is a delete, not an add', () => {
  const update = toChannelsUpdate(
    event({ post: { id: postId, 'r-post': { set: tombstone(postId) } } })
  );
  expect(update).toEqual({
    type: 'deletePost',
    postId: '170.141.184.508.156.063.143.615.883.506.463.277.056',
    channelId,
  });
});

test('a reply set to a tombstone is a delete, not an add', () => {
  const update = toChannelsUpdate(
    event({
      post: {
        id: postId,
        'r-post': {
          reply: {
            id: replyId,
            'r-reply': { set: tombstone(replyId) },
            meta: { replyCount: 0, lastReply: null, lastRepliers: [] },
          },
        },
      },
    })
  );
  expect(update).toEqual({
    type: 'deletePost',
    postId: '170.141.184.508.156.080.359.755.299.686.700.810.240',
    channelId,
  });
});
