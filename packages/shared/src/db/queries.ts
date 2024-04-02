import {
  AnyColumn,
  Column,
  SQLWrapper,
  Table,
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNull,
  lt,
  not,
  or,
  sql,
} from 'drizzle-orm';

import { client } from './client';
import { createReadQuery, createWriteQuery } from './query';
import {
  channels as $channels,
  contactGroups as $contactGroups,
  contacts as $contacts,
  groupMemberRoles as $groupMemberRoles,
  groupMembers as $groupMembers,
  groupRoles as $groupRoles,
  groups as $groups,
  pins as $pins,
  posts as $posts,
  unreads as $unreads,
} from './schema';
import {
  ChannelInsert,
  ContactInsert,
  GroupInsert,
  Pin,
  PostInsert,
  Unread,
  UnreadInsert,
} from './types';

export interface GetGroupsOptions {
  sort?: 'pinIndex';
  includeUnjoined?: boolean;
}

export const getGroups = createReadQuery(
  'getGroups',
  async ({ sort, includeUnjoined }: GetGroupsOptions = {}) => {
    const unreadCounts = client
      .select({
        groupId: $channels.groupId,
        count: count().as('count'),
      })
      .from($channels)
      .rightJoin($unreads, eq($channels.id, $unreads.channelId))
      .groupBy($channels.groupId)
      .having(gt($unreads.totalCount, 0))
      .as('unreadCounts');
    const query = client
      .select({
        ...getTableColumns($groups),
        unreadCount: unreadCounts.count,
        lastPost: getTableColumns($posts),
      })
      .from($groups)
      .where(includeUnjoined ? undefined : eq($groups.isJoined, true))
      .leftJoin(unreadCounts, eq($groups.id, unreadCounts.groupId))
      .leftJoin($posts, eq($groups.lastPostId, $posts.id));
    return sort === 'pinIndex'
      ? query.orderBy(ascNullsLast($groups.pinIndex), desc($groups.lastPostAt))
      : query;
  },
  ['groups', 'pins', 'unreads', 'posts']
);

export const insertGroups = createWriteQuery(
  'insertGroups',
  async (groupData: GroupInsert[]) => {
    for (let group of groupData) {
      await insertGroup(group);
    }
  },
  [
    'groups',
    'groupRoles',
    'contacts',
    'groupMembers',
    'groupMemberRoles',
    'channels',
    'pins',
  ]
);

// Note that this is not exported or wrapped in a write query -- it's used only by
// insertGroups, and wrapping this in a write query would cause it to trigger
// events for each group record inserted.
// TODO: figure out a way to trigger only one set of events per batch.
const insertGroup = async (group: GroupInsert) => {
  await client.transaction(async (tx) => {
    await tx
      .insert($groups)
      .values(group)
      .onConflictDoUpdate({
        target: $groups.id,
        set: conflictUpdateSet(
          $groups.iconImage,
          $groups.coverImage,
          $groups.title,
          $groups.description,
          $groups.isSecret,
          $groups.isJoined
        ),
      });
    if (group.roles) {
      await client
        .insert($groupRoles)
        .values(group.roles)
        .onConflictDoUpdate({
          target: [$groupRoles.groupId, $groupRoles.id],
          set: conflictUpdateSet(
            $groupRoles.groupId,
            $groupRoles.iconImage,
            $groupRoles.coverImage,
            $groupRoles.title,
            $groupRoles.description
          ),
        });
    }
    if (group.members) {
      await client
        .insert($contacts)
        .values(group.members.map((m) => ({ id: m.contactId })))
        .onConflictDoNothing();
      await client
        .insert($groupMembers)
        .values(group.members)
        .onConflictDoNothing();
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
        await client
          .insert($groupMemberRoles)
          .values(memberRoles)
          .onConflictDoNothing();
      }
    }
    if (group.channels?.length) {
      await client
        .insert($channels)
        .values(group.channels)
        .onConflictDoUpdate({
          target: [$channels.id],
          set: conflictUpdateSet(
            $channels.iconImage,
            $channels.coverImage,
            $channels.title,
            $channels.description,
            $channels.addedToGroupAt,
            $channels.currentUserIsMember
          ),
        });
    }
    if (group.posts) {
    }
  });
};

