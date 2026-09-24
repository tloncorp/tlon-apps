import { beforeEach, expect, test, vi } from 'vitest';

import {
  editPost,
  getChannelPosts,
  getLatestPosts,
  getPostReference,
  getPostWithReplies,
  sendPost,
  sendReply,
  toPostData,
  toPostReplyData,
  toPostsData,
  toReplyMeta,
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
    poke: vi.fn(),
    scry: vi.fn(),
    subscribeOnce: vi.fn(),
  };
});

const scryMock = scry as unknown as ReturnType<typeof vi.fn>;
const pokeMock = poke as unknown as ReturnType<typeof vi.fn>;

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

const planetBot: ub.BotProfile = {
  ship: '~sitrul-nacwyl',
  nickname: 'Planet bot',
  avatar: 'https://example.com/planet-bot.png',
};
const moonBot: ub.BotProfile = {
  ship: '~pinser-botter-malmur-halmex',
  nickname: 'Moon bot',
  avatar: 'https://example.com/moon-bot.png',
};

test.each<{
  name: string;
  authors: ub.Author[];
  expected: string[];
}>([
  {
    name: 'string authors',
    authors: ['~zod', '~nec'],
    expected: ['~zod', '~nec'],
  },
  { name: 'planet bot', authors: [planetBot], expected: [planetBot.ship] },
  { name: 'moon bot', authors: [moonBot], expected: [moonBot.ship] },
  {
    name: 'mixed authors',
    authors: [planetBot, '~zod', moonBot],
    expected: [planetBot.ship, '~zod', moonBot.ship],
  },
  { name: 'no replies', authors: [], expected: [] },
])(
  'reply metadata normalizes $name for post loads and live updates',
  ({ authors, expected }) => {
    const meta: ub.ReplyMeta = {
      replyCount: authors.length,
      lastReply: authors.length ? 1701276293246 : null,
      lastRepliers: authors,
    };
    const originalMeta = structuredClone(meta);
    const expectedMeta = {
      replyCount: meta.replyCount,
      replyTime: meta.lastReply,
      replyContactIds: expected,
    };

    expect(toReplyMeta(meta)).toEqual(expectedMeta);

    for (const channelId of ['chat/~zod/test', '~sitrul-nacwyl']) {
      const post = makeBotPost('~zod');
      post.seal.meta = meta;
      expect(toPostData(channelId, post)).toMatchObject(expectedMeta);
    }
    // Converting a post must not rewrite the wire payload's author profiles.
    expect(meta).toEqual(originalMeta);
  }
);

test('toReplyMeta preserves absent metadata', () => {
  expect(toReplyMeta(null)).toBeNull();
  expect(toReplyMeta(undefined)).toBeNull();
});

test('toPostData counts a direct %any reaction before UI normalization', () => {
  const post = makeBotPost('~zod');
  post.seal.reacts = {
    '~nec': { any: 'custom reaction' },
  };

  const result = toPostData('chat/~zod/test', post);

  expect(result.rawReactionCount).toBe(1);
  expect(result.reactions).toEqual([]);
});

test('toPostData counts bot-wrapped string and %any reactions before UI normalization', () => {
  const post = makeBotPost('~zod');
  post.seal.reacts = {
    '~bot-string': {
      ship: '~bot-string',
      nickname: 'String Bot',
      avatar: null,
      react: ':+1:',
    },
    '~bot-any': {
      ship: '~bot-any',
      nickname: 'Any Bot',
      avatar: 'https://example.com/any-bot.png',
      react: { any: 'custom bot reaction' },
    },
  } as unknown as ub.PostSeal['reacts'];

  const result = toPostData('chat/~zod/test', post);

  expect(result.rawReactionCount).toBe(2);
  expect(result.reactions).toEqual([]);
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
  pokeMock.mockReset();
});

