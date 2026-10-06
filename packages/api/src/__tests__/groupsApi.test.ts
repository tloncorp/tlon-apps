import { describe, expect, test, vi } from 'vitest';

import { parseChanges } from '../client/changesApi';
import {
  getChannelPreview,
  toClientGroup,
  toClientGroupFromForeign,
  toClientGroupFromPreview,
  toGroupsUpdate,
} from '../client/groupsApi';
import { subscribeOnce } from '../client/urbit';
import type * as ub from '../urbit';

vi.mock('../client/urbit', async () => ({
  ...(await vi.importActual('../client/urbit')),
  getCurrentUserId: () => '~zod',
  subscribeOnce: vi.fn(),
}));

const flag = '~solfer-magfed/test-group';
const ships = ['~zod', '~bus'];

// Typed on purpose: these are the shapes groups-json.hoon `++r-seat` actually
// emits, so narrowing GroupResponseSeat back to a bare `string[]` breaks the
// typecheck here rather than passing silently.
const addRoles = {
  flag,
  'r-group': {
    seat: { ships, 'r-seat': { 'add-roles': { roles: ['admin', 'mod'] } } },
  },
} satisfies ub.GroupResponse;

const delRoles = {
  flag,
  'r-group': {
    seat: { ships, 'r-seat': { 'del-roles': { roles: ['admin'] } } },
  },
} satisfies ub.GroupResponse;

const seatDel = {
  flag,
  'r-group': { seat: { ships, 'r-seat': { del: null } } },
} satisfies ub.GroupResponse;

// The wire `$meta` names images `image`/`cover`; the client names them
// `iconImage*`/`coverImage*`. Handing the wire shape straight through leaves
// the client fields unset and leaks unknown keys into the db layer.
const roleAdd = {
  flag,
  'r-group': {
    role: {
      roles: ['mod'],
      'r-role': {
        add: {
          title: 'Mod',
          description: 'Keeps the peace',
          image: 'https://example.com/icon.png',
          cover: '#ff0000',
        },
      },
    },
  },
} satisfies ub.GroupResponse;

const roleEdit = {
  flag,
  'r-group': {
    role: {
      roles: ['mod'],
      'r-role': {
        edit: {
          title: 'Steward',
          description: 'Still keeps the peace',
          image: '',
          cover: '',
        },
      },
    },
  },
} satisfies ub.GroupResponse;

describe('toGroupsUpdate seat responses', () => {
  test('reads the role list an add-roles response nests', () => {
    expect(toGroupsUpdate(addRoles)).toEqual({
      type: 'addGroupMembersToRole',
      ships,
      roles: ['admin', 'mod'],
      groupId: flag,
    });
  });

  test('reads the role list a del-roles response nests', () => {
    expect(toGroupsUpdate(delRoles)).toEqual({
      type: 'removeGroupMembersFromRole',
      ships,
      roles: ['admin'],
      groupId: flag,
    });
  });

  test('skips an update whose role list is not an array', () => {
    // the pre-fix bug shape: the nested object handed straight through, which
    // reached the db layer and blew up `.map` / `inArray`
    const malformed = {
      flag,
      'r-group': { seat: { ships, 'r-seat': { 'add-roles': ['admin'] } } },
    } as unknown as ub.GroupResponse;
    expect(toGroupsUpdate(malformed)).toBeNull();
  });

  test('leaves plain seat add/del responses alone', () => {
    expect(toGroupsUpdate(seatDel)).toEqual({
      type: 'removeGroupMembers',
      ships,
      groupId: flag,
    });
    const add = {
      flag,
      'r-group': {
        seat: { ships, 'r-seat': { add: { roles: [], joined: 0 } } },
      },
    } satisfies ub.GroupResponse;
    expect(toGroupsUpdate(add)).toEqual({
      type: 'addGroupMembers',
      ships,
      groupId: flag,
    });
  });
});

describe('toGroupsUpdate role responses', () => {
  test('converts an add-role response to client metadata field names', () => {
    expect(toGroupsUpdate(roleAdd)).toEqual({
      type: 'addRole',
      roleId: 'mod',
      groupId: flag,
      meta: {
        title: 'Mod',
        description: 'Keeps the peace',
        iconImage: 'https://example.com/icon.png',
        iconImageColor: null,
        coverImage: null,
        coverImageColor: '#ff0000',
      },
    });
  });

  test('converts an edit-role response and nulls out empty images', () => {
    expect(toGroupsUpdate(roleEdit)).toEqual({
      type: 'editRole',
      roleId: 'mod',
      groupId: flag,
      meta: {
        title: 'Steward',
        description: 'Still keeps the peace',
        iconImage: null,
        iconImageColor: null,
        coverImage: null,
        coverImageColor: null,
      },
    });
  });
});

describe('toGroupsUpdate section-order responses', () => {
  // groups-json.hoon's `++r-group` wraps every delta in `frond -.r-group`, and
  // the %section-order arm adds its own `frond 'section-order'`, so the list
  // arrives one level deeper than the snapshot's bare array.
  test('reads the section ids from the nested section-order envelope', () => {
    const sectionOrder = {
      flag,
      'r-group': { 'section-order': { 'section-order': ['sec-a', 'sec-b'] } },
    } satisfies ub.GroupResponse;
    expect(toGroupsUpdate(sectionOrder)).toEqual({
      type: 'updateSectionOrder',
      groupId: flag,
      sectionIds: ['sec-a', 'sec-b'],
    });
  });
});

