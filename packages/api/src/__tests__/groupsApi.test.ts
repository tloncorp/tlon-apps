import { describe, expect, test } from 'vitest';

import { toGroupsUpdate } from '../client/groupsApi';
import type * as ub from '../urbit';

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
