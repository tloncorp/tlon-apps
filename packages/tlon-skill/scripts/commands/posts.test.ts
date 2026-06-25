import { describe, expect, it } from 'bun:test';

import { DIARY_REMOVED, NOTES_CHANNEL_CONTENT_UNSUPPORTED } from '../cli-utils';
import type { StoryVerse } from '../story';
import { commandError } from './command';
import {
  type ExistingPost,
  POSTS_COMMAND_HELP,
  POSTS_HELP,
  POSTS_REACT_HELP,
  type PostAuthApp,
  type PostDeleteInput,
  type PostEditInput,
  type PostLookupQuery,
  type PostLookupResult,
  type PostReactionInput,
  type PostReactionRemoveInput,
  type PostReplyInput,
  type PostSendInput,
  type PostsDeps,
  run,
} from './posts';

const IMAGE_VERSE: StoryVerse = {
  block: { image: { src: 'https://x/y.png', width: 10, height: 20, alt: 'y' } },
};

interface MakeDepsOptions {
  currentUserId?: string;
  now?: number;
  authenticate?: (apps: PostAuthApp[]) => Promise<void>;
  addReaction?: (input: PostReactionInput) => Promise<void>;
  removeReaction?: (input: PostReactionRemoveInput) => Promise<void>;
  deletePost?: (input: PostDeleteInput) => Promise<void>;
  editPost?: (input: PostEditInput) => Promise<void>;
  sendPost?: (input: PostSendInput) => Promise<void>;
  sendReply?: (input: PostReplyInput) => Promise<void>;
  getChannelPosts?: (query: PostLookupQuery) => Promise<PostLookupResult>;
  buildImageVerse?: (url: string) => Promise<StoryVerse>;
}

