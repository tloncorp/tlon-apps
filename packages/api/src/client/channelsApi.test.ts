import { expect, test } from 'vitest';

import type * as ub from '../urbit';
import { toChannelsUpdate } from './channelsApi';

const nest = 'chat/~zod/test';
const postId = '170.141.184.508.156.853.761.867.717.508.987.879.424';
const replyId = '170.141.184.508.156.856.230.907.384.944.729.784.320';

const tombstone: ub.PostTombstone = {
  id: postId,
  author: '~zod',
  seq: 5,
  'deleted-at': 1789187650000,
  type: 'tombstone',
};

const post: ub.Post = {
  seal: {
    id: postId,
    reacts: {},
    replies: null,
    meta: { replyCount: 0, lastRepliers: [], lastReply: null },
    seq: 5,
  },
  essay: {
    content: [{ inline: ['hi'] }],
    author: '~zod',
    sent: 1789187602325,
    kind: '/chat',
    blob: null,
    meta: null,
  },
  type: 'post',
};

function postEvent(rPost: ub.PostResponse): ub.ChannelsSubscribeResponse {
  return {
    nest,
    response: { post: { id: postId, 'r-post': rPost } },
  } as ub.ChannelsSubscribeResponse;
}

test('a live post set decodes to addPost', () => {
  const update = toChannelsUpdate(postEvent({ set: post }));
  expect(update.type).toBe('addPost');
});

test('a tombstone post set decodes to deletePost', () => {
  expect(toChannelsUpdate(postEvent({ set: tombstone }))).toEqual({
    type: 'deletePost',
    postId,
    channelId: nest,
  });
});

test('a tombstone reply set decodes to deletePost', () => {
  const update = toChannelsUpdate(
    postEvent({
      reply: {
        id: replyId,
        'r-reply': { set: { ...tombstone, id: replyId } },
        meta: { replyCount: 0, lastRepliers: [], lastReply: null },
      },
    })
  );
  expect(update).toEqual({
    type: 'deletePost',
    postId: replyId,
    channelId: nest,
  });
});
