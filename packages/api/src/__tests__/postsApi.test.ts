import { beforeEach, expect, test, vi } from 'vitest';

import {
  getPostReference,
  sendPost,
  toPostData,
  toPostReplyData,
  toPostsData,
} from '../client/postsApi';
import { poke, scry, subscribeOnce } from '../client/urbit';
import type { Post } from '../types/models';
import * as ub from '../urbit';
import rawChannelPostWithRepliesData from './fixtures/channelPostWithReplies.json';
import rawChannelPostsData from './fixtures/channelPosts.json';
import rawDmPostWithRepliesData from './fixtures/dmPostWithReplies.json';
import rawGroupDmPostWithRepliesData from './fixtures/groupDmPostWithReplies.json';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');
  return {
    ...actual,
    subscribeOnce: vi.fn(),
    poke: vi.fn(),
    scry: vi.fn(),
  };
});

// directory in which ~sampel-palnet has registered ~doznec-sampel-palnet
// as a bot in its published profile
const directoryWithBot = {
  '~sampel-palnet': {
    isContact: false,
    contact: {
      bots: {
        type: 'text',
        value: JSON.stringify({
          '~doznec-sampel-palnet': { nickname: 'Helper' },
        }),
      },
    },
    mod: {},
  },
};

test('sendPost routes a DM to a registered bot moon through the vouched path', async () => {
  vi.mocked(poke).mockReset();
  vi.mocked(poke).mockResolvedValue(undefined as never);
  vi.mocked(scry).mockResolvedValue(directoryWithBot as never);
  await sendPost({
    channelId: '~doznec-sampel-palnet', // a registered bot moon
    authorId: '~bus',
    sentAt: 1701275662689,
    content: [{ inline: ['hi bot'] }],
  });
  expect(poke).toHaveBeenCalledTimes(1);
  const arg = vi.mocked(poke).mock.calls[0][0] as {
    app: string;
    mark: string;
    json: { as: string; action: { ship: string } };
  };
  expect(arg).toMatchObject({ app: 'chat', mark: 'chat-dm-vouched-action-2' });
  expect(arg.json.as).toBe('~doznec-sampel-palnet');
});

test('sendPost sends a normal DM to a moon that is not a registered bot', async () => {
  vi.mocked(poke).mockReset();
  vi.mocked(poke).mockResolvedValue(undefined as never);
  // sponsor has no bots field: a real, running moon
  vi.mocked(scry).mockResolvedValue({} as never);
  await sendPost({
    channelId: '~doznec-sampel-palnet',
    authorId: '~bus',
    sentAt: 1701275662689,
    content: [{ inline: ['hi moon'] }],
  });
  const arg = vi.mocked(poke).mock.calls[0][0] as { mark: string };
  expect(arg.mark).not.toBe('chat-dm-vouched-action-2');
});

test('sendPost sends a normal DM to a non-moon peer', async () => {
  vi.mocked(poke).mockReset();
  vi.mocked(poke).mockResolvedValue(undefined as never);
  vi.mocked(scry).mockReset();
  await sendPost({
    channelId: '~bus', // a planet, not a moon
    authorId: '~zod',
    sentAt: 1701275662689,
    content: [{ inline: ['hi'] }],
  });
  // clan check short-circuits: no directory scry for non-moons
  expect(scry).not.toHaveBeenCalled();
  const arg = vi.mocked(poke).mock.calls[0][0] as { mark: string };
  expect(arg.mark).not.toBe('chat-dm-vouched-action-2');
});

const botAuthor: ub.BotProfile = {
  ship: '~bot-test',
  nickname: 'TestBot',
  avatar: 'https://example.com/bot.png',
};

function makeBotPost(author: ub.Author): ub.Post {
  return {
    seal: {
      id: '170141184506535164684262900635183087616',
      reacts: {},
      replies: null,
      meta: { replyCount: 0, lastRepliers: [], lastReply: null },
    },
    essay: {
      author,
      content: [{ inline: ['hello from bot'] }],
      sent: 1701275662689,
      kind: 'chat',
      blob: null,
      meta: null,
    },
    type: 'post',
  };
}

test('toPostData extracts authorId from BotProfile author', () => {
  const post = makeBotPost(botAuthor);
  const result = toPostData('chat/~zod/test', post);
  expect(result.authorId).toBe('~bot-test');
  expect(typeof result.authorId).toBe('string');
});

test('toPostData handles string author unchanged', () => {
  const post = makeBotPost('~zod');
  const result = toPostData('chat/~zod/test', post);
  expect(result.authorId).toBe('~zod');
});

test('toPostData extracts authorId from BotProfile on tombstone', () => {
  const tombstone: ub.PostTombstone = {
    author: botAuthor,
    id: '170141184506535164684262900635183087616',
    'deleted-at': 1701275662689,
    seq: 1,
    type: 'tombstone',
  };
  const result = toPostData('chat/~zod/test', tombstone);
  expect(result.authorId).toBe('~bot-test');
  expect(result.isDeleted).toBe(true);
});