function makeDeps(options: MakeDepsOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    authenticateApps: [] as PostAuthApp[][],
    getCurrentUserId: 0,
    now: 0,
    buildImageVerse: [] as string[],
    addReaction: [] as PostReactionInput[],
    removeReaction: [] as PostReactionRemoveInput[],
    deletePost: [] as PostDeleteInput[],
    editPost: [] as PostEditInput[],
    sendPost: [] as PostSendInput[],
    sendReply: [] as PostReplyInput[],
    getChannelPosts: [] as PostLookupQuery[],
    order: [] as string[],
  };

  const deps: PostsDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async (apps) => {
      calls.authenticate += 1;
      calls.authenticateApps.push(apps);
      calls.order.push('authenticate');
      await options.authenticate?.(apps);
    },
    getCurrentUserId: () => {
      calls.getCurrentUserId += 1;
      calls.order.push('getCurrentUserId');
      return options.currentUserId ?? '~zod';
    },
    now: () => {
      calls.now += 1;
      calls.order.push('now');
      return options.now ?? 1700000000000;
    },
    buildImageVerse: async (url) => {
      calls.buildImageVerse.push(url);
      calls.order.push('buildImageVerse');
      if (options.buildImageVerse) return options.buildImageVerse(url);
      return IMAGE_VERSE;
    },
    postsApi: {
      addReaction: async (input) => {
        calls.addReaction.push(input);
        calls.order.push('addReaction');
        await options.addReaction?.(input);
      },
      removeReaction: async (input) => {
        calls.removeReaction.push(input);
        calls.order.push('removeReaction');
        await options.removeReaction?.(input);
      },
      deletePost: async (input) => {
        calls.deletePost.push(input);
        calls.order.push('deletePost');
        await options.deletePost?.(input);
      },
      editPost: async (input) => {
        calls.editPost.push(input);
        calls.order.push('editPost');
        await options.editPost?.(input);
      },
      sendPost: async (input) => {
        calls.sendPost.push(input);
        calls.order.push('sendPost');
        await options.sendPost?.(input);
      },
      sendReply: async (input) => {
        calls.sendReply.push(input);
        calls.order.push('sendReply');
        await options.sendReply?.(input);
      },
      getChannelPosts: async (query) => {
        calls.getChannelPosts.push(query);
        calls.order.push('getChannelPosts');
        return (await options.getChannelPosts?.(query)) ?? { posts: [] };
      },
    },
  };

  return {
    deps,
    calls,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

function expectNoAuthOrApi(context: ReturnType<typeof makeDeps>) {
  expect(context.calls.authenticate).toBe(0);
  expect(context.calls.getCurrentUserId).toBe(0);
  expect(context.calls.addReaction).toEqual([]);
  expect(context.calls.removeReaction).toEqual([]);
  expect(context.calls.deletePost).toEqual([]);
  expect(context.calls.editPost).toEqual([]);
  expect(context.calls.sendPost).toEqual([]);
  expect(context.calls.sendReply).toEqual([]);
  expect(context.calls.getChannelPosts).toEqual([]);
  expect(context.calls.buildImageVerse).toEqual([]);
}

describe('posts command help and shell', () => {
  it('prints family help for posts --help and -h without auth/API work', async () => {
    for (const flag of ['--help', '-h']) {
      const context = makeDeps();
      const exitCode = await run([flag], context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${POSTS_HELP}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrApi(context);
    }
  });

  it('prints per-subcommand help for help tokens after the subcommand', async () => {
    const cases = [
      { args: ['send', '--help'], help: POSTS_COMMAND_HELP.send },
      { args: ['reply', '-h'], help: POSTS_COMMAND_HELP.reply },
      { args: ['react', '--help'], help: POSTS_COMMAND_HELP.react },
      { args: ['unreact', '-h'], help: POSTS_COMMAND_HELP.unreact },
      { args: ['delete', '--help'], help: POSTS_COMMAND_HELP.delete },
      { args: ['edit', '--help'], help: POSTS_COMMAND_HELP.edit },
      {
        args: ['unreact', 'chat/~host/channel', '--help'],
        help: POSTS_COMMAND_HELP.unreact,
      },
    ];

    for (const testCase of cases) {
      const context = makeDeps();
      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${testCase.help}\n`);
      expect(context.stderr()).toBe('');
      expectNoAuthOrApi(context);
    }
  });

  it('prints family help for unknown subcommands with a help token', async () => {
    const context = makeDeps();
    const exitCode = await run(['bogus', '--help'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`${POSTS_HELP}\n`);
    expect(context.stderr()).toBe('');
    expectNoAuthOrApi(context);
  });

  it('returns a family usage error for bare posts without auth/API work', async () => {
    const context = makeDeps();
    const exitCode = await run([], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_HELP}\n`);
    expectNoAuthOrApi(context);
  });

  it('returns a family usage error for unknown subcommands without auth/API work', async () => {
    const context = makeDeps();
    const exitCode = await run(['bogus'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_HELP}\n`);
    expectNoAuthOrApi(context);
  });
});

describe('posts send', () => {
  it('fails missing channel/message before auth or API work', async () => {
    for (const args of [['send'], ['send', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('rejects a malformed --image flag before auth', async () => {
    const missingValue = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--image'],
        missingValue.deps
      )
    ).toBe(1);
    expect(missingValue.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);
    expectNoAuthOrApi(missingValue);

    const nonHttp = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', '--image', 'ftp://x/y.png'],
        nonHttp.deps
      )
    ).toBe(1);
    expect(nonHttp.stderr()).toBe(
      'Error: --image must be an http(s) image URL — upload first with `tlon upload`\n'
    );
    expectNoAuthOrApi(nonHttp);
  });

  it('rejects a malformed --blob flag before auth', async () => {
    const missingValue = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--blob'],
        missingValue.deps
      )
    ).toBe(1);
    expect(missingValue.stderr()).toBe(`${POSTS_COMMAND_HELP.send}\n`);

    const nonArray = makeDeps();
    expect(
      await run(
        ['send', 'chat/~host/channel', 'hi', '--blob', '{"a":1}'],
        nonArray.deps
      )
    ).toBe(1);
    expect(nonArray.stderr()).toBe(
      'Error: --blob must be a JSON array of post-blob entries\n'
    );
    expectNoAuthOrApi(nonArray);
  });

  it('sends a plain message and authenticates against channels', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 42 });
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'Hello', 'there'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Message sent\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.sendPost).toEqual([
      {
        channelId: 'chat/~host/channel',
        authorId: '~nec',
        sentAt: 42,
        content: [{ inline: ['Hello there'] }],
        blob: undefined,
      },
    ]);
  });

  it('authenticates against chat for DM and group-DM targets', async () => {
    for (const target of ['~sampel-palnet', '0v5.abcde']) {
      const context = makeDeps();
      await run(['send', target, 'hi'], context.deps);
      expect(context.calls.authenticateApps).toEqual([['chat']]);
    }
  });

  it('fetches the image after auth and puts the block before the caption', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['send', 'chat/~host/channel', 'caption', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.order).toEqual([
      'authenticate',
      'buildImageVerse',
      'getCurrentUserId',
      'now',
      'sendPost',
    ]);
    expect(context.calls.buildImageVerse).toEqual(['https://x/y.png']);
    expect(context.calls.sendPost[0].content).toEqual([
      IMAGE_VERSE,
      { inline: ['caption'] },
    ]);
  });

  it('sends an image-only post with no caption', async () => {
    const context = makeDeps();
    await run(
      ['send', 'chat/~host/channel', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(context.calls.sendPost[0].content).toEqual([IMAGE_VERSE]);
  });

  it('passes a validated --blob through to the payload', async () => {
    const context = makeDeps();
    await run(
      ['send', 'chat/~host/channel', 'hi', '--blob', '[{"type":"a2ui"}]'],
      context.deps
    );

    expect(context.calls.sendPost[0].blob).toBe('[{"type":"a2ui"}]');
  });

  it('wraps image fetch failures as a stable command error after auth', async () => {
    const context = makeDeps({
      buildImageVerse: async () => {
        throw new Error('Failed to fetch image: 404');
      },
    });

    const exitCode = await run(
      ['send', 'chat/~host/channel', '--image', 'https://x/y.png'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: Failed to fetch image: 404\n');
    expect(context.stderr()).not.toContain('    at ');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.sendPost).toEqual([]);
  });
});

describe('posts reply', () => {
  it('fails missing args before auth or API work', async () => {
    const cases = [
      ['reply'],
      ['reply', 'chat/~host/channel'],
      ['reply', 'chat/~host/channel', '170.141'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.reply}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('fails a --author flag with no value before auth', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi', '--author'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.reply}\n`);
    expectNoAuthOrApi(context);
  });

  it('replies, formatting the parent id and defaulting the parent author', async () => {
    const context = makeDeps({ currentUserId: '~nec', now: 7 });
    const exitCode = await run(
      ['reply', 'chat/~host/channel', '~sampel/170141184', 'Thread', 'reply'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reply sent\n');
    expect(context.calls.authenticateApps).toEqual([['channels']]);
    expect(context.calls.sendReply).toEqual([
      {
        channelId: 'chat/~host/channel',
        parentId: '170.141.184',
        parentAuthor: '~nec',
        content: [{ inline: ['Thread reply'] }],
        sentAt: 7,
        authorId: '~nec',
      },
    ]);
  });

  it('uses an explicit --author as the parent author', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi', '--author', '~bus'],
      context.deps
    );

    expect(context.calls.sendReply[0].parentAuthor).toBe('~bus');
  });

  it('defaults the parent author to a one-to-one DM target', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    await run(['reply', '~sampel-palnet', '170.141', 'hi'], context.deps);

    expect(context.calls.authenticateApps).toEqual([['chat']]);
    expect(context.calls.sendReply[0].parentAuthor).toBe('~sampel-palnet');
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      sendReply: async () => {
        throw commandError('reply failed');
      },
    });

    const exitCode = await run(
      ['reply', 'chat/~host/channel', '170.141', 'hi'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: reply failed\n');
  });
});

describe('posts react', () => {
  it('fails missing react args before auth or API work', async () => {
    const cases = [
      ['react'],
      ['react', 'chat/~host/channel'],
      ['react', 'chat/~host/channel', '170.141'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_REACT_HELP}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('builds reaction payloads for dotted, undotted, and author-prefixed ids', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~bus' });
      const exitCode = await run(
        ['react', 'chat/~host/channel', testCase.rawPostId, '👍'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Reaction added\n');
      expect(context.calls.addReaction).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          emoji: '👍',
          our: '~bus',
          postAuthor: '~bus',
        },
      ]);
    }
  });

  it('authenticates once before reacting and ignores extra args', async () => {
    const context = makeDeps({ currentUserId: '~nec' });
    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141184', '🔥', 'ignored'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reaction added\n');
    expect(context.calls.order).toEqual([
      'authenticate',
      'getCurrentUserId',
      'addReaction',
    ]);
    expect(context.calls.addReaction[0]).toMatchObject({
      postId: '170.141.184',
      emoji: '🔥',
      our: '~nec',
      postAuthor: '~nec',
    });
  });
});