// `botProfile` is what makes a send carry an object-shaped author — the signal
// clients read as "this is a bot". Pin it at the send boundary, not just in
// toAuthor, since only these paths decide whether it is passed through at all.
function sentAuthor(): ub.Author {
  const sent = pokeMock.mock.calls[0][0].json;
  const channelAdd = sent.channel?.action?.post;
  if (channelAdd?.add) {
    return channelAdd.add.author;
  }
  // An edit resubmits the whole essay, so it carries an author of its own.
  if (channelAdd?.edit) {
    return channelAdd.edit.essay.author;
  }
  if (channelAdd?.reply) {
    const replyAction = channelAdd.reply.action;
    return replyAction.add
      ? replyAction.add.author
      : replyAction.edit['reply-essay'].author;
  }
  // DM/club writs: a top-level send carries an essay, a reply a reply-essay.
  const delta = sent.diff.delta;
  return delta.reply
    ? delta.reply.delta.add['reply-essay'].author
    : delta.add.essay.author;
}

test('sendPost authors as a bare ship without a botProfile', async () => {
  await sendPost({
    channelId: 'chat/~zod/test',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
  });

  expect(sentAuthor()).toBe('~bot-test');
});

test('sendPost authors as a bot object with a botProfile', async () => {
  await sendPost({
    channelId: 'chat/~zod/test',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
    botProfile: { nickname: 'TestBot', avatar: 'https://example.com/bot.png' },
  });

  expect(sentAuthor()).toEqual(botAuthor);
});

test('sendPost authors a DM as a bot object with a botProfile', async () => {
  await sendPost({
    channelId: '~sampel-palnet',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
    botProfile: { nickname: 'TestBot', avatar: 'https://example.com/bot.png' },
  });

  expect(sentAuthor()).toEqual(botAuthor);
});

test('sendReply authors as a bare ship without a botProfile', async () => {
  await sendReply({
    channelId: 'chat/~zod/test',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentAuthor: '~zod',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
  });

  expect(sentAuthor()).toBe('~bot-test');
});

test('sendReply authors as a bot object with a botProfile', async () => {
  await sendReply({
    channelId: 'chat/~zod/test',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentAuthor: '~zod',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
    botProfile: { nickname: 'TestBot', avatar: 'https://example.com/bot.png' },
  });

  expect(sentAuthor()).toEqual(botAuthor);
});

test('sendReply authors a DM reply as a bot object with a botProfile', async () => {
  await sendReply({
    channelId: '~sampel-palnet',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentAuthor: '~sampel-palnet',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
    botProfile: { nickname: 'TestBot', avatar: 'https://example.com/bot.png' },
  });

  expect(sentAuthor()).toEqual(botAuthor);
});

test('sendReply authors a DM reply as a bare ship without a botProfile', async () => {
  await sendReply({
    channelId: '~sampel-palnet',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentAuthor: '~sampel-palnet',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
  });

  expect(sentAuthor()).toBe('~bot-test');
});

test('a null-valued botProfile still authors as a bot', async () => {
  await sendPost({
    channelId: 'chat/~zod/test',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['hello'] }],
    botProfile: { nickname: null, avatar: null },
  });

  expect(sentAuthor()).toEqual({
    ship: '~bot-test',
    nickname: null,
    avatar: null,
  });
});

// The %edit arm stores the submitted essay wholesale, so an edit that dropped
// the bot author would silently strip the Bot tag off an existing bot post.
test('editPost keeps a bot author on a top-level edit', async () => {
  await editPost({
    channelId: 'chat/~zod/test',
    postId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['edited'] }],
    botProfile: { nickname: null, avatar: null },
  });

  expect(sentAuthor()).toEqual({
    ship: '~bot-test',
    nickname: null,
    avatar: null,
  });
});

test('editPost authors a top-level edit as a bare ship without a botProfile', async () => {
  await editPost({
    channelId: 'chat/~zod/test',
    postId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['edited'] }],
  });

  expect(sentAuthor()).toBe('~bot-test');
});

test('editPost keeps a bot author on a reply edit', async () => {
  await editPost({
    channelId: 'chat/~zod/test',
    postId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.615',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['edited'] }],
    botProfile: { nickname: null, avatar: null },
  });

  expect(sentAuthor()).toEqual({
    ship: '~bot-test',
    nickname: null,
    avatar: null,
  });
});

