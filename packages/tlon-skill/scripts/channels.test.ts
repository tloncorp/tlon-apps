import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as groupAdmin from './group-admin';
import { runScriptCli } from './script-cli-runner';
import {
  MockBadResponseError,
  mockedCreateChannel,
  mockedGetGroup,
  mockedGetGroups,
  mockedManagementCalls,
  mockedNotesV1,
  mockedPoke,
  mockedScry,
} from './tloncorp-api-mock';

const GROUP = '~zod/test-group';

const originalCreateGroupNotebook = mockedNotesV1.createGroupNotebook;
const originalGetGroup = mockedGetGroup.impl;
const originalGetGroups = mockedGetGroups.impl;
const originalCreateChannel = mockedCreateChannel.impl;
const originalPoke = mockedPoke.impl;
const originalScry = mockedScry.impl;

afterEach(() => {
  mockedNotesV1.createGroupNotebook = originalCreateGroupNotebook;
  mockedGetGroup.impl = originalGetGroup;
  mockedGetGroups.impl = originalGetGroups;
  mockedCreateChannel.impl = originalCreateChannel;
  mockedPoke.impl = originalPoke;
  mockedScry.impl = originalScry;
  mockedManagementCalls.length = 0;
});

function runChannels(args: string[]) {
  return runScriptCli(
    'channels',
    args,
    (run) => import(`./channels?run=${run}`)
  );
}

describe('channels create output', () => {
  it('prints the group Ref and share guidance for a chat channel', async () => {
    const created: unknown[] = [];
    mockedCreateChannel.impl = async (input: unknown) => {
      created.push(input);
    };

    const { exitCode, stdout } = await runChannels([
      'create',
      GROUP,
      'General',
    ]);

    expect(exitCode).toBe(0);
    expect(created).toHaveLength(1);
    const nest = (created[0] as { id: string }).id;
    expect(nest).toMatch(/^chat\/~zod\/[a-z0-9]{8}$/);
    expect(stdout).toEqual([
      `Adding channel "General" to group ${GROUP}...`,
      '✅ Channel created!',
      `   Nest: ${nest}`,
      '   Title: General',
      `   Group: ${GROUP}`,
      `   Ref: /1/group/${GROUP}`,
      '   Share: channels have no card yet; name the channel and its Nest, and include the group Ref path in a chat message to post a tappable group card.',
    ]);
  });

  it('prints the group Ref and share guidance for a notes channel', async () => {
    const nest = 'notes/~zod/v1abc';
    mockedNotesV1.createGroupNotebook = async () => ({
      host: '~zod',
      flagName: 'v1abc',
    });
    mockedGetGroup.impl = async () => ({
      channels: [{ id: nest, readerRoles: [] }],
    });

    const { exitCode, stdout } = await runChannels([
      'create',
      GROUP,
      'Docs',
      '--kind',
      'notes',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      `Creating %notes channel "Docs" in ${GROUP}...`,
      '✅ Notes channel created!',
      `   Nest: ${nest}`,
      '   Title: Docs',
      `   Group: ${GROUP}`,
      `   Ref: /1/group/${GROUP}`,
      '   Share: channels have no card yet; name the channel and its Nest, and include the group Ref path in a chat message to post a tappable group card.',
    ]);
  });
});

