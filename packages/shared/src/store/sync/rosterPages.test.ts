import * as api from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as dbIndex from '../../db';
import * as queries from '../../db/queries';
import type * as db from '../../db/types';
import { setupDatabaseTestSuite } from '../../test/helpers';
import { updateInitializedClient, updateSession } from '../session';
import { SyncPriority } from '../syncQueue';
import { compareShips, syncGroupMembersPage } from './rosterPages';
import { syncGroup } from './syncGroup';

setupDatabaseTestSuite();

const groupId = '~zod/big';

function member(
  contactId: string,
  {
    status = 'joined',
    roleIds = [],
  }: { status?: 'joined' | 'invited'; roleIds?: string[] } = {}
): db.ChatMember {
  return {
    membershipType: 'group',
    contactId,
    chatId: groupId,
    status,
    joinedAt: 1700000000000,
    roles: roleIds.map((roleId) => ({ groupId, contactId, roleId })),
  } as db.ChatMember;
}

function group(overrides: Partial<db.Group> = {}): db.Group {
  return {
    id: groupId,
    currentUserIsMember: true,
    currentUserIsHost: false,
    hostUserId: '~zod',
    roles: [{ id: 'admin', groupId, title: 'Admin' }],
    ...overrides,
  } as db.Group;
}

// the api's ChatMember is the db one with a required chatId
function pageOf(page: {
  total: number;
  members: db.ChatMember[];
  next: string | null;
}): api.GroupMembersPage {
  return page as api.GroupMembersPage;
}

async function storedMemberIds() {
  return (await queries.getGroupMemberIds({ groupId })).sort(compareShips);
}

