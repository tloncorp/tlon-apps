import { afterEach, describe, expect, it } from 'bun:test';

import { runScriptCli } from './script-cli-runner';
import { mockedGetInitData, mockedSearchChannel } from './tloncorp-api-mock';

const originalGetInitData = mockedGetInitData.impl;
const originalSearchChannel = mockedSearchChannel.impl;

afterEach(() => {
  mockedGetInitData.impl = originalGetInitData;
  mockedSearchChannel.impl = originalSearchChannel;
});

function runMessages(args: string[]) {
  return runScriptCli(
    'messages',
    args,
    (run) => import(`./messages?run=${run}`)
  );
}

const INIT = {
  channels: [
    { id: '~nec', type: 'dm', isDmInvite: false },
    { id: '~bus', type: 'dm', isDmInvite: true },
    { id: '0v4.club', type: 'groupDm', title: 'Pals', isDmInvite: false },
  ],
  groups: [
    {
      id: '~zod/team',
      title: 'Team',
      channels: [
        { id: 'chat/~zod/general', title: 'General' },
        { id: 'heap/~zod/links', title: 'Links' },
        { id: 'chat/~zod/unjoined', title: 'Unjoined' },
      ],
    },
  ],
  joinedGroupChannels: [
    'chat/~zod/general',
    'heap/~zod/links',
    'notes/~zod/docs',
  ],
};

function post(channelId: string, id: string, sentAt: number) {
  return {
    id,
    channelId,
    authorId: '~zod',
    sentAt,
    content: [{ inline: [`pizza ${id}`] }],
  };
}

function headers(stdout: string[]) {
  return stdout.filter((line) => line.startsWith('==='));
}

describe('messages search without --channel', () => {
  it('searches every readable chat and groups hits by channel, newest first', async () => {
    const searched: string[] = [];
    mockedGetInitData.impl = async () => INIT;
    mockedSearchChannel.impl = async (params: unknown) => {
      const { channelId } = params as { channelId: string };
      searched.push(channelId);
      const posts =
        channelId === '~nec'
          ? [post(channelId, 'dm-1', 1_000)]
          : channelId === 'chat/~zod/general'
            ? [post(channelId, 'gen-1', 2_000), post(channelId, 'gen-2', 500)]
            : [];
      return { posts, cursor: null };
    };

    const { exitCode, stdout, stderr } = await runMessages(['search', 'pizza']);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(searched.sort()).toEqual([
      '0v4.club',
      'chat/~zod/general',
      'heap/~zod/links',
      '~nec',
    ]);
    expect(stdout[0]).toBe('Searching "pizza" in 4 channels and DMs\n');
    expect(stdout).toContain('Found 3 results in 2 channels.\n');
    expect(headers(stdout)).toEqual([
      '=== chat/~zod/general — Team › General (2) ===\n',
      '=== ~nec — DM (1) ===\n',
    ]);
    expect(stdout.filter((line) => line.startsWith('  ID:'))).toEqual([
      '  ID: gen-2',
      '  ID: gen-1',
      '  ID: dm-1',
    ]);
  });

  it('keeps the newest hits per channel and overall, and says what it left out', async () => {
    mockedGetInitData.impl = async () => INIT;
    mockedSearchChannel.impl = async (params: unknown) => {
      const { channelId } = params as { channelId: string };
      const base =
        channelId === 'heap/~zod/links' ? 100 : channelId === '~nec' ? 50 : 0;
      return {
        posts: [1, 2, 3].map((n) =>
          post(channelId, `${channelId}#${n}`, base + n)
        ),
        cursor: null,
      };
    };

    const { exitCode, stdout } = await runMessages([
      'search',
      'pizza',
      '--per-channel',
      '2',
      '--limit',
      '3',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'Found 12 results in 4 channels; showing the newest 3 (at most 2 per channel, 3 in all).\n'
    );
    expect(headers(stdout)).toEqual([
      '=== heap/~zod/links — Team › Links (2 of 3) ===\n',
      '=== ~nec — DM (1 of 3) ===\n',
    ]);
    expect(stdout.filter((line) => line.startsWith('  ID:'))).toEqual([
      '  ID: heap/~zod/links#2',
      '  ID: heap/~zod/links#3',
      '  ID: ~nec#3',
    ]);
    expect(stdout.at(-1)).toBe(
      'For every result in one channel: tlon messages search "pizza" --channel <nest>'
    );
  });

  it('reports channels it could not search and still prints the rest', async () => {
    mockedGetInitData.impl = async () => INIT;
    mockedSearchChannel.impl = async (params: unknown) => {
      const { channelId } = params as { channelId: string };
      if (channelId === 'heap/~zod/links') throw new Error('scry 500');
      return {
        posts: channelId === '~nec' ? [post(channelId, 'dm-1', 1)] : [],
        cursor: null,
      };
    };

    const { exitCode, stdout, stderr } = await runMessages(['search', 'pizza']);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([
      'Could not search 1 of 4 channels:',
      '  heap/~zod/links: scry 500',
    ]);
    expect(headers(stdout)).toEqual(['=== ~nec — DM (1) ===\n']);
  });

  it('still searches only the given channel with --channel', async () => {
    const searched: string[] = [];
    mockedGetInitData.impl = async () => {
      throw new Error('listing should not be read');
    };
    mockedSearchChannel.impl = async (params: unknown) => {
      searched.push((params as { channelId: string }).channelId);
      return { posts: [], cursor: null };
    };

    const { exitCode, stdout } = await runMessages([
      'search',
      'pizza',
      '--channel',
      'chat/~zod/general',
    ]);

    expect(exitCode).toBe(0);
    expect(searched).toEqual(['chat/~zod/general']);
    expect(stdout).toContain('No results found.');
  });
});
