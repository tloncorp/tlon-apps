import { describe, expect, it, mock } from 'bun:test';

// Mock the api package before importing dms so the test never loads
// packages/api/dist (which may be stale or absent in CI); every dms function
// under test takes injected deps, so the real implementations are never used.
mock.module('@tloncorp/api', () => ({
  // dms.ts value imports
  addReaction: async () => undefined,
  deletePost: async () => undefined,
  getCurrentUserId: () => '~zod',
  removeReaction: async () => undefined,
  respondToDMInvite: async () => undefined,
  sendPost: async () => undefined,
  sendReply: async () => undefined,
  // api-client.ts value imports (transitive via ./api-client)
  Urbit: class {
    cookie = '';
    nodeId = '';

    constructor(readonly url: string) {}
  },
  client: { cookie: '' },
  configureClient: async () => undefined,
  internalRemoveClient: () => undefined,
  preSig: (ship: string) => (ship.startsWith('~') ? ship : `~${ship}`),
  scry: async () => undefined,
  subscribe: async () => 0,
}));

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