describe('posts unreact', () => {
  it('fails missing args before auth or API work', async () => {
    for (const args of [['unreact'], ['unreact', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.unreact}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('removes a reaction with postAuthor set to the current user', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~bus' });
      const exitCode = await run(
        ['unreact', 'chat/~host/channel', testCase.rawPostId, 'extra'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Reaction removed\n');
      expect(context.stderr()).toBe('');
      expect(context.calls.order).toEqual([
        'authenticate',
        'getCurrentUserId',
        'removeReaction',
      ]);
      expect(context.calls.removeReaction).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          our: '~bus',
          postAuthor: '~bus',
        },
      ]);
    }
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      removeReaction: async () => {
        throw commandError('remove failed');
      },
    });

    const exitCode = await run(
      ['unreact', 'chat/~host/channel', '170141184'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: remove failed\n');
  });
});

describe('posts delete', () => {
  it('fails missing args before auth or API work', async () => {
    for (const args of [['delete'], ['delete', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.delete}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('deletes a post with the formatted id and current user as author', async () => {
    const cases = [
      { rawPostId: '170.141.184', expectedPostId: '170.141.184' },
      { rawPostId: '170141184', expectedPostId: '170.141.184' },
      { rawPostId: '~sampel/170141184', expectedPostId: '170.141.184' },
    ];

    for (const testCase of cases) {
      const context = makeDeps({ currentUserId: '~nec' });
      const exitCode = await run(
        ['delete', 'chat/~host/channel', testCase.rawPostId, 'ignored'],
        context.deps
      );

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe('✓ Post deleted\n');
      expect(context.stderr()).toBe('');
      expect(context.calls.order).toEqual([
        'authenticate',
        'getCurrentUserId',
        'deletePost',
      ]);
      expect(context.calls.deletePost).toEqual([
        {
          channelId: 'chat/~host/channel',
          postId: testCase.expectedPostId,
          authorId: '~nec',
        },
      ]);
    }
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      deletePost: async () => {
        throw commandError('delete failed');
      },
    });

    const exitCode = await run(
      ['delete', 'chat/~host/channel', '170141184'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: delete failed\n');
  });
});

describe('posts edit', () => {
  const existing: ExistingPost = {
    id: '170.141.184',
    title: 'Old Title',
    image: 'https://example.com/old.jpg',
    description: 'old description',
    cover: 'https://example.com/old-cover.jpg',
  };

  function withExistingPost(post: ExistingPost | null) {
    return async (): Promise<PostLookupResult> => ({
      posts: post ? [post] : [],
    });
  }

  it('fails missing channel/post id before auth or API work', async () => {
    for (const args of [['edit'], ['edit', 'chat/~host/channel']]) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.edit}\n`);
      expectNoAuthOrApi(context);
    }
  });

  it('requires a message before auth or API work', async () => {
    const context = makeDeps();
    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.edit}\n`);
    expectNoAuthOrApi(context);
  });

  it('refuses the removed --title/--image/--content flags before auth', async () => {
    const cases = [
      ['edit', 'chat/~host/channel', '170.141', 'Body', '--title', 'T'],
      [
        'edit',
        'chat/~host/channel',
        '170.141',
        'Body',
        '--image',
        'https://x/y.png',
      ],
      ['edit', 'chat/~host/channel', '170.141', '--content', 'article.json'],
      // A help token does not rescue a removed flag — it still refuses.
      ['edit', 'chat/~host/channel', '170.141', '--title', '--help'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(
        'no longer supports --title/--image/--content'
      );
      expect(context.stderr()).not.toContain('Usage:');
      expectNoAuthOrApi(context);
    }
  });

  it('edits with a markdown message and preserves existing metadata', async () => {
    const context = makeDeps({
      currentUserId: '~nec',
      now: 1234,
      getChannelPosts: withExistingPost(existing),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Updated', 'message'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post edited\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.getChannelPosts).toEqual([
      {
        channelId: 'chat/~host/channel',
        cursor: '170.141.184',
        mode: 'around',
        count: 1,
        includeReplies: false,
      },
    ]);
    expect(context.calls.editPost).toHaveLength(1);
    const payload = context.calls.editPost[0];
    expect(payload.channelId).toBe('chat/~host/channel');
    expect(payload.postId).toBe('170.141.184');
    expect(payload.authorId).toBe('~nec');
    expect(payload.sentAt).toBe(1234);
    expect(payload.metadata).toEqual({
      title: 'Old Title',
      image: 'https://example.com/old.jpg',
      description: 'old description',
      cover: 'https://example.com/old-cover.jpg',
    });
    expect(payload.content).toEqual([{ inline: ['Updated message'] }]);
  });

  it('preserves existing metadata as-is without flag overrides', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(existing),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: 'Old Title',
      image: 'https://example.com/old.jpg',
      description: 'old description',
      cover: 'https://example.com/old-cover.jpg',
    });
  });

  it('uses undefined metadata fields when the lookup returns null', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(null),
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: undefined,
      image: undefined,
      description: undefined,
      cover: undefined,
    });
  });

  it('treats a failed existing-post lookup as no existing metadata', async () => {
    const context = makeDeps({
      getChannelPosts: async () => {
        throw new Error('lookup boom');
      },
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: undefined,
      image: undefined,
      description: undefined,
      cover: undefined,
    });
  });

  it('treats every token after the post id as the message', async () => {
    const context = makeDeps({ getChannelPosts: withExistingPost(null) });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'keep', 'this', 'message'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].content).toEqual([
      { inline: ['keep this message'] },
    ]);
  });

  it('treats --help in the message slot as edit content reaching the API', async () => {
    const context = makeDeps({ getChannelPosts: withExistingPost(null) });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', '--help'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post edited\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.editPost[0].content).toEqual([{ inline: ['--help'] }]);
  });

  it('passes the injected clock through to the editPost payload', async () => {
    const context = makeDeps({
      now: 999,
      getChannelPosts: withExistingPost(null),
    });

    await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(context.calls.editPost[0].sentAt).toBe(999);
  });

  it('routes facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(null),
      editPost: async () => {
        throw commandError('edit failed');
      },
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', 'Body'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe('Error: edit failed\n');
  });
});

