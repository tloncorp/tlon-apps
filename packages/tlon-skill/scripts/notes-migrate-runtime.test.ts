import { tryParse, valid } from '@urbit/aura';
import { describe, expect, it } from 'bun:test';

import { mapChannelReaders } from './notes-channel-runtime';
import {
  assertServerIdentity,
  createMigrationDeps,
  generateRequestId,
  parseGroupV7,
} from './notes-migrate-runtime';
import { mockedGetChannelPosts, mockedScry } from './tloncorp-api-mock';

function rawGroup(overrides: Record<string, unknown> = {}) {
  return {
    admins: ['admins'],
    admissions: { privacy: 'private' },
    channels: {
      'diary/~zod/blog': {
        added: 123,
        meta: {
          title: 'Blog',
          description: 'Description',
          image: '',
          cover: '',
        },
        section: 'main',
        readers: ['members'],
        join: false,
      },
    },
    ...overrides,
  };
}

describe('generateRequestId', () => {
  it('emits a canonical valid non-zero @uv', () => {
    const id = generateRequestId(() =>
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    );
    expect(valid('uv', id)).toBe(true);
    expect(tryParse('uv', id)).not.toBe(0n);
    expect(id).not.toBe('0v0');
  });

  it('draws again when the entropy source returns all zeroes', () => {
    let draws = 0;
    const id = generateRequestId(() => {
      draws += 1;
      const bytes = new Uint8Array(16);
      if (draws === 2) bytes[15] = 1;
      return bytes;
    });
    expect(draws).toBe(2);
    expect(id).toBe('0v1');
    expect(tryParse('uv', id)).toBe(1n);
  });

  it('asserts the entropy source byte count', () => {
    expect(() => generateRequestId(() => new Uint8Array(15))).toThrow(
      'wrong byte count'
    );
  });
});

describe('parseGroupV7', () => {
  it('parses only migration-required group fields and exact reader arrays', () => {
    expect(parseGroupV7(rawGroup(), '~zod/group')).toEqual({
      privacy: 'private',
      admins: ['admins'],
      channels: {
        'diary/~zod/blog': {
          added: 123,
          meta: {
            title: 'Blog',
            description: 'Description',
            image: '',
            cover: '',
          },
          section: 'main',
          readers: ['members'],
          join: false,
        },
      },
    });
  });

  const malformedCases: Array<[string, Record<string, unknown>]> = [
    ['admins', { admins: undefined }],
    ['admissions', { admissions: undefined }],
    ['privacy', { admissions: { privacy: 'open' } }],
    ['channels', { channels: undefined }],
    [
      'readers',
      {
        channels: {
          'diary/~zod/blog': {
            added: 1,
            meta: {
              title: 'Blog',
              description: '',
              image: '',
              cover: '',
            },
            section: 'main',
            join: false,
          },
        },
      },
    ],
  ];
  for (const [field, override] of malformedCases) {
    it(`fails closed on malformed ${field}`, () => {
      expect(() => parseGroupV7(rawGroup(override), '~zod/group')).toThrow();
    });
  }

  it('does not reinterpret a v6 fleet/bloc/cabals/cordon group', () => {
    expect(() =>
      parseGroupV7(
        {
          fleet: {},
          bloc: {},
          cabals: {},
          cordon: { open: null },
          channels: {},
        },
        '~zod/group'
      )
    ).toThrow(/admins/);
  });
});