beforeEach(() => {
  api.setDeskServesRosterPages(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  api.setDeskServesRosterPages(null);
});

describe('syncGroup on a big group', () => {
  test('syncs light, without pruning or claiming a whole roster', async () => {
    await queries.insertGroups({
      groups: [
        group({
          memberCount: 600,
          members: [member('~zod'), member('~nec'), member('~bud')],
        }),
      ],
    });
    const getGroupLight = vi
      .spyOn(api, 'getGroupLight')
      .mockResolvedValue(
        group({ memberCount: 601, members: [member('~zod')] })
      );
    const getGroup = vi.spyOn(api, 'getGroup');

    await syncGroup(groupId);

    expect(getGroupLight).toHaveBeenCalledWith(groupId);
    expect(getGroup).not.toHaveBeenCalled();
    const stored = await queries.getGroup({ id: groupId });
    expect(stored?.memberCount).toBe(601);
    // the light roster is partial: nothing it lacks was removed
    expect(await storedMemberIds()).toEqual(['~zod', '~nec', '~bud']);
    expect(stored?.syncedAt ?? null).toBeNull();
  });

  // role management and bot settings judge membership from the stored roster
  test('syncs whole for a caller that needs every seat', async () => {
    await queries.insertGroups({ groups: [group({ memberCount: 600 })] });
    const getGroupLight = vi.spyOn(api, 'getGroupLight');
    const getGroup = vi
      .spyOn(api, 'getGroup')
      .mockResolvedValue(
        group({ memberCount: 600, members: [member('~zod')] })
      );

    await syncGroup(groupId, undefined, { wholeRoster: true });

    expect(getGroup).toHaveBeenCalledWith(groupId);
    expect(getGroupLight).not.toHaveBeenCalled();
  });

  test('a light sync in flight does not stand in for a whole one', async () => {
    await queries.insertGroups({ groups: [group({ memberCount: 600 })] });
    let finishLight = () => {};
    vi.spyOn(api, 'getGroupLight').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLight = () => resolve(group({ memberCount: 600 }));
        })
    );
    const getGroup = vi
      .spyOn(api, 'getGroup')
      .mockResolvedValue(
        group({ memberCount: 600, members: [member('~zod')] })
      );

    const light = syncGroup(groupId);
    await vi.waitFor(() => expect(api.getGroupLight).toHaveBeenCalled());
    await syncGroup(groupId, undefined, { wholeRoster: true });
    finishLight();
    await light;

    expect(getGroup).toHaveBeenCalledWith(groupId);
    expect((await queries.getGroup({ id: groupId }))?.syncedAt).toBeTruthy();
  });

  test('a light sync leaves seats and counts that moved while it was in flight', async () => {
    await queries.insertGroups({
      groups: [
        group({
          memberCount: 600,
          members: [member('~zod'), member('~nec'), member('~bud')],
        }),
      ],
    });
    vi.spyOn(api, 'getGroupLight').mockImplementation(async () => {
      await queries.removeChatMembers({
        chatId: groupId,
        contactIds: ['~nec'],
      });
      await queries.adjustGroupMemberCount({ groupId, delta: -1 });
      return group({
        memberCount: 600,
        members: [member('~zod'), member('~nec')],
      });
    });

    await syncGroup(groupId);

    expect(await storedMemberIds()).toEqual(['~zod', '~bud']);
    expect((await queries.getGroup({ id: groupId }))?.memberCount).toBe(599);
  });

  // insertMembers logs a failed batch instead of throwing
  test('a light sync whose members did not land runs again', async () => {
    // a session that started after earlier tests' light syncs of this group
    updateSession({ startTime: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await queries.insertGroups({ groups: [group({ memberCount: 600 })] });
    const getGroupLight = vi
      .spyOn(api, 'getGroupLight')
      .mockResolvedValue(
        group({ memberCount: 600, members: [member('~zod'), member('~nec')] })
      );
    const insertGroups = vi
      .spyOn(dbIndex, 'insertGroups')
      .mockResolvedValue(undefined);

    try {
      await syncGroup(groupId);
      insertGroups.mockRestore();
      await syncGroup(groupId);
    } finally {
      updateSession(null);
    }

    expect(getGroupLight).toHaveBeenCalledTimes(2);
    expect(await storedMemberIds()).toEqual(['~zod', '~nec']);
  });

  test('syncs whole when the desk serves no pages', async () => {
    api.setDeskServesRosterPages(false);
    await queries.insertGroups({ groups: [group({ memberCount: 600 })] });
    const getGroupLight = vi.spyOn(api, 'getGroupLight');
    const getGroup = vi
      .spyOn(api, 'getGroup')
      .mockResolvedValue(
        group({ memberCount: 600, members: [member('~zod')] })
      );

    await syncGroup(groupId);

    expect(getGroup).toHaveBeenCalledWith(groupId);
    expect(getGroupLight).not.toHaveBeenCalled();
  });

  test('syncs a group under the threshold whole', async () => {
    await queries.insertGroups({ groups: [group({ memberCount: 40 })] });
    const getGroup = vi
      .spyOn(api, 'getGroup')
      .mockResolvedValue(group({ memberCount: 40, members: [member('~zod')] }));

    await syncGroup(groupId);

    expect(getGroup).toHaveBeenCalledWith(groupId);
  });
});

