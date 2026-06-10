import { describe, expect, it } from 'bun:test';

import { commandError } from './command';
import {
  type ExistingPost,
  POSTS_COMMAND_HELP,
  POSTS_HELP,
  POSTS_REACT_HELP,
  type PostDeleteInput,
  type PostEditInput,
  type PostLookupQuery,
  type PostLookupResult,
  type PostReactionInput,
  type PostReactionRemoveInput,
  type PostsDeps,
  run,
} from './posts';

interface MakeDepsOptions {
  currentUserId?: string;
  now?: number;
  authenticate?: () => Promise<void>;
  addReaction?: (input: PostReactionInput) => Promise<void>;
  removeReaction?: (input: PostReactionRemoveInput) => Promise<void>;
  deletePost?: (input: PostDeleteInput) => Promise<void>;
  editPost?: (input: PostEditInput) => Promise<void>;
  getChannelPosts?: (query: PostLookupQuery) => Promise<PostLookupResult>;
  readFile?: (path: string) => string;
}

function makeDeps(options: MakeDepsOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    getCurrentUserId: 0,
    now: 0,
    readFile: [] as string[],
    addReaction: [] as PostReactionInput[],
    removeReaction: [] as PostReactionRemoveInput[],
    deletePost: [] as PostDeleteInput[],
    editPost: [] as PostEditInput[],
    getChannelPosts: [] as PostLookupQuery[],
    order: [] as string[],
  };

  const deps: PostsDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
      calls.order.push('authenticate');
      await options.authenticate?.();
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
    readFile: (path) => {
      calls.readFile.push(path);
      calls.order.push('readFile');
      if (options.readFile) return options.readFile(path);
      throw new Error(`ENOENT: no such file, open '${path}'`);
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
  expect(context.calls.getChannelPosts).toEqual([]);
  expect(context.calls.readFile).toEqual([]);
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

  it('reports unsupported send/reply with exact text before auth', async () => {
    const cases = [
      {
        args: ['send'],
        message:
          'Error: Channel post send is handled by the Tlon channel plugin.\nUse the channel message tool with channel=tlon instead.\n',
      },
      {
        args: ['reply'],
        message:
          'Error: Channel post reply is handled by the Tlon channel plugin.\nUse the channel message tool with channel=tlon and replyTo instead.\n',
      },
    ];

    for (const testCase of cases) {
      const context = makeDeps();
      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(testCase.message);
      expectNoAuthOrApi(context);
    }
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

  it('requires a message or a --content value before auth', async () => {
    const cases = [
      ['edit', 'chat/~host/channel', '170.141'],
      ['edit', 'chat/~host/channel', '170.141', '--content'],
      ['edit', 'chat/~host/channel', '170.141', '--content', '--title'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`${POSTS_COMMAND_HELP.edit}\n`);
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

  it('lets explicit --title and --image override existing metadata', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(existing),
    });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        'Body',
        '--title',
        'New Title',
        '--image',
        'https://example.com/new.jpg',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: 'New Title',
      image: 'https://example.com/new.jpg',
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
      ['edit', 'chat/~host/channel', '170.141.184', 'Body', '--title', 'T'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata).toEqual({
      title: 'T',
      image: undefined,
      description: undefined,
      cover: undefined,
    });
  });

  it('reads rich content from a --content JSON file', async () => {
    const story = [{ inline: ['from file'] }];
    const context = makeDeps({
      getChannelPosts: withExistingPost(existing),
      readFile: () => JSON.stringify(story),
    });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        '--content',
        'article.json',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Post edited\n');
    expect(context.calls.readFile).toEqual(['article.json']);
    expect(context.calls.editPost[0].content).toEqual(story);
  });

  it('excludes tokens after the first edit flag from the message', async () => {
    const context = makeDeps({ getChannelPosts: withExistingPost(null) });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        'keep',
        'this',
        '--title',
        'T',
        'dropped',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].content).toEqual([
      { inline: ['keep this'] },
    ]);
  });

  it('authenticates and looks up the post before reading the content file', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(null),
      readFile: () => {
        throw new Error("ENOENT: no such file, open 'missing.json'");
      },
    });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        '--content',
        'missing.json',
      ],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.calls.order).toEqual([
      'authenticate',
      'getChannelPosts',
      'readFile',
    ]);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      "Error: ENOENT: no such file, open 'missing.json'\n"
    );
    expect(context.stderr()).not.toContain('    at ');
    expect(context.calls.editPost).toEqual([]);
  });

  it('reports invalid --content JSON as a stable error without a stack', async () => {
    const context = makeDeps({
      getChannelPosts: withExistingPost(null),
      readFile: () => 'not json{',
    });

    const exitCode = await run(
      ['edit', 'chat/~host/channel', '170.141.184', '--content', 'bad.json'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toMatch(/^Error: /);
    expect(context.stderr()).not.toContain('    at ');
    expect(context.calls.editPost).toEqual([]);
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

  it('takes the next flag as the title value when a value is omitted', async () => {
    const context = makeDeps({ getChannelPosts: withExistingPost(null) });

    const exitCode = await run(
      [
        'edit',
        'chat/~host/channel',
        '170.141.184',
        'Body',
        '--title',
        '--image',
        'https://example.com/x.jpg',
      ],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.calls.editPost[0].metadata.title).toBe('--image');
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