// Shaped from groups-json.hoon `++channel-preview:v7:enjs`, the JSON grow arm
// of %channel-preview-1.
const channelPreview = {
  nest: 'chat/~solfer-magfed/general',
  meta: { title: 'General', description: 'Chatter', image: '', cover: '' },
  group: {
    flag,
    meta: { title: 'Test', description: '', image: '', cover: '' },
    time: 1700000000000,
    'member-count': 3,
    privacy: 'public',
  },
} satisfies ub.ChannelPreview;

test('getChannelPreview watches the v1 channel preview path', async () => {
  vi.mocked(subscribeOnce).mockResolvedValueOnce(channelPreview);
  const channel = await getChannelPreview(channelPreview.nest);
  expect(vi.mocked(subscribeOnce).mock.calls[0][0]).toEqual({
    app: 'groups',
    path: '/v1/channels/chat/~solfer-magfed/general/preview',
  });
  expect(channel).toMatchObject({
    id: channelPreview.nest,
    groupId: flag,
    type: 'chat',
    title: 'General',
    description: 'Chatter',
    currentUserIsHost: false,
  });
});

// The group-ui shape groups-json.hoon `++group-ui:v11:enjs` emits. Without a
// count it is the bare `++group` shape of /v3/groups and a %create response.
function wireGroup(seatIds: string[], memberCount?: number): ub.GroupV11 {
  return {
    meta: { title: 'Test', description: '', image: '', cover: '' },
    admissions: {
      privacy: 'public',
      banned: { ships: [], ranks: [] },
      pending: {},
      requests: {},
      tokens: {},
      referrals: {},
      invited: {},
    },
    seats: Object.fromEntries(
      seatIds.map((id) => [id, { roles: [], joined: 1700000000000 }])
    ),
    roles: {},
    admins: [],
    channels: {},
    'active-channels': [],
    sections: {},
    'section-order': [],
    'flagged-content': {},
    ...(memberCount === undefined ? {} : { 'member-count': memberCount }),
    init: true,
  };
}

const previewV7 = {
  flag,
  meta: { title: 'Test', description: '', image: '', cover: '' },
  time: 1700000000000,
  'member-count': 40,
  privacy: 'public',
} satisfies ub.GroupPreviewV7;

describe('group member counts', () => {
  // init and changes truncate seats to ours plus 14 others
  test('toClientGroup takes the count from the payload, not the roster', () => {
    const group = toClientGroup(flag, wireGroup(['~zod', '~bus'], 40), true);
    expect(group.memberCount).toBe(40);
    expect(group.members).toHaveLength(2);
  });

  // a null would clear the stored count on upsert
  test('toClientGroup leaves the count out when the payload has none', () => {
    expect(toClientGroup(flag, wireGroup(['~zod']), true)).not.toHaveProperty(
      'memberCount'
    );
  });

  test('a %create response counts its seats, which it sends untruncated', () => {
    const create = {
      flag,
      'r-group': { create: wireGroup(['~zod', '~bus', '~nec']) },
    } satisfies ub.GroupResponse;
    expect(toGroupsUpdate(create)).toMatchObject({
      type: 'addGroup',
      group: { id: flag, memberCount: 3 },
    });
  });

  test('toClientGroupFromForeign reads the count off the preview', () => {
    const foreign = {
      invites: [],
      lookup: 'done',
      preview: previewV7,
      progress: null,
      token: null,
    } satisfies ub.Foreign;
    expect(toClientGroupFromForeign(flag, foreign).memberCount).toBe(40);
  });

  test('toClientGroupFromForeign leaves the count out without a preview', () => {
    const foreign = {
      invites: [],
      lookup: 'preview',
      preview: null,
      progress: null,
      token: null,
    } satisfies ub.Foreign;
    expect(toClientGroupFromForeign(flag, foreign)).not.toHaveProperty(
      'memberCount'
    );
  });

  // the /gangs preview paths send the v2 preview, which has no count
  test('toClientGroupFromPreview leaves the count out of a v2 preview', () => {
    const preview = {
      flag,
      meta: { title: 'Test', description: '', image: '', cover: '' },
      cordon: { open: { ships: [], ranks: [] } },
      time: 1700000000000,
      secret: false,
    } satisfies ub.GroupPreview;
    expect(toClientGroupFromPreview(flag, preview)).not.toHaveProperty(
      'memberCount'
    );
  });

  describe('from changes', () => {
    const fifteenSeats = Array.from({ length: 15 }, (_, i) => `~ship-${i}`);

    function changedGroups(groups: ub.GroupsV11) {
      return parseChanges({
        groups,
        channels: {},
        chat: {},
        contacts: {},
        activity: {},
      }).groups;
    }

    test('keeps a count below the 15-seat cap', () => {
      const [group] = changedGroups({
        [flag]: wireGroup(['~zod', '~bus', '~nec'], 3),
      });
      expect(group.memberCount).toBe(3);
    });

    // /v3/changes counts seats after truncating them, so 15 means "15 or more"
    test('drops a count that may be the cap', () => {
      const [group] = changedGroups({ [flag]: wireGroup(fifteenSeats, 15) });
      expect(group.memberCount).toBeUndefined();
    });

    test('keeps a count above the cap, which only a restored count can be', () => {
      const [group] = changedGroups({ [flag]: wireGroup(fifteenSeats, 40) });
      expect(group.memberCount).toBe(40);
    });
  });
});
