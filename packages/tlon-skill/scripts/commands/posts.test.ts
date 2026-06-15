import { describe, expect, it } from 'bun:test';

import { commandError } from './command';
import {
  POSTS_REACT_HELP,
  type PostReactionInput,
  type PostsDeps,
  run,
} from './posts';

function makeDeps(
  options: {
    currentUserId?: string;
    authenticate?: () => Promise<void>;
    addReaction?: (input: PostReactionInput) => Promise<void>;
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    getCurrentUserId: 0,
    addReaction: [] as PostReactionInput[],
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
    postsApi: {
      addReaction: async (input) => {
        calls.addReaction.push(input);
        calls.order.push('addReaction');
        await options.addReaction?.(input);
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

describe('posts command run', () => {
  it('prints react help without authenticating or calling the API', async () => {
    const context = makeDeps();

    const exitCode = await run(['react', '--help'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`${POSTS_REACT_HELP}\n`);
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticate).toBe(0);
    expect(context.calls.getCurrentUserId).toBe(0);
    expect(context.calls.addReaction).toEqual([]);
  });

  it('prints react help for help tokens in positional slots', async () => {
    const cases = [
      ['react', 'chat/~host/channel', '--help'],
      ['react', 'chat/~host/channel', '170.141', '-h'],
      ['react', 'chat/~host/channel', '170.141', '👍', '--help'],
    ];

    for (const args of cases) {
      const context = makeDeps();
      const exitCode = await run(args, context.deps);

      expect(exitCode).toBe(0);
      expect(context.stdout()).toBe(`${POSTS_REACT_HELP}\n`);
      expect(context.stderr()).toBe('');
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.getCurrentUserId).toBe(0);
      expect(context.calls.addReaction).toEqual([]);
    }
  });

  it('returns a usage error for non-react subcommands without auth or API work', async () => {
    const context = makeDeps();

    const exitCode = await run(['unreact'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(`${POSTS_REACT_HELP}\n`);
    expect(context.calls.authenticate).toBe(0);
    expect(context.calls.getCurrentUserId).toBe(0);
    expect(context.calls.addReaction).toEqual([]);
  });

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
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.getCurrentUserId).toBe(0);
      expect(context.calls.addReaction).toEqual([]);
    }
  });

  it('builds reaction payloads for dotted, undotted, and author-prefixed post ids', async () => {
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

  it('authenticates once, reads the current user once, and writes success output', async () => {
    const context = makeDeps({ currentUserId: '~nec' });

    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141184', '🔥'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reaction added\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.getCurrentUserId).toBe(1);
    expect(context.calls.addReaction).toHaveLength(1);
    expect(context.calls.order).toEqual([
      'authenticate',
      'getCurrentUserId',
      'addReaction',
    ]);
    expect(context.calls.addReaction[0]).toMatchObject({
      channelId: 'chat/~host/channel',
      postId: '170.141.184',
      emoji: '🔥',
      our: '~nec',
      postAuthor: '~nec',
    });
  });

  it('ignores extra args after the emoji', async () => {
    const context = makeDeps();

    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141184', '👍', 'ignored'],
      context.deps
    );

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe('✓ Reaction added\n');
    expect(context.stderr()).toBe('');
    expect(context.calls.addReaction).toHaveLength(1);
    expect(context.calls.addReaction[0].emoji).toBe('👍');
  });

  it('formats expected facade failures through the shared command-error path', async () => {
    const context = makeDeps({
      addReaction: async () => {
        throw commandError('reaction API unavailable');
      },
    });

    const exitCode = await run(
      ['react', 'chat/~host/channel', '170141184', '👍'],
      context.deps
    );

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: reaction API unavailable\n');
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.getCurrentUserId).toBe(1);
    expect(context.calls.addReaction).toHaveLength(1);
  });

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
