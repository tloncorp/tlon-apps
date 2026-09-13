import { expect, test } from 'vitest';

import { toChannelsUpdate } from '../client/channelsApi';
import * as ub from '../urbit';

const CHANNEL_ID = 'chat/~zod/test';
const POST_ID = '170.141.184.506.535.164.684.262.900.635.183.087.616';
const REPLY_ID = '170.141.184.506.535.164.684.262.900.635.183.099.999';

const livePost: ub.Post = {
  seal: {
    id: POST_ID,
    reacts: {},
    replies: null,
    meta: { replyCount: 0, lastRepliers: [], lastReply: null },
  },
  essay: {
    author: '~zod',
    content: [{ inline: ['hello'] }],
    sent: 1701275662689,
    kind: 'chat',
    blob: null,
    meta: null,
  },
  type: 'post',
};

const tombstone: ub.PostTombstone = {
  id: POST_ID,
  author: '~zod',
  seq: 1,
  'deleted-at': 1701275700000,
  type: 'tombstone',
};

function postEvent(set: ub.Post | ub.PostTombstone | null) {
  return {
    nest: CHANNEL_ID,
    response: { post: { id: POST_ID, 'r-post': { set } } },
  } as unknown as ub.ChannelsSubscribeResponse;
}

function replyEvent(set: ub.PostTombstone) {
  return {
    nest: CHANNEL_ID,
    response: {
      post: {
        id: POST_ID,
        'r-post': {
          reply: {
            id: REPLY_ID,
            'r-reply': { set },
            meta: { replyCount: 0, lastRepliers: [], lastReply: null },
          },
        },
      },
    },
  } as unknown as ub.ChannelsSubscribeResponse;
}

test('a live post set decodes to addPost', () => {
  const update = toChannelsUpdate(postEvent(livePost));
  expect(update.type).toBe('addPost');
  if (update.type === 'addPost') {
    expect(update.post.id).toBe(POST_ID);
    expect(update.post.isDeleted).toBeFalsy();
  }
});

test('a tombstone post set decodes to deletePost', () => {
  expect(toChannelsUpdate(postEvent(tombstone))).toEqual({
    type: 'deletePost',
    postId: POST_ID,
    channelId: CHANNEL_ID,
  });
});

test('a null post set decodes to deletePost', () => {
  expect(toChannelsUpdate(postEvent(null))).toEqual({
    type: 'deletePost',
    postId: POST_ID,
    channelId: CHANNEL_ID,
  });
});

test('a tombstone reply set decodes to deletePost', () => {
  expect(toChannelsUpdate(replyEvent({ ...tombstone, id: REPLY_ID }))).toEqual({
    type: 'deletePost',
    postId: REPLY_ID,
    channelId: CHANNEL_ID,
  });
});