describe('assertServerIdentity', () => {
  it('makes one authenticated GET and accepts an exact ship match', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    await assertServerIdentity({
      configuredShip: 'zod',
      url: 'http://ship.test',
      cookie: 'urbauth=token',
      fetchFn: async (url, init) => {
        calls.push([String(url), init]);
        return new Response('~zod', { status: 200 });
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('http://ship.test/~/name');
    expect(calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: { Cookie: 'urbauth=token' },
    });
  });

  it('fails closed on a configured/authenticated mismatch', async () => {
    await expect(
      assertServerIdentity({
        configuredShip: '~zod',
        url: 'http://ship.test',
        fetchFn: async () => new Response('~nec', { status: 200 }),
      })
    ).rejects.toThrow('configured ~zod, authenticated as ~nec');
  });

  it('fails closed on empty identity or an HTTP error without retrying', async () => {
    let calls = 0;
    await expect(
      assertServerIdentity({
        configuredShip: '~zod',
        url: 'http://ship.test',
        fetchFn: async () => {
          calls += 1;
          return new Response('', { status: 401 });
        },
      })
    ).rejects.toThrow('HTTP 401');
    expect(calls).toBe(1);

    await expect(
      assertServerIdentity({
        configuredShip: '~zod',
        url: 'http://ship.test',
        fetchFn: async () => new Response('', { status: 200 }),
      })
    ).rejects.toThrow('empty response');
  });
});

describe('runtime adapters fail closed', () => {
  it('uses the exact routed channel-perm scry path', async () => {
    const original = mockedScry.impl;
    const calls: unknown[] = [];
    mockedScry.impl = async (input: unknown) => {
      calls.push(input);
      return { writers: ['writers'], group: '~zod/group' };
    };
    try {
      const deps = createMigrationDeps();
      await expect(deps.getChannelPerm('diary/~zod/blog')).resolves.toEqual({
        writers: ['writers'],
        group: '~zod/group',
      });
      expect(calls).toEqual([
        {
          app: 'channels',
          path: '/diary/~zod/blog/perm',
        },
      ]);
    } finally {
      mockedScry.impl = original;
    }
  });

  it('passes newest/older options through with skipGapFill enabled', async () => {
    const original = mockedGetChannelPosts.impl;
    const calls: unknown[] = [];
    mockedGetChannelPosts.impl = async (input: unknown) => {
      calls.push(input);
      return { posts: [], older: null, totalPosts: 0 };
    };
    try {
      const deps = createMigrationDeps();
      await deps.getChannelPosts('diary/~zod/blog', undefined, 'newest', 100);
      expect(calls[0]).toMatchObject({
        channelId: 'diary/~zod/blog',
        mode: 'newest',
        count: 100,
        includeReplies: false,
        skipGapFill: true,
      });
    } finally {
      mockedGetChannelPosts.impl = original;
    }
  });

  it('refuses a posts response that omits totalPosts', async () => {
    const original = mockedGetChannelPosts.impl;
    mockedGetChannelPosts.impl = async () => ({
      posts: [],
      older: null,
      totalPosts: undefined as unknown as number,
    });
    try {
      const deps = createMigrationDeps();
      await expect(
        deps.getChannelPosts('diary/~zod/blog', undefined, 'newest', 100)
      ).rejects.toThrow('omitted totalPosts');
    } finally {
      mockedGetChannelPosts.impl = original;
    }
  });

  it('maps exact reader roles and never defaults a malformed field to open', () => {
    expect(
      mapChannelReaders(
        { readerRoles: [{ roleId: 'members' }] },
        'notes/~zod/book',
        '~zod/group'
      )
    ).toEqual(['members']);
    expect(
      mapChannelReaders(undefined, 'notes/~zod/book', '~zod/group')
    ).toBeNull();
    expect(() =>
      mapChannelReaders({ readerRoles: null }, 'notes/~zod/book', '~zod/group')
    ).toThrow('refusing to assume open');
  });
});

describe('recoveryInstruction', () => {
  it('gives CLI commands, not the bot slash command', () => {
    const instruction =
      createMigrationDeps().recoveryInstruction('notes/~zod/newbook');
    expect(instruction).toContain(
      'tlon notes notebook-delete notes/~zod/newbook --yes'
    );
    expect(instruction).toContain('tlon notes migrate-apply');
    expect(instruction).not.toContain('/migrate');
    expect(instruction).not.toContain('Notes app');
  });
});