describe('syncGroupMembersPage', () => {
  // ~zod ~nec ~bud ~wes ~sev are 0 1 2 3 4 by @p value
  beforeEach(async () => {
    await queries.insertGroups({
      groups: [
        group({
          memberCount: 600,
          members: [
            member('~zod', { roleIds: ['admin'] }),
            member('~nec'),
            member('~bud'),
            member('~sev'),
            member('~per', { status: 'invited' }),
          ],
        }),
      ],
    });
  });

  test('drops seats the page should have held, and no others', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({
        total: 598,
        members: [
          member('~zod', { roleIds: ['admin'] }),
          member('~nec'),
          member('~wes'),
        ],
        next: '~wes',
      })
    );

    await syncGroupMembersPage({ groupId });

    // ~bud fell inside ~zod..~wes but wasn't on the page; ~sev lies past it,
    // and an invite holds no seat to page
    expect(await storedMemberIds()).toEqual([
      '~zod',
      '~nec',
      '~wes',
      '~sev',
      '~per',
    ]);
    const stored = await queries.getGroup({ id: groupId });
    expect(stored?.memberCount).toBe(598);
  });

  test('a last page reaches the end of the roster', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({
        total: 600,
        members: [member('~wes')],
        next: null,
      })
    );

    await syncGroupMembersPage({ groupId, after: '~nec' });

    expect(await storedMemberIds()).toEqual(['~zod', '~nec', '~wes', '~per']);
  });

  test('a role page replaces its members roles and removes no seats', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({
        total: 1,
        members: [member('~nec', { roleIds: ['admin'] })],
        next: null,
      })
    );

    await syncGroupMembersPage({ groupId, roleId: 'admin' });

    expect(await storedMemberIds()).toEqual([
      '~zod',
      '~nec',
      '~bud',
      '~sev',
      '~per',
    ]);
    const stored = await queries.getGroup({ id: groupId });
    const nec = stored?.members?.find((m) => m.contactId === '~nec');
    expect(nec?.roles?.map((role) => role.roleId)).toEqual(['admin']);
    expect(stored?.memberCount).toBe(600);
  });

  test('a role page takes the role from holders in its range it lacks', async () => {
    await queries.addChatMembersToRoles({
      groupId,
      contactIds: ['~nec', '~sev'],
      roleIds: ['admin'],
    });
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({
        total: 3,
        members: [
          member('~zod', { roleIds: ['admin'] }),
          member('~bud', { roleIds: ['admin'] }),
        ],
        next: '~bud',
      })
    );

    await syncGroupMembersPage({ groupId, roleId: 'admin' });

    // ~nec is inside the page and missing from it; ~sev is past it
    const holders = await queries.getGroupMemberRoles({ groupId });
    expect(holders.map((row) => row.contactId).sort(compareShips)).toEqual([
      '~zod',
      '~bud',
      '~sev',
    ]);
    expect(await storedMemberIds()).toEqual([
      '~zod',
      '~nec',
      '~bud',
      '~sev',
      '~per',
    ]);
  });
});

