import { describe, expect, test, vi } from 'vitest';

import type * as ub from '../urbit';
import { toChannelsUpdate } from './channelsApi';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return {
    ...actual,
    scry: vi.fn(),
    thread: vi.fn(),
    subscribe: vi.fn(),
    trackedPoke: vi.fn(),
    poke: vi.fn(),
  };
});

const nest = 'chat/~zod/test';
const postId = '170.141.184.508.158.425.324.012.822.624.053.755.904';
const replyId = '170.141.184.508.158.427.803.214.862.618.957.185.024';

const tombstone: ub.PostTombstone = {
  author: '~zod',
  id: postId,
  'deleted-at': 1757731200000,
  seq: 3,
  type: 'tombstone',
};

const post: ub.Post = {
  type: 'post',
  seal: { id: postId, reacts: {}, replies: null, meta: {} as ub.ReplyMeta },
  essay: {
    content: [{ inline: ['hello'] }],
    author: '~zod',
    sent: 1757731100000,
    kind: '/chat',
    blob: null,
    meta: null,
  },
};

const reply: ub.Reply = {
  seal: { id: replyId, 'parent-id': postId, reacts: {} },
  'reply-essay': {
    content: [{ inline: ['hi'] }],
    author: '~zod',
    sent: 1757731150000,
    blob: null,
  },
};

function postEvent(set: ub.Post | ub.PostTombstone | null) {
  return {
    nest,
    response: { post: { id: postId, 'r-post': { set } } },
  } as unknown as ub.ChannelsSubscribeResponse;
}

function replyEvent(set: ub.Reply | ub.PostTombstone | null) {
  return {
    nest,
    response: {
      post: {
        id: postId,
        'r-post': {
          reply: { id: replyId, 'r-reply': { set }, meta: {} },
        },
      },
    },
  } as unknown as ub.ChannelsSubscribeResponse;
}

describe('toChannelsUpdate post set events', () => {
  test('a tombstone set decodes to deletePost', () => {
    expect(toChannelsUpdate(postEvent(tombstone))).toEqual({
      type: 'deletePost',
      postId,
      channelId: nest,
    });
  });

  test('a null set still decodes to deletePost', () => {
    expect(toChannelsUpdate(postEvent(null))).toEqual({
      type: 'deletePost',
      postId,
      channelId: nest,
    });
  });

  test('a live post set decodes to addPost', () => {
    const update = toChannelsUpdate(postEvent(post));
    expect(update.type).toBe('addPost');
    expect(update.type === 'addPost' && update.post.id).toBe(postId);
    expect(update.type === 'addPost' && update.post.isDeleted).toBeFalsy();
  });
});

describe('toChannelsUpdate reply set events', () => {
  test('a tombstone set decodes to deletePost for the reply', () => {
    expect(toChannelsUpdate(replyEvent({ ...tombstone, id: replyId }))).toEqual(
      {
        type: 'deletePost',
        postId: replyId,
        channelId: nest,
      }
    );
  });

  test('a null set still decodes to deletePost for the reply', () => {
    expect(toChannelsUpdate(replyEvent(null))).toEqual({
      type: 'deletePost',
      postId: replyId,
      channelId: nest,
    });
  });

  test('a live reply set decodes to addPost', () => {
    const update = toChannelsUpdate(replyEvent(reply));
    expect(update.type).toBe('addPost');
    expect(update.type === 'addPost' && update.post.id).toBe(replyId);
    expect(update.type === 'addPost' && update.post.parentId).toBe(postId);
  });
});
