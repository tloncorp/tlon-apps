import * as $ from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import * as queries from './queries';
import * as schema from './schema';
import type { Group } from './types';

setupDatabaseTestSuite();

const groupId = '~bus/role-memberships';
const membership = { groupId, contactId: '~zod', roleId: 'moderator' };
const baseGroup: Group = {
  id: groupId,
  currentUserIsMember: true,
  currentUserIsHost: false,
  hostUserId: '~bus',
};
const group: Group = {
  ...baseGroup,
  roles: [{ id: membership.roleId, groupId }],
  members: [
    {
      chatId: groupId,
      contactId: membership.contactId,
      membershipType: 'group',
      roles: [membership],
    },
  ],
};

async function memberships() {
  return getClient()!.query.chatMemberGroupRoles.findMany({
    orderBy: [
      $.asc(schema.chatMemberGroupRoles.groupId),
      $.asc(schema.chatMemberGroupRoles.contactId),
      $.asc(schema.chatMemberGroupRoles.roleId),
    ],
  });
}

describe('addChatMembersToRoles', () => {
  test.each(['optimistic assignment', 'group snapshot'])(
    'accepts a repeated assignment after %s',
    async (source) => {
      if (source === 'optimistic assignment') {
        await queries.insertGroups({ groups: [baseGroup] });
        await queries.addMembersToRole({
          groupId,
          roleId: membership.roleId,
          contactIds: [membership.contactId],
        });
      } else {
        await queries.insertGroups({ groups: [group] });
      }
      expect(await memberships()).toEqual([membership]);

      for (let i = 0; i < 2; i++) {
        await queries.addChatMembersToRoles({
          groupId,
          contactIds: [membership.contactId],
          roleIds: [membership.roleId],
        });
      }
      expect(await memberships()).toEqual([membership]);
    }
  );

  test('retains existing memberships and inserts every new pair in a mixed batch', async () => {
    const otherGroupId = '~bus/other-group';
    await queries.insertGroups({
      groups: [group, { ...baseGroup, id: otherGroupId }],
    });
    await queries.addMembersToRole({
      groupId: otherGroupId,
      contactIds: [membership.contactId],
      roleId: membership.roleId,
    });

    await queries.addChatMembersToRoles({
      groupId,
      contactIds: ['~zod', '~nec', '~nec'],
      roleIds: ['moderator', 'writer', 'writer'],
    });

    expect(await memberships()).toEqual([
      { ...membership, groupId: otherGroupId },
      { groupId, contactId: '~nec', roleId: 'moderator' },
      { groupId, contactId: '~nec', roleId: 'writer' },
      membership,
      { groupId, contactId: '~zod', roleId: 'writer' },
    ]);
  });

  test.each([
    { contactIds: [], roleIds: ['moderator'] },
    { contactIds: ['~zod'], roleIds: [] },
    { contactIds: [], roleIds: [] },
  ])('accepts an empty assignment: %j', async (assignment) => {
    await queries.insertGroups({ groups: [group] });
    await queries.addChatMembersToRoles({ groupId, ...assignment });
    expect(await memberships()).toEqual([membership]);
  });

  test('still rejects a genuine foreign-key violation', async () => {
    const client = getClient()!;
    client.run($.sql`PRAGMA foreign_keys = ON`);
    try {
      await expect(
        queries.addChatMembersToRoles({
          groupId: '~bus/missing-group',
          contactIds: ['~zod'],
          roleIds: ['moderator'],
        })
      ).rejects.toThrow(/FOREIGN KEY constraint failed/);
      expect(await memberships()).toEqual([]);
    } finally {
      client.run($.sql`PRAGMA foreign_keys = OFF`);
    }
  });
});