describe('posts diary nest refusal', () => {
  const cases: Array<[string, string[]]> = [
    ['send', ['send', 'diary/~host/blog', 'hi']],
    ['reply', ['reply', 'diary/~host/blog', '170.141', 'hi']],
    ['react', ['react', 'diary/~host/blog', '170.141', '👍']],
    ['unreact', ['unreact', 'diary/~host/blog', '170.141']],
    ['delete', ['delete', 'diary/~host/blog', '170.141']],
    ['edit', ['edit', 'diary/~host/blog', '170.141', 'Body']],
    // A diary nest with an *incidental* arg problem still refuses with
    // DIARY_REMOVED — the diary check precedes per-subcommand validation.
    ['react missing emoji', ['react', 'diary/~host/blog', '170.141']],
    [
      'edit removed flag',
      ['edit', 'diary/~host/blog', '170.141', '--title', 'T'],
    ],
  ];

  for (const [name, args] of cases) {
    it(`refuses a diary nest on ${name} before auth or API work`, async () => {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${DIARY_REMOVED}\n`);
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts notes nest refusal', () => {
  const cases: Array<[string, string[]]> = [
    ['send', ['send', 'notes/~host/blog', 'hi']],
    ['reply', ['reply', 'notes/~host/blog', '170.141', 'hi']],
    ['react', ['react', 'notes/~host/blog', '170.141', '👍']],
    ['unreact', ['unreact', 'notes/~host/blog', '170.141']],
    ['delete', ['delete', 'notes/~host/blog', '170.141']],
    ['edit', ['edit', 'notes/~host/blog', '170.141', 'Body']],
    // Match diary behavior: the notes-target refusal wins over incidental arg
    // validation errors on the same command.
    ['react missing emoji', ['react', 'notes/~host/blog', '170.141']],
  ];

  for (const [name, args] of cases) {
    it(`refuses a notes nest on ${name} before auth or API work`, async () => {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: ${NOTES_CHANNEL_CONTENT_UNSUPPORTED}\n`
      );
      expectNoAuthOrApi(context);
    });
  }
});

describe('posts unexpected errors', () => {
  it('leaves unexpected exceptions for the adapter formatter', async () => {
    const context = makeDeps({
      addReaction: async () => {
        throw new Error('unexpected reaction failure');
      },
    });

    await expect(
      run(['react', 'chat/~host/channel', '170141184', '👍'], context.deps)
    ).rejects.toThrow('unexpected reaction failure');

    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('');
  });
});
