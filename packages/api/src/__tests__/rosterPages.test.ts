import { type Mock, beforeEach, describe, expect, test, vi } from 'vitest';

import { getGroupLight, getGroupMembersPage } from '../client/groupsApi';
import {
  DeskUnsupportedError,
  onDeskServesRosterPagesChange,
  scry,
  setDeskServesRosterPages,
} from '../client/urbit';
import type * as ub from '../urbit';

vi.mock('../client/urbit', async () => ({
  ...(await vi.importActual('../client/urbit')),
  getCurrentUserId: () => '~zod',
  scry: vi.fn(),
}));

const groupId = '~zod/big';
const paths = () => (scry as Mock).mock.calls.map(([params]) => params.path);

// Shaped like groups-json.hoon `++seats-page:v11:enjs`.
const page = {
  total: 21,
  seats: [
    { ship: '~zod', roles: ['admin'], joined: 1700000000000 },
    { ship: '~nec', roles: [], joined: 1700000001000 },
  ],
  next: '~nec',
} satisfies ub.GroupSeatsPage;

beforeEach(() => {
  vi.clearAllMocks();
  setDeskServesRosterPages(true);
});

describe('getGroupMembersPage', () => {
  test('reads each page shape from its own path', async () => {
    (scry as Mock).mockResolvedValue(page);
    await getGroupMembersPage({ groupId, limit: 50 });
    await getGroupMembersPage({ groupId, limit: 50, after: '~nec' });
    await getGroupMembersPage({ groupId, limit: 10, roleId: 'admin' });
    await getGroupMembersPage({
      groupId,
      limit: 10,
      roleId: 'admin',
      after: '~zod',
    });
    expect(paths()).toEqual([
      '/v3/groups/~zod/big/seats/page/50',
      '/v3/groups/~zod/big/seats/page/50/~nec',
      '/v3/groups/~zod/big/seats/role/admin/page/10',
      '/v3/groups/~zod/big/seats/role/admin/page/10/~zod',
    ]);
  });

  test('turns seats into joined members, keeping the page order', async () => {
    (scry as Mock).mockResolvedValue(page);
    const result = await getGroupMembersPage({ groupId, limit: 50 });
    expect(result.total).toBe(21);
    expect(result.next).toBe('~nec');
    expect(result.members).toEqual([
      {
        membershipType: 'group',
        contactId: '~zod',
        chatId: groupId,
        roles: [{ groupId, contactId: '~zod', roleId: 'admin' }],
        status: 'joined',
        joinedAt: 1700000000000,
      },
      {
        membershipType: 'group',
        contactId: '~nec',
        chatId: groupId,
        roles: [],
        status: 'joined',
        joinedAt: 1700000001000,
      },
    ]);
  });

  // an older desk 404s these paths; the guard stops the request first
  test('is refused unsent on a desk without pages', async () => {
    setDeskServesRosterPages(false);
    await expect(getGroupMembersPage({ groupId, limit: 50 })).rejects.toThrow(
      DeskUnsupportedError
    );
    await expect(getGroupLight(groupId)).rejects.toThrow(DeskUnsupportedError);
    expect(paths()).toEqual([]);
  });
});

describe('getGroupLight', () => {
  test('reads the light group and keeps its whole count', async () => {
    (scry as Mock).mockResolvedValue({
      meta: { title: 'Big', description: '', image: '', cover: '' },
      admissions: {
        privacy: 'public',
        banned: { ships: [], ranks: [] },
        pending: {},
        requests: {},
        tokens: {},
        referrals: {},
        invited: {},
      },
      seats: { '~zod': { roles: ['admin'], joined: 1700000000000 } },
      roles: {},
      admins: ['admin'],
      channels: {},
      'active-channels': [],
      sections: {},
      'section-order': [],
      'flagged-content': {},
      'member-count': 11000,
      init: true,
    } satisfies ub.GroupV11);
    const group = await getGroupLight(groupId);
    expect(paths()).toEqual(['/v3/ui/groups/~zod/big/light']);
    expect(group.memberCount).toBe(11000);
    expect(group.members).toHaveLength(1);
  });
});

test('tells listeners when roster page support changes, and only then', () => {
  const listener = vi.fn();
  const unsubscribe = onDeskServesRosterPagesChange(listener);

  setDeskServesRosterPages(true);
  setDeskServesRosterPages(false);
  setDeskServesRosterPages(false);
  unsubscribe();
  setDeskServesRosterPages(true);

  expect(listener).toHaveBeenCalledTimes(1);
});
