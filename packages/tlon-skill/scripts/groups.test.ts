import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as groupAdmin from './group-admin';
import { runScriptCli } from './script-cli-runner';
import {
  mockedCreateChannel,
  mockedGetGroup,
  mockedManagementCalls,
  mockedNotesV1,
  mockedScry,
} from './tloncorp-api-mock';

// The mocked acting ship is ~zod, so it hosts HOSTED and not FOREIGN.
const HOSTED = '~zod/team';
const FOREIGN = '~bus/team';

const originalScry = mockedScry.impl;
const originalGetGroup = mockedGetGroup.impl;
const originalCreateChannel = mockedCreateChannel.impl;
const originalCreateGroupNotebook = mockedNotesV1.createGroupNotebook;

afterEach(() => {
  mockedScry.impl = originalScry;
  mockedGetGroup.impl = originalGetGroup;
  mockedCreateChannel.impl = originalCreateChannel;
  mockedNotesV1.createGroupNotebook = originalCreateGroupNotebook;
  mockedManagementCalls.length = 0;
});

function runGroups(args: string[]) {
  return runScriptCli('groups', args, (run) => import(`./groups?run=${run}`));
}

function scryReturning(rawGroup: unknown) {
  mockedScry.impl = async () => structuredClone(rawGroup);
}

describe('groups update', () => {
  const meta = {
    title: 'Team',
    description: 'Our team',
    image: '#ff0000',
    cover: '',
  };

  it('refuses a non-admin with the admin helper message and sends nothing', async () => {
    scryReturning({
      meta,
      admins: ['admin'],
      seats: { '~zod': { roles: [] } },
    });

    const { exitCode, stderr } = await runGroups([
      'update',
      FOREIGN,
      '--image',
      'https://example.com/team.png',
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([
      `Error: Can't update in ${FOREIGN}: you (~zod) are not an admin of this group. It's hosted by ~bus. Ask the host to grant admin.`,
    ]);
    expect(mockedManagementCalls).toEqual([]);
  });

  it('succeeds without a poke when nothing would change', async () => {
    scryReturning({ meta });

    const { exitCode, stdout } = await runGroups([
      'update',
      HOSTED,
      '--title',
      'Team',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      `Nothing to update: ${HOSTED} already has that title, description, image and cover.`,
    ]);
    expect(mockedManagementCalls).toEqual([]);
  });

  it('pokes once, keeping the fields it was not given', async () => {
    scryReturning({ meta });

    const { exitCode } = await runGroups(['update', HOSTED, '--title', 'New']);

    expect(exitCode).toBe(0);
    // The color image survives: getGroup would report it as iconImageColor.
    expect(mockedManagementCalls).toEqual([
      {
        op: 'updateGroupMeta',
        args: [{ groupId: HOSTED, meta: { ...meta, title: 'New' } }],
      },
    ]);
  });
});

describe('groups create', () => {
  // A separate meta poke after creation is a tracked poke that can time out
  // before create-owned grants its admin, leaving the group without one.
  it('creates the group with its description and sends no meta update', async () => {
    const { exitCode } = await runGroups([
      'create',
      'Team',
      '--description',
      'Our team',
    ]);

    expect(exitCode).toBe(0);
    expect(mockedManagementCalls.map(({ op }) => op)).toEqual(['createGroup']);
    const [{ group }] = mockedManagementCalls[0].args as [
      { group: { description?: string } },
    ];
    expect(group.description).toBe('Our team');
  });
});

describe('groups create-owned', () => {
  // A workspace made for the owner with a description used to come out with
  // the bot as a plain member: the description poke timed out first.
  it('makes the admin ship an admin of a group with a description', async () => {
    // The create thread seats the invited admin and makes an admin role.
    mockedGetGroup.impl = async () => ({ roles: [{ id: 'admin' }] });
    mockedScry.impl = async () => ({
      admins: ['admin'],
      seats: {
        '~nec': {
          roles: mockedManagementCalls.some(
            ({ op }) => op === 'addMembersToRole'
          )
            ? ['admin']
            : [],
        },
      },
    });

    const { exitCode, stdout } = await runGroups([
      'create-owned',
      'Team',
      '--admin',
      '~nec',
      '--description',
      'Our team',
    ]);

    expect(exitCode).toBe(0);
    expect(mockedManagementCalls.map(({ op }) => op)).toEqual([
      'createGroup',
      'addMembersToRole',
    ]);
    const [created, assigned] = mockedManagementCalls;
    const [{ group, memberIds }] = created.args as [
      { group: { id: string; description?: string }; memberIds: string[] },
    ];
    expect(group.description).toBe('Our team');
    expect(memberIds).toEqual(['~nec']);
    expect(assigned.args).toEqual([
      { groupId: group.id, roleId: 'admin', ships: ['~nec'] },
    ]);
    expect(stdout).toContain('✅ Admin assignment verified.');
  });
});

describe('groups admin commands', () => {
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
    scryReturning({ admissions: { privacy: 'private' } });
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
    [['add-role', FOREIGN, 'editors', '--title', 'Editors'], 'add roles'],
    [['delete-role', FOREIGN, 'editors'], 'delete roles'],
    [['update-role', FOREIGN, 'editors', '--title', 'Writers'], 'update roles'],
    [['set-privacy', FOREIGN, 'public'], 'change privacy'],
    [['accept-join', FOREIGN, '~nec'], 'accept join requests'],
    [['reject-join', FOREIGN, '~nec'], 'reject join requests'],
    [['revoke-invite', FOREIGN, '~nec'], 'revoke invites'],
    [['invite', FOREIGN, '~nec'], 'invite to a private or secret group'],
    [['add-channel', FOREIGN, 'General'], 'add channels'],
    [['add-channel', FOREIGN, 'Docs', '--kind', 'notes'], 'add channels'],
  ];

  for (const [args, action] of refusals) {
    it(`refuses ${args.join(' ')} for a non-admin before sending anything`, async () => {
      const { exitCode, stderr } = await runGroups(args);

      expect(exitCode).toBe(1);
      expect(stderr).toEqual([
        `Error: Can't ${action} in ${FOREIGN}: not an admin`,
      ]);
      expect(helper.mock.calls).toEqual([[FOREIGN, action]]);
      expect(sent).toEqual([]);
      expect(mockedManagementCalls).toEqual([]);
    });
  }

  it('lets a member invite to a public group without the admin check', async () => {
    scryReturning({ admissions: { privacy: 'public' } });

    const { exitCode } = await runGroups(['invite', FOREIGN, '~nec']);

    expect(exitCode).toBe(0);
    expect(helper.mock.calls).toEqual([]);
    expect(mockedManagementCalls).toEqual([
      {
        op: 'inviteGroupMembers',
        args: [{ groupId: FOREIGN, contactIds: ['~nec'] }],
      },
    ]);
  });

  it('refuses to delete a group the acting ship does not host, admin or not', async () => {
    const { exitCode, stderr } = await runGroups(['delete', FOREIGN]);

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([
      `Error: Can't delete ${FOREIGN}: only its host (~bus) can delete it, and you are ~zod.`,
    ]);
    expect(mockedManagementCalls).toEqual([]);
  });

  it('lets the host delete its group', async () => {
    const { exitCode } = await runGroups(['delete', HOSTED]);

    expect(exitCode).toBe(0);
    expect(mockedManagementCalls).toEqual([
      { op: 'deleteGroup', args: [HOSTED] },
    ]);
  });
});
