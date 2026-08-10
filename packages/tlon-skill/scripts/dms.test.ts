import { describe, expect, it } from 'bun:test';

// The process-wide '@tloncorp/api' mock (preloaded via bunfig.toml) is what
// importing ./dms resolves against; every dms function under test takes
// injected deps, so the mock's default implementations are never assertion
// targets. Never register a per-file mock.module for the api — see the
// module doc for the ordering trap.
import './tloncorp-api-mock';

function loadDms() {
  return import('./dms');
}

describe('dms thread reaction parents', () => {
  it('parses an author-prefixed --parent value', async () => {
    const dms = await loadDms();
    expect(
      dms.reactionParent(
        ['react', '~mug', '~pen/170.142', '👍', '--parent', '~pen/170.141'],
        'usage'
      )
    ).toBe('~pen/170.141');
  });

  it('rejects a --parent value that is itself an option token', async () => {
    const dms = await loadDms();
    const originalExit = process.exit;
    const originalError = console.error;
    const exitCodes: (number | undefined)[] = [];
    process.exit = ((code?: number) => {
      exitCodes.push(code);
      throw new Error('exit');
    }) as typeof process.exit;
    console.error = () => {};
    try {
      expect(() =>
        dms.reactionParent(
          ['react', '~mug', '~pen/170.142', '👍', '--parent', '--bogus'],
          'usage'
        )
      ).toThrow();
      expect(exitCodes).toEqual([1]);
    } finally {
      process.exit = originalExit;
      console.error = originalError;
    }
  });

  it('rejects a duplicate --parent flag', async () => {
    const dms = await loadDms();
    const originalExit = process.exit;
    const originalError = console.error;
    const exitCodes: (number | undefined)[] = [];
    process.exit = ((code?: number) => {
      exitCodes.push(code);
      throw new Error('exit');
    }) as typeof process.exit;
    console.error = () => {};
    try {
      expect(() =>
        dms.reactionParent(
          [
            'react',
            '~mug',
            '~pen/170.142',
            '👍',
            '--parent',
            '~pen/170.141',
            '--parent',
            '~pen/170.140',
          ],
          'usage'
        )
      ).toThrow();
      expect(exitCodes).toEqual([1]);
    } finally {
      process.exit = originalExit;
      console.error = originalError;
    }
  });

  it('rejects an option token in a positional react/unreact slot before API work', async () => {
    const dms = await loadDms();
    const originalExit = process.exit;
    const originalError = console.error;
    const cases = [
      // Emoji omitted: `--parent` would otherwise fill the react slot.
      ['react', '~mug', '~pen/170.142', '--parent', '~pen/170.141'],
      // Id omitted: `--parent` would otherwise fill the message-id slot.
      ['unreact', '~mug', '--parent', '~pen/170.141'],
    ];
    for (const args of cases) {
      const exitCodes: (number | undefined)[] = [];
      process.exit = ((code?: number) => {
        exitCodes.push(code);
        throw new Error('exit');
      }) as typeof process.exit;
      console.error = () => {};
      try {
        expect(() => dms.validateDmsArgs(args)).toThrow();
        expect(exitCodes).toEqual([1]);
      } finally {
        process.exit = originalExit;
        console.error = originalError;
      }
    }
  });

  it('passes parentId and parentAuthorId for react and unreact', async () => {
    const dms = await loadDms();
    const added: Record<string, unknown>[] = [];
    const removed: Record<string, unknown>[] = [];
    const deps = {
      addReaction: async (input: Record<string, unknown>) => {
        added.push(input);
      },
      removeReaction: async (input: Record<string, unknown>) => {
        removed.push(input);
      },
      getCurrentUserId: () => '~zod',
      normalizeShip: (ship: string) =>
        ship.startsWith('~') ? ship : `~${ship}`,
    };

    expect(
      await dms.reactToDM(
        '~mug',
        '~pen/170.142',
        '🔥',
        '~pen/170.141',
        deps as never
      )
    ).toEqual({ success: true });
    expect(
      await dms.unreactToDM(
        '~mug',
        '~pen/170.142',
        '~pen/170.141',
        deps as never
      )
    ).toEqual({ success: true });

    const expected = {
      channelId: '~mug',
      postId: '170.142',
      our: '~zod',
      postAuthor: '~pen',
      parentId: '170.141',
      parentAuthorId: '~pen',
    };
    expect(added).toEqual([{ ...expected, emoji: '🔥' }]);
    expect(removed).toEqual([expected]);
  });

  it('requires an author on a DM thread parent', async () => {
    const dms = await loadDms();
    const result = await dms.reactToDM(
      '~mug',
      '~pen/170.142',
      '👍',
      '170.141',
      {
        addReaction: async () => {},
        removeReaction: async () => {},
        getCurrentUserId: () => '~zod',
        normalizeShip: (ship: string) => ship,
      } as never
    );
    expect(result).toEqual({
      success: false,
      error: 'Parent ID must include author (e.g., ~ship/123.456)',
    });
  });
});