export const getGroupRoles = createReadQuery(
  'getGroupRoles',
  async (groupId: string) => {
    return client.query.groupRoles.findMany();
  },
  ['groupRoles']
);

export const getUnreadsCount = createReadQuery(
  'getUnreadsCount',
  async ({ type }: { type?: Unread['type'] }) => {
    const result = await client
      .select({ count: count() })
      .from($unreads)
      .where(() =>
        and(
          gt($unreads.totalCount, 0),
          type ? eq($unreads.type, type) : undefined
        )
      );
    return result[0].count;
  },
  ['unreads']
);

export const getUnreads = createReadQuery(
  'getUnreads',
  async ({
    orderBy = 'updatedAt',
    includeFullyRead = true,
    type,
  }: {
    orderBy?: 'updatedAt';
    includeFullyRead?: boolean;
    type?: Unread['type'];
  } = {}) => {
    return client.query.unreads.findMany({
      where: and(
        type ? eq($unreads.type, type) : undefined,
        includeFullyRead ? undefined : gt($unreads.totalCount, 0)
      ),
      orderBy: orderBy === 'updatedAt' ? desc($unreads.updatedAt) : undefined,
    });
  },
  ['unreads']
);

export const getAllUnreadsCounts = createReadQuery(
  'getAllUnreadCounts',
  async () => {
    const [channelUnreadCount, dmUnreadCount] = await Promise.all([
      getUnreadsCount({ type: 'channel' }),
      getUnreadsCount({ type: 'dm' }),
    ]);
    return {
      channels: channelUnreadCount ?? 0,
      dms: dmUnreadCount ?? 0,
      total: (channelUnreadCount ?? 0) + (dmUnreadCount ?? 0),
    };
  },
  ['unreads']
);

export const getChannel = createReadQuery(
  'getChannel',
  async (id: string) => {
    return client.query.channels.findFirst({ where: eq($channels.id, id) });
  },
  ['channels']
);

export const updateChannel = createWriteQuery(
  'updateChannel',
  (update: ChannelInsert) => {
    return client
      .update($channels)
      .set(update)
      .where(eq($channels.id, update.id));
  },
  ['channels']
);

export const getChannelPosts = createReadQuery(
  'getChannelPosts',
  async (channelId: string) => {
    return client.query.posts.findMany({
      where: eq($posts.channelId, channelId),
      with: {
        author: true,
        reactions: true,
      },
    });
  },
  ['posts', 'channels']
);

export const insertChannelPosts = createWriteQuery(
  'insertChannelPosts',
  async (channelId: string, posts: PostInsert[]) => {
    return client.transaction(async (tx) => {
      const lastPost = posts[posts.length - 1];
      // Update last post meta for the channel these posts belong to,
      // Also grab that channels groupId for updating the group's lastPostAt and
      // associating the posts with the group.
      const updatedChannels = await tx
        .update($channels)
        .set({ lastPostId: lastPost.id, lastPostAt: lastPost.receivedAt })
        .where(
          and(
            eq($channels.id, channelId),
            or(
              isNull($channels.lastPostAt),
              lt($channels.lastPostAt, lastPost.receivedAt ?? 0)
            )
          )
        )
        .returning({ groupId: $channels.groupId });
      // Update group if we found one.
      const groupId = updatedChannels[0]?.groupId;
      if (groupId) {
        await tx
          .update($groups)
          .set({ lastPostId: lastPost.id, lastPostAt: lastPost.receivedAt })
          .where(
            and(
              eq($groups.id, groupId),
              or(
                isNull($groups.lastPostAt),
                lt($groups.lastPostAt, lastPost.receivedAt ?? 0)
              )
            )
          );
      }
      // Actually insert posts, overwriting any existing posts with the same id.
      await tx
        .insert($posts)
        .values(posts.map((p) => ({ ...p, groupId, channelId })))
        .onConflictDoUpdate({
          target: $posts.id,
          set: conflictUpdateSetAll($posts),
        });
    });
  },
  ['posts', 'channels', 'groups']
);