test('editPost authors a reply edit as a bare ship without a botProfile', async () => {
  await editPost({
    channelId: 'chat/~zod/test',
    postId: '170.141.184.506.535.164.684.262.900.635.183.087.616',
    parentId: '170.141.184.506.535.164.684.262.900.635.183.087.615',
    authorId: '~bot-test',
    sentAt: 1701275662689,
    content: [{ inline: ['edited'] }],
  });

  expect(sentAuthor()).toBe('~bot-test');
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

function makeSequencedPost(seq: number, channelId: string): ub.Post {
  const id = `1701411845065351646842629006351830${seq}7616`;
  return {
    seal: {
      id,
      reacts: {},
      replies: null,
      meta: { replyCount: 0, lastRepliers: [], lastReply: null },
      seq,
    },
    essay: {
      author: '~zod',
      content: [{ inline: [`post ${seq}`] }],
      sent: 1701275662689 + seq,
      kind: '/chat',
      blob: null,
      meta: null,
    },
    type: 'post',
  } as unknown as ub.Post;
}

test('getChannelPosts skipGapFill: true produces no stubs; default still fills', async () => {
  const channelId = 'chat/~zod/test';
  const paged: ub.PagedPosts = {
    posts: {
      a: makeSequencedPost(1, channelId),
      b: makeSequencedPost(3, channelId),
    },
    newer: null,
    older: null,
    total: 2,
  } as unknown as ub.PagedPosts;

  scryMock.mockResolvedValue(paged);
  const withGaps = await getChannelPosts({
    channelId,
    mode: 'newest',
  });
  expect(withGaps.numStubs).toBe(1);
  expect(withGaps.posts.some((p: Post) => p.isSequenceStub === true)).toBe(
    true
  );

  scryMock.mockResolvedValue(paged);
  const withoutGaps = await getChannelPosts({
    channelId,
    mode: 'newest',
    skipGapFill: true,
  });
  expect(withoutGaps.numStubs).toBe(0);
  expect(withoutGaps.posts.some((p: Post) => p.isSequenceStub === true)).toBe(
    false
  );
  expect(withoutGaps.posts).toHaveLength(2);
});

test('getLatestPosts can propagate a request failure without mistaking it for an empty response', async () => {
  const error = new Error('heads request failed');
  scryMock.mockRejectedValueOnce(error);
  await expect(getLatestPosts({ throwOnError: true })).rejects.toBe(error);
});

test('getLatestPosts preserves the default best-effort behavior for existing callers', async () => {
  scryMock.mockRejectedValueOnce(new Error('heads request failed'));
  await expect(getLatestPosts({})).resolves.toEqual([]);
});

test('getLatestPosts accepts an empty successful response in strict mode', async () => {
  scryMock.mockResolvedValueOnce({ channels: [], dms: [] });
  await expect(getLatestPosts({ throwOnError: true })).resolves.toEqual([]);
});

test.each([
  ['chat/~zod/test', rawChannelPostWithRepliesData],
  ['~zod', rawDmPostWithRepliesData],
  ['0v4.00000.qd4mk.d4htu.er4b8.eao21', rawGroupDmPostWithRepliesData],
])(
  'reports transport completion before decoding a thread in %s',
  async (channelId, data) => {
    const onResponse = vi.fn();
    scryMock.mockResolvedValueOnce(structuredClone(data));
    const result = await getPostWithReplies({
      channelId,
      postId: '123',
      authorId: '~zod',
      onResponse,
    });
    expect(onResponse).toHaveBeenCalledOnce();
    expect(result.replies?.length).toBeGreaterThan(0);
  }
);

test('transport failure does not report a response; malformed payload does', async () => {
  const onResponse = vi.fn();
  const options = {
    channelId: 'chat/~zod/test',
    postId: '123',
    authorId: '~zod',
    onResponse,
  };
  scryMock.mockRejectedValueOnce(new Error('offline'));
  await expect(getPostWithReplies(options)).rejects.toThrow('offline');
  expect(onResponse).not.toHaveBeenCalled();
  scryMock.mockResolvedValueOnce({});
  await expect(getPostWithReplies(options)).rejects.toThrow();
  expect(onResponse).toHaveBeenCalledOnce();
});