function expectUsageExit(run: () => unknown): void {
  const originalExit = process.exit;
  const originalError = console.error;
  const exitCodes: (number | undefined)[] = [];
  process.exit = ((code?: number) => {
    exitCodes.push(code);
    throw new Error('exit');
  }) as typeof process.exit;
  console.error = () => {};
  try {
    expect(run).toThrow();
    expect(exitCodes).toEqual([1]);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
}

describe('dms bot author flags', () => {
  it('parses --bot and rejects a value on it', async () => {
    const dms = await loadDms();
    const help = 'usage';

    expect(dms.dmBotProfile(['send', '0v5.abcde', 'hi'], help)).toBeUndefined();
    expect(
      dms.dmBotProfile(['send', '0v5.abcde', 'hi', '--bot'], help)
    ).toEqual({ nickname: null, avatar: null });
    expect(
      dms.dmBotProfile(
        ['reply', '0v5.abcde', '~pen/170.141', 'hi', '--bot'],
        help
      )
    ).toEqual({ nickname: null, avatar: null });
    expectUsageExit(() =>
      dms.dmBotProfile(['send', '0v5.abcde', 'hi', '--bot=Botly'], 'usage')
    );
  });

  it('rejects a malformed bot flag during send/reply validation', async () => {
    const dms = await loadDms();
    expectUsageExit(() =>
      dms.validateDmsArgs(['send', '0v5.abcde', 'hi', '--bot=Botly'])
    );
    expectUsageExit(() =>
      dms.validateDmsArgs([
        'reply',
        '0v5.abcde',
        '~pen/170.141',
        'hi',
        '--bot=Botly',
      ])
    );
  });

  it('keeps a trailing bot flag out of the message text', async () => {
    const dms = await loadDms();

    expect(
      dms.getDmSendMessage([
        'send',
        '0v5.abcde',
        'hello',
        'there',
        'friend',
        '--bot',
      ])
    ).toBe('hello there friend');
    expect(
      dms.getDmSendMessage([
        'send',
        '0v5.abcde',
        'hello',
        'there',
        '--bot',
        '--image',
        'https://x/y.png',
      ])
    ).toBe('hello there');
    expect(
      dms.getDmReplyMessage([
        'reply',
        '0v5.abcde',
        '~pen/170.141',
        'hello',
        'there',
        'friend',
        '--bot',
      ])
    ).toBe('hello there friend');
  });

  it('forwards the bot profile to the club send and reply payloads', async () => {
    const dms = await loadDms();
    const posts: Record<string, unknown>[] = [];
    const replies: Record<string, unknown>[] = [];
    const deps = {
      getCurrentUserId: () => '~bot',
      sendPost: async (input: Record<string, unknown>) => {
        posts.push(input);
      },
      sendReply: async (input: Record<string, unknown>) => {
        replies.push(input);
      },
    };

    expect(
      await dms.sendClubMessage(
        '0v5.abcde',
        'hi',
        undefined,
        { nickname: null, avatar: null },
        deps as never
      )
    ).toEqual({ success: true });
    expect(
      await dms.replyToClub(
        '0v5.abcde',
        '~pen/170.141',
        'hi',
        { nickname: null, avatar: null },
        deps as never
      )
    ).toEqual({ success: true });

    expect(posts[0].botProfile).toEqual({ nickname: null, avatar: null });
    expect(replies[0].botProfile).toEqual({ nickname: null, avatar: null });
  });

  it('omits botProfile entirely without a bot flag', async () => {
    const dms = await loadDms();
    const posts: Record<string, unknown>[] = [];
    const replies: Record<string, unknown>[] = [];
    const deps = {
      getCurrentUserId: () => '~zod',
      sendPost: async (input: Record<string, unknown>) => {
        posts.push(input);
      },
      sendReply: async (input: Record<string, unknown>) => {
        replies.push(input);
      },
    };

    await dms.sendClubMessage(
      '0v5.abcde',
      'hi',
      undefined,
      undefined,
      deps as never
    );
    await dms.replyToClub(
      '0v5.abcde',
      '~pen/170.141',
      'hi',
      undefined,
      deps as never
    );

    expect('botProfile' in posts[0]).toBe(false);
    expect('botProfile' in replies[0]).toBe(false);
  });
});

// Drives `run(argv, deps)` — the real parse-to-payload path the CLI entry point
// uses — so the argv-to-botProfile wiring in the dispatch arms is covered.
async function runDms(
  args: string[],
  deps: Record<string, unknown>
): Promise<{
  posts: Record<string, unknown>[];
  replies: Record<string, unknown>[];
}> {
  const dms = await loadDms();
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;
  const exitCodes: (number | undefined)[] = [];
  process.exit = ((code?: number) => {
    exitCodes.push(code);
    throw new Error('exit');
  }) as typeof process.exit;
  console.log = () => {};
  console.error = () => {};
  try {
    await dms.run(args, deps as never).catch((error) => {
      if (!(error instanceof Error) || error.message !== 'exit') throw error;
    });
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
  }
  expect(exitCodes).toEqual([0]);
  return {
    posts: deps.posts as Record<string, unknown>[],
    replies: deps.replies as Record<string, unknown>[],
  };
}

function makeRunDeps() {
  const posts: Record<string, unknown>[] = [];
  const replies: Record<string, unknown>[] = [];
  return {
    posts,
    replies,
    ensureClient: async () => {},
    fetchImageVerse: async () => ({ block: { image: {} } }),
    getCurrentUserId: () => '~bot',
    sendPost: async (input: Record<string, unknown>) => {
      posts.push(input);
    },
    sendReply: async (input: Record<string, unknown>) => {
      replies.push(input);
    },
  };
}

describe('dms run', () => {
  it('sends a group DM with the parsed bot profile', async () => {
    const { posts } = await runDms(
      ['send', '0v5.abcde', 'hello', 'there', '--bot'],
      makeRunDeps()
    );

    expect(posts).toEqual([
      {
        channelId: '0v5.abcde',
        authorId: '~bot',
        sentAt: expect.any(Number),
        content: [{ inline: ['hello there'] }],
        botProfile: { nickname: null, avatar: null },
      },
    ]);
  });

  it('replies in a group DM with the parsed bot profile', async () => {
    const { replies } = await runDms(
      ['reply', '0v5.abcde', '~pen/170.141', 'hi', 'there', '--bot'],
      makeRunDeps()
    );

    expect(replies).toEqual([
      {
        channelId: '0v5.abcde',
        parentId: '170.141',
        parentAuthor: '~pen',
        authorId: '~bot',
        sentAt: expect.any(Number),
        content: [{ inline: ['hi there'] }],
        botProfile: { nickname: null, avatar: null },
      },
    ]);
  });

  it('omits botProfile from a plain send and reply', async () => {
    const { posts } = await runDms(
      ['send', '0v5.abcde', 'hello'],
      makeRunDeps()
    );
    const { replies } = await runDms(
      ['reply', '0v5.abcde', '~pen/170.141', 'hi'],
      makeRunDeps()
    );

    expect('botProfile' in posts[0]).toBe(false);
    expect('botProfile' in replies[0]).toBe(false);
  });
});