describe('syncGroupMembersPage while the roster changes', () => {
  // ~zod ~nec ~bud ~wes ~sev ~per ~sut ~let ~ful are 0 through 8 by @p value
  beforeEach(async () => {
    await queries.insertGroups({
      groups: [
        group({
          memberCount: 600,
          members: [member('~zod'), member('~nec'), member('~bud')],
        }),
      ],
    });
  });

  // the page snapshots the roster before a live event lands, then arrives
  test('keeps a seat added while the page was in flight', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.addChatMembers({
        chatId: groupId,
        contactIds: ['~let'],
        type: 'group',
        joinStatus: 'joined',
      });
      return pageOf({
        total: 600,
        members: [member('~zod'), member('~nec')],
        next: '~ful',
      });
    });

    await syncGroupMembersPage({ groupId });

    // ~bud was stored before the fetch and missing from it, so it left
    expect(await storedMemberIds()).toEqual(['~zod', '~nec', '~let']);
  });

  test('does not bring back a seat removed while the page was in flight', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.removeChatMembers({
        chatId: groupId,
        contactIds: ['~nec'],
      });
      return pageOf({
        total: 600,
        members: [member('~zod'), member('~nec'), member('~bud')],
        next: '~ful',
      });
    });

    await syncGroupMembersPage({ groupId });

    expect(await storedMemberIds()).toEqual(['~zod', '~bud']);
  });

  test('leaves a count a live event moved while the page was in flight', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.adjustGroupMemberCount({ groupId, delta: 1 });
      return pageOf({
        total: 598,
        members: [member('~zod'), member('~nec'), member('~bud')],
        next: '~ful',
      });
    });

    await syncGroupMembersPage({ groupId });

    expect((await queries.getGroup({ id: groupId }))?.memberCount).toBe(601);
  });

  test('keeps roles a live event changed while the page was in flight', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.addChatMembersToRoles({
        groupId,
        contactIds: ['~nec'],
        roleIds: ['admin'],
      });
      return pageOf({
        total: 600,
        members: [
          member('~zod'),
          member('~nec'),
          member('~bud', { roleIds: ['admin'] }),
        ],
        next: '~ful',
      });
    });

    await syncGroupMembersPage({ groupId });

    const roles = await queries.getGroupMemberRoles({ groupId });
    expect(roles.map((row) => row.contactId).sort(compareShips)).toEqual([
      '~nec',
      '~bud',
    ]);
  });

  test('keeps a role a live event granted while a role page was in flight', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.addChatMembersToRoles({
        groupId,
        contactIds: ['~bud'],
        roleIds: ['admin'],
      });
      return pageOf({
        total: 1,
        members: [member('~nec', { roleIds: ['admin'] })],
        next: null,
      });
    });

    await syncGroupMembersPage({ groupId, roleId: 'admin' });

    const holders = await queries.getGroupMemberRoles({ groupId });
    expect(holders.map((row) => row.contactId).sort(compareShips)).toEqual([
      '~nec',
      '~bud',
    ]);
  });

  test('applies role changes made mid-fetch one role at a time', async () => {
    const roles = ['admin', 'mods', 'ops'].map((id) => ({
      id,
      groupId,
      title: id,
    }));
    await queries.insertGroups({
      groups: [
        group({
          memberCount: 600,
          roles,
          members: [
            member('~zod'),
            member('~nec', { roleIds: ['admin'] }),
            member('~bud'),
          ],
        }),
      ],
    });
    vi.spyOn(api, 'getGroupMembersPage').mockImplementation(async () => {
      await queries.removeChatMembersFromRoles({
        groupId,
        contactIds: ['~nec'],
        roleIds: ['admin'],
      });
      await queries.addChatMembersToRoles({
        groupId,
        contactIds: ['~nec'],
        roleIds: ['mods'],
      });
      // the page predates both, and knows of a grant made while we were away
      return pageOf({
        total: 600,
        members: [
          member('~zod'),
          member('~nec', { roleIds: ['admin', 'ops'] }),
          member('~bud'),
        ],
        next: '~ful',
      });
    });

    await syncGroupMembersPage({ groupId });

    const nec = (await queries.getGroupMemberRoles({ groupId }))
      .filter((row) => row.contactId === '~nec')
      .map((row) => row.roleId)
      .sort();
    expect(nec).toEqual(['mods', 'ops']);
  });

  // the members screen gives up on its pages when it closes
  test('writes nothing for a caller that gave up on the page', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({
        total: 598,
        members: [member('~zod'), member('~wes')],
        next: '~wes',
      })
    );

    await syncGroupMembersPage(
      { groupId },
      { priority: SyncPriority.Medium, abortSignal: controller.signal }
    );

    expect(await storedMemberIds()).toEqual(['~zod', '~nec', '~bud']);
    expect((await queries.getGroup({ id: groupId }))?.memberCount).toBe(600);
  });

  // insertMembers logs a failed batch instead of throwing
  test('fails a page whose members did not land', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({ total: 600, members: [member('~wes')], next: '~wes' })
    );
    vi.spyOn(dbIndex, 'insertGroupMembersPage').mockResolvedValue(undefined);

    await expect(syncGroupMembersPage({ groupId })).rejects.toThrow(
      'roster page stored 0 of 1 members'
    );
  });

  test('stops writing once the account changes mid-page', async () => {
    vi.spyOn(api, 'getGroupMembersPage').mockResolvedValue(
      pageOf({ total: 598, members: [member('~zod')], next: '~nec' })
    );
    const insert = dbIndex.insertGroupMembersPage;
    vi.spyOn(dbIndex, 'insertGroupMembersPage').mockImplementation(
      async (...args) => {
        const result = await insert(...args);
        updateInitializedClient(false);
        return result;
      }
    );

    await syncGroupMembersPage({ groupId });

    // ~nec would have been reconciled away, and the count updated
    expect(await storedMemberIds()).toEqual(['~zod', '~nec', '~bud']);
    expect((await queries.getGroup({ id: groupId }))?.memberCount).toBe(600);
  });
});

test('compareShips orders by @p value, non-ships last', () => {
  expect(
    ['~sampel-palnet', 'nope', '~wes', '~zod', '~nec'].sort(compareShips)
  ).toEqual(['~zod', '~nec', '~wes', '~sampel-palnet', 'nope']);
});

test('getGroupsWithMemberThreshold reads the count, not the stored roster', async () => {
  await queries.insertGroups({
    groups: [group({ memberCount: 11000, members: [member('~zod')] })],
  });
  expect(await queries.getGroupsWithMemberThreshold(14)).toEqual([]);
});