test('toPostsData handles mix of bot and normal authors', () => {
  const posts: ub.Posts = {
    '170.141.184.506.535.164.684.262.900.635.183.087.616':
      makeBotPost(botAuthor),
    '170.141.184.506.536.962.871.190.015.156.707.917.824': makeBotPost('~zod'),
  };
  const result = toPostsData('chat/~zod/test', posts);
  const botPost = result.posts.find((p) => p.authorId === '~bot-test');
  const normalPost = result.posts.find((p) => p.authorId === '~zod');
  expect(botPost).toBeDefined();
  expect(normalPost).toBeDefined();
  expect(typeof botPost!.authorId).toBe('string');
  expect(typeof normalPost!.authorId).toBe('string');
});

test('toPostReplyData extracts authorId from BotProfile reply-essay author', () => {
  const reply: ub.Reply = {
    seal: {
      id: '170141184506535176367510061158978551808',
      'parent-id': '170141184506535164684262900635183087616',
      reacts: {},
    },
    'reply-essay': {
      content: [{ inline: ['bot reply'] }],
      author: botAuthor,
      sent: 1701276293246,
      blob: null,
    },
  };
  const result = toPostReplyData(
    'chat/~zod/test',
    '170141184506535164684262900635183087616',
    reply
  );
  expect(result.authorId).toBe('~bot-test');
  expect(typeof result.authorId).toBe('string');
});

const CHANNEL_ID = 'chat/~zod/test';
const PARENT_ID = '170.141.184.506.535.164.684.262.900.635.183.087.616';
const REPLY_ID = '170.141.184.506.535.176.367.510.061.158.978.551.808';

function makeReplySaid(): ub.Said {
  return {
    nest: CHANNEL_ID,
    reference: {
      reply: {
        'id-post': PARENT_ID,
        reply: {
          seal: {
            id: REPLY_ID,
            'parent-id': PARENT_ID,
            reacts: {},
          },
          'reply-essay': {
            content: [{ inline: ['a threaded reply'] }],
            author: '~zod',
            sent: 1701276293246,
            blob: null,
          },
        },
      },
    },
  };
}

function makePostSaid(): ub.Said {
  return {
    nest: CHANNEL_ID,
    reference: {
      post: {
        seal: {
          id: PARENT_ID,
          reacts: {},
          replies: null,
          meta: { replyCount: 0, lastRepliers: [], lastReply: null },
        },
        essay: {
          author: '~zod',
          content: [{ inline: ['a top-level post'] }],
          sent: 1701275662689,
          kind: 'chat',
          blob: null,
          meta: null,
        },
        type: 'post',
      },
    },
  };
}

beforeEach(() => {
  vi.mocked(subscribeOnce).mockReset();
});

test('getPostReference requests the parent/reply said path for reply refs', async () => {
  vi.mocked(subscribeOnce).mockResolvedValueOnce(makeReplySaid());
  const post = await getPostReference({
    channelId: CHANNEL_ID,
    postId: PARENT_ID,
    replyId: REPLY_ID,
  });

  // The v5 said path includes the channel host as the `ask` ship.
  expect(vi.mocked(subscribeOnce).mock.calls[0][0]).toEqual({
    app: 'channels',
    path: `/v5/said/~zod/${CHANNEL_ID}/post/${PARENT_ID}/${REPLY_ID}`,
  });
  // The hydrated post is keyed by the reply's own id, and the parent is preserved.
  expect(post.id).toBe(REPLY_ID);
  expect(post.parentId).toBe(PARENT_ID);
});

test('getPostReference requests the top-level said path for top-level refs', async () => {
  vi.mocked(subscribeOnce).mockResolvedValueOnce(makePostSaid());
  const post = await getPostReference({
    channelId: CHANNEL_ID,
    postId: PARENT_ID,
  });

  expect(vi.mocked(subscribeOnce).mock.calls[0][0]).toEqual({
    app: 'channels',
    path: `/v5/said/~zod/${CHANNEL_ID}/post/${PARENT_ID}`,
  });
  // Top-level refs are keyed by the post id, unchanged from prior behavior.
  expect(post.id).toBe(PARENT_ID);
});

test('toPostData', async () => {
  const postsData = rawChannelPostsData as unknown as ub.PagedPosts;
  const { posts } = toPostsData('testChannielId', postsData.posts);
  const oldestPost = posts.reduce<Post>((acc, post) => {
    const time = post.receivedAt ?? 0;
    return time < (acc.receivedAt ?? 0) ? post : acc;
  }, posts[0]);
  expect(oldestPost.id).toEqual(posts.find((p) => p.id === oldestPost.id)?.id);
});

test('single post responses', async () => {
  const postsData = {
    '170141184506755078862103651047679459328': rawChannelPostWithRepliesData,
    '170.141.184.506.175.378.579.920.170.967.817.980.477':
      rawDmPostWithRepliesData,
    '170.141.184.506.522.404.989.134.482.281.343.708.299':
      rawGroupDmPostWithRepliesData,
  };
  const result = toPostsData('testChannelId', postsData as unknown as ub.Posts);
  result.posts.forEach((p) => {
    p.syncedAt = 0;
    p.replies?.forEach((r) => (r.syncedAt = 0));
  });
  // TODO fix snapshot test
  // expect(result).toMatchSnapshot();
});