export const getPosts = createReadQuery(
  'getPosts',
  () => {
    return client.select().from($posts);
  },
  ['posts']
);

export const getGroup = createReadQuery(
  'getGroup',
  async (id: string) => {
    return client.query.groups.findFirst({
      where: (groups, { eq }) => eq(groups.id, id),
      with: {
        channels: true,
        roles: true,
        members: true,
      },
    });
  },
  ['groups']
);

export const getContacts = createReadQuery(
  'getContacts',
  async () => {
    return client.query.contacts.findMany({
      with: {
        pinnedGroups: {
          with: {
            group: true,
          },
        },
      },
    });
  },
  ['contacts']
);

export const getContactsCount = createReadQuery(
  'getContactsCount',
  async () => {
    const result = await client.select({ count: count() }).from($contacts);
    return result[0].count;
  },
  ['contacts']
);

export const getContact = createReadQuery(
  'getContact',
  async (id: string) => {
    return client.query.contacts.findFirst({
      where: (contacts, { eq }) => eq(contacts.id, id),
    });
  },
  ['contacts']
);

export const insertContact = createWriteQuery(
  'insertContact',
  async (contact: ContactInsert) => {
    return client.insert($contacts).values(contact);
  },
  ['contacts']
);

export const insertContacts = createWriteQuery(
  'insertContacts',
  async (contactsData: ContactInsert[]) => {
    const contactGroups = contactsData.flatMap(
      (contact) => contact.pinnedGroups || []
    );
    const targetGroups = contactGroups.map(
      (g): GroupInsert => ({
        id: g.groupId,
        isSecret: false,
      })
    );
    await client.insert($contacts).values(contactsData).onConflictDoNothing();
    await client.insert($groups).values(targetGroups).onConflictDoNothing();
    // TODO: Remove stale pinned groups
    await client
      .insert($contactGroups)
      .values(contactGroups)
      .onConflictDoNothing();
  },
  ['contacts', 'groups', 'contactGroups']
);

export const insertUnreads = createWriteQuery(
  'insertUnreads',
  async (unreads: UnreadInsert[]) => {
    return client.transaction(() => {
      return client
        .insert($unreads)
        .values(unreads)
        .onConflictDoUpdate({
          target: [$unreads.channelId],
          set: conflictUpdateSetAll($unreads),
        });
    });
  },
  ['unreads']
);

export const insertPinnedItems = createWriteQuery(
  'insertPinnedItems',
  async (pinnedItems: Pin[]) => {
    return client.transaction(async (tx) => {
      await Promise.all([
        tx.delete($pins),
        tx
          .update($groups)
          .set({ pinIndex: null })
          .where(not(isNull($groups.pinIndex))),
      ]);
      await tx.insert($pins).values(pinnedItems);
      const groups: GroupInsert[] = pinnedItems.flatMap((p) => {
        if (!p.itemId) {
          return [];
        }
        return [
          {
            id: p.itemId,
            pinIndex: p.index,
          },
        ];
      });
      await tx
        .insert($groups)
        .values(groups)
        .onConflictDoUpdate({
          target: [$groups.id],
          set: {
            pinIndex: sql`excluded.pin_index`,
          },
        });
    });
  },
  ['pins', 'groups']
);

export const getPinnedItems = createReadQuery(
  'getPinnedItems',
  async (params?: { orderBy?: keyof Pin; direction?: 'asc' | 'desc' }) => {
    return client.query.pins.findMany({
      orderBy: params?.orderBy
        ? (pins, { asc, desc }) => [
            (params.direction === 'asc' ? asc : desc)(pins[params.orderBy!]),
          ]
        : undefined,
    });
  },
  ['pins']
);

// Helpers

function conflictUpdateSetAll(table: Table) {
  const columns = getTableColumns(table);
  return conflictUpdateSet(...Object.values(columns));
}

function conflictUpdateSet(...columns: Column[]) {
  return Object.fromEntries(
    columns.map((c) => [toCamelCase(c.name), sql.raw(`excluded.${c.name}`)])
  );
}

function ascNullsLast(column: SQLWrapper | AnyColumn) {
  return sql`${column} ASC NULLS LAST`;
}

function toCamelCase(str: string) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