describe('channels info writers', () => {
  const NEST = 'chat/~zod/general';
  const NOTES_NEST = 'notes/~zod/docs';
  let scries: unknown[] = [];

  function answerPerm(answer: () => Promise<unknown>) {
    mockedScry.impl = async (input: unknown) => {
      scries.push(input);
      return answer();
    };
  }

  beforeEach(() => {
    scries = [];
    mockedGetGroups.impl = async () => [
      {
        id: GROUP,
        title: 'Test',
        channels: [
          { id: NEST, title: 'General', readerRoles: [] },
          { id: NOTES_NEST, title: 'Docs', readerRoles: [] },
        ],
      },
    ];
  });

  it('prints (all members) when the writer set is empty', async () => {
    answerPerm(async () => ({ writers: [], group: GROUP }));

    const { exitCode, stdout } = await runChannels(['info', NEST]);

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      '\n=== General ===\n',
      `Nest: ${NEST}`,
      'Kind: chat',
      `Group: Test (${GROUP})`,
      'Zone: default',
      'Description: (none)',
      'Readers: (all members)',
      'Writers: (all members)',
    ]);
    expect(scries).toEqual([{ app: 'channels', path: `/${NEST}/perm` }]);
  });

  it('lists the writer roles of a restricted channel', async () => {
    answerPerm(async () => ({ writers: ['admin', 'mods'], group: GROUP }));

    const { exitCode, stdout } = await runChannels(['info', NEST]);

    expect(exitCode).toBe(0);
    expect(stdout.at(-1)).toBe('Writers: admin, mods');
  });

  it('reports a failed perm scry in the line instead of failing', async () => {
    answerPerm(async () => {
      throw new MockBadResponseError(500, '');
    });

    const { exitCode, stdout } = await runChannels(['info', NEST]);

    expect(exitCode).toBe(0);
    expect(stdout.at(-2)).toBe('Readers: (all members)');
    expect(stdout.at(-1)).toBe('Writers: (unavailable: HTTP 500)');
  });

  it('leaves %notes writers to %notes without scrying %channels', async () => {
    answerPerm(async () => ({ writers: [], group: GROUP }));

    const { exitCode, stdout } = await runChannels(['info', NOTES_NEST]);

    expect(exitCode).toBe(0);
    expect(stdout.at(-1)).toBe('Writers: (managed by %notes)');
    expect(scries).toEqual([]);
  });
});

describe('channels admin commands', () => {
  const FOREIGN_GROUP = '~bus/team';
  const FOREIGN_NEST = 'chat/~bus/general';
  // Other ways a command could reach the ship, beside mockedManagementCalls.
  let sent: string[] = [];
  // Stubbed so the helper's real retry loop (5 reads, 500 ms apart) never runs.
  let helper: ReturnType<typeof refuseAdmin>;

  function refuseAdmin() {
    return spyOn(
      groupAdmin,
      'assertActingShipCanAdminister'
    ).mockImplementation(async (groupId: string, action: string) => {
      throw new Error(`Can't ${action} in ${groupId}: not an admin`);
    });
  }

  beforeEach(() => {
    sent = [];
    helper = refuseAdmin();
    mockedGetGroups.impl = async () => [
      { id: FOREIGN_GROUP, channels: [{ id: FOREIGN_NEST }] },
    ];
    mockedPoke.impl = async () => {
      sent.push('poke');
    };
    mockedCreateChannel.impl = async () => {
      sent.push('createChannel');
    };
    mockedNotesV1.createGroupNotebook = async () => {
      sent.push('createGroupNotebook');
    };
  });

  afterEach(() => {
    helper.mockRestore();
  });

  const refusals: Array<[string[], string]> = [
    [['create', FOREIGN_GROUP, 'General'], 'add channels'],
    [['create', FOREIGN_GROUP, 'Docs', '--kind', 'notes'], 'add channels'],
    [['update', FOREIGN_NEST, '--title', 'News'], 'update channels'],
    [['rename', FOREIGN_NEST, 'News'], 'update channels'],
    [['delete', FOREIGN_NEST], 'delete channels'],
    [['add-writers', FOREIGN_NEST, 'admin'], 'change writers'],
    [['del-writers', FOREIGN_NEST, 'admin'], 'change writers'],
    [['add-readers', FOREIGN_GROUP, FOREIGN_NEST, 'admin'], 'change readers'],
    [['del-readers', FOREIGN_GROUP, FOREIGN_NEST, 'admin'], 'change readers'],
  ];

  for (const [args, action] of refusals) {
    it(`refuses ${args.join(' ')} for a non-admin before sending anything`, async () => {
      const { exitCode, stderr } = await runChannels(args);

      expect(exitCode).toBe(1);
      expect(stderr).toEqual([
        `Error: Can't ${action} in ${FOREIGN_GROUP}: not an admin`,
      ]);
      expect(helper.mock.calls).toEqual([[FOREIGN_GROUP, action]]);
      expect(sent).toEqual([]);
      expect(mockedManagementCalls).toEqual([]);
    });
  }

  it('lets the channel host change writers without the group admin check', async () => {
    const nest = 'chat/~zod/general';

    const { exitCode } = await runChannels(['add-writers', nest, 'admin']);

    expect(exitCode).toBe(0);
    expect(helper.mock.calls).toEqual([]);
    expect(mockedManagementCalls).toEqual([
      {
        op: 'addChannelWriters',
        args: [{ channelId: nest, writers: ['admin'] }],
      },
    ]);
  });
});
