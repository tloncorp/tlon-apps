import * as api from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import * as queries from '../../db/queries';
import type * as db from '../../db/types';
import { setupDatabaseTestSuite } from '../../test/helpers';
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

  test('a role page replaces its members roles and removes nobody', async () => {
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
