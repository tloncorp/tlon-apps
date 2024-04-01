import { Column, and, count, eq, gt, sql } from 'drizzle-orm';
import { SQLiteTable, SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';

import { client } from './client';
import * as schemas from './schema';
import {
  ContactInsert,
  GroupInsert,
  Insertable,
  Pin,
  PostInsert,
  Unread,
} from './types';

export const getGroups = async () => {
  return client.query.groups.findMany({
    with: {
      roles: true,
      members: true,
      channels: true,
    },
  });
};

export const insertGroup = async (group: GroupInsert) => {
  await client.transaction(async (tx) => {
    await tx.insert(schemas.groups).values(group).onConflictDoNothing();
    if (group.roles) {
      await client
        .insert(schemas.groupRoles)
        .values(group.roles)
        .onConflictDoUpdate({
          target: [schemas.groupRoles.groupId, schemas.groupRoles.id],
          set: conflictUpdateSet(schemas.groupRoles, [
            'groupId',
            'iconImage',
            'coverImage',
            'title',
            'description',
          ]),
        });
    }
    if (group.members) {
      await client
        .insert(schemas.contacts)
        .values(group.members.map((m) => ({ id: m.contactId })))
        .onConflictDoNothing();
      await client.insert(schemas.groupMembers).values(group.members);
      const validRoleNames = group.roles?.map((r) => r.id);
      const memberRoles = group.members.flatMap((m) => {
        return (m.roles ?? []).flatMap((r) => {
          // TODO: This is here because I've seen at least one instance (in
          // Galen's TD group) where a member is assigned a role that doesn't
          // exist in the group's cabals. Should figure out if this is expected
          // behavior if we should try retain the role.
          if (!validRoleNames?.includes(r.roleId)) {
            console.warn('discarding invalid role', r.contactId, r.roleId);
            return [];
          }
          return {
            groupId: group.id,
            contactId: m.contactId,
            roleId: r.roleId,
          };
        });
      });
      if (memberRoles.length) {
        await client.insert(schemas.groupMemberRoles).values(memberRoles);
      }
    }
    if (group.channels?.length) {
      await client
        .insert(schemas.channels)
        .values(group.channels)
        .onConflictDoUpdate({
          target: [schemas.channels.id],
          set: conflictUpdateSet(schemas.channels, [
            'iconImage',
            'coverImage',
            'title',
            'description',
            'addedToGroupAt',
            'currentUserIsMember',
          ]),
        });
    }
    if (group.posts) {
    }
  });
};

export function getGroupRoles(groupId: string) {
  return client.query.groupRoles.findMany();
}

export async function getUnreadsCount({ type }: { type?: Unread['type'] }) {
  const result = await client
    .select({ count: count() })
    .from(schemas.unreads)
    .where(() =>
      and(
        gt(schemas.unreads.totalCount, 0),
        type ? eq(schemas.unreads.type, type) : undefined
      )
    );
  return result[0].count;
}

export async function getAllUnreadsCounts() {
  const [channelUnreadCount, dmUnreadCount] = await Promise.all([
    getUnreadsCount({ type: 'channel' }),
    getUnreadsCount({ type: 'dm' }),
  ]);
  return {
    channels: channelUnreadCount ?? 0,
    dms: dmUnreadCount ?? 0,
    total: (channelUnreadCount ?? 0) + (dmUnreadCount ?? 0),
  };
}

export const insertGroups = async (groupData: GroupInsert[]) => {
  for (let group of groupData) {
    await insertGroup(group);
  }
};

export const getGroup = async (id: string) => {
  return client.query.groups.findFirst({
    where: (groups, { eq }) => eq(groups.id, id),
  });
};

export const getContacts = async () => {
  return client.query.contacts.findMany({
    with: {
      pinnedGroups: {
        with: {
          group: true,
        },
      },
    },
  });
};

export const getContactsCount = async () => {
  const result = await client.select({ count: count() }).from(schemas.contacts);
  return result[0].count;
};

export const getContact = async (id: string) => {
  return client.query.contacts.findFirst({
    where: (contacts, { eq }) => eq(contacts.id, id),
  });
};

export const insertContact = async (id: string, contact: ContactInsert) => {
  return client.insert(schemas.contacts).values(contact);
};

export const insertContacts = async (contactsData: ContactInsert[]) => {
  const contactGroups = contactsData.flatMap(
    (contact) => contact.pinnedGroups || []
  );
  const targetGroups = contactGroups.map(
    (g): GroupInsert => ({
      id: g.groupId,
      isSecret: false,
    })
  );
  await client
    .insert(schemas.contacts)
    .values(contactsData)
    .onConflictDoNothing();
  await client
    .insert(schemas.groups)
    .values(targetGroups)
    .onConflictDoNothing();
  // TODO: Remove stale pinned groups
  await client
    .insert(schemas.contactGroups)
    .values(contactGroups)
    .onConflictDoNothing();
};

export const insertPosts = async (postsData: PostInsert[]) => {
  const postGroups = postsData.flatMap((p) => p.groupId);

  // const targetGroups = postGroups.map(
  // (p): GroupInsert => ({
  // id: p,
  // })
  // );

  return client.insert(schemas.posts).values(postsData);
};

export const insertUnreads = async (unreads: Insertable<'unreads'>[]) => {
  return client
    .insert(schemas.unreads)
    .values(unreads)
    .onConflictDoUpdate({
      target: [schemas.unreads.channelId],
      set: {
        totalCount: sql.raw(`excluded.totalCount + unreads.totalCount`),
      },
    });
};

export const insertPinnedItems = async (pinnedItems: Pin[]) => {
  return client.insert(schemas.pins).values(pinnedItems);
};

export const getPinnedItems = async (params?: {
  orderBy?: keyof Pin;
  direction?: 'asc' | 'desc';
}) => {
  return client.query.pins.findMany({
    orderBy: params?.orderBy
      ? (pins, { asc, desc }) => [
          (params.direction === 'asc' ? asc : desc)(pins[params.orderBy!]),
        ]
      : undefined,
  });
};

// Helpers

export function conflictUpdateSet<TTable extends SQLiteTable>(
  table: TTable,
  columns: (keyof TTable['_']['columns'] & keyof TTable)[]
): SQLiteUpdateSetSource<TTable> {
  return Object.assign(
    {},
    ...columns.map((k) => ({
      [k]: sql.raw(`excluded.${(table[k] as unknown as Column).name}`),
    }))
  ) as SQLiteUpdateSetSource<TTable>;
}
