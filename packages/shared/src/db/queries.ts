import {
  AnyColumn,
  Column,
  SQLWrapper,
  Subquery,
  Table,
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  min,
  not,
  or,
  sql,
} from 'drizzle-orm';

import { ChannelInit } from '../api';
import { createDevLogger } from '../debug';
import { appendContactIdToReplies, getCompositeGroups } from '../logic';
import { Rank, desig } from '../urbit';
import { AnySqliteDatabase, AnySqliteTransaction, client } from './client';
import { createReadQuery, createWriteQuery } from './query';
import {
  channelWriters as $channelWriters,
  channels as $channels,
  chatMemberGroupRoles as $chatMemberGroupRoles,
  chatMembers as $chatMembers,
  contactGroups as $contactGroups,
  contacts as $contacts,
  groupFlaggedPosts as $groupFlaggedPosts,
  groupMemberBans as $groupMemberBans,
  groupMemberInvites as $groupMemberInvites,
  groupNavSectionChannels as $groupNavSectionChannels,
  groupNavSections as $groupNavSections,
  groupRankBans as $groupRankBans,
  groupRoles as $groupRoles,
  groups as $groups,
  pins as $pins,
  postReactions as $postReactions,
  postWindows as $postWindows,
  posts as $posts,
  settings as $settings,
  threadUnreads as $threadUnreads,
  unreads as $unreads,
} from './schema';
import {
  Channel,
  ChatMember,
  ClientMeta,
  Contact,
  Group,
  GroupNavSection,
  GroupRole,
  Pin,
  PinType,
  Post,
  PostWindow,
  Reaction,
  Settings,
  TableName,
  ThreadUnreadState,
  Unread,
} from './types';

const logger = createDevLogger('queries', false);

const GROUP_META_COLUMNS = {
  id: true,
  title: true,
  description: true,
  iconImage: true,
  iconImageColor: true,
  coverImage: true,
  coverImageColor: true,
};

export interface GetGroupsOptions {
  includeUnjoined?: boolean;
  includeUnreads?: boolean;
  includeLastPost?: boolean;
}

export const insertSettings = createWriteQuery(
  'insertSettings',
  async (settings: Settings) => {
    return client
      .insert($settings)
      .values(settings)
      .onConflictDoUpdate({
        target: $settings.userId,
        set: conflictUpdateSetAll($settings),
      });
  },
  ['settings']
);

export const getSettings = createReadQuery(
  'getSettings',
  async (userId: string) => {
    return client.query.settings.findFirst({
      where(fields) {
        return eq(fields.userId, desig(userId));
      },
    });
  },
  ['settings']
);

export const getGroupPreviews = createReadQuery(
  'getGroupPreviews',
  async (groupIds: string[]) => {
    return client.query.groups.findMany({
      where: inArray($groups.id, groupIds),
    });
  },
  []
);

export const getGroups = createReadQuery(
  'getGroups',
  async ({
    includeUnjoined,
    includeLastPost,
    includeUnreads,
  }: GetGroupsOptions = {}): Promise<Group[]> => {
    const unreadCounts = client
      .select({
        groupId: $channels.groupId,
        count: count().as('count'),
      })
      .from($channels)
      .rightJoin($unreads, eq($channels.id, $unreads.channelId))
      .groupBy($channels.groupId)
      .having(gt($unreads.count, 0))
      .as('unreadCounts');
    const query = client
      .select({
        ...getTableColumns($groups),
        ...(includeUnreads ? { unreadCount: unreadCounts.count } : undefined),
        ...(includeLastPost
          ? { lastPost: getTableColumns($posts) }
          : undefined),
      })
      .from($groups)
      .where(() =>
        includeUnjoined ? undefined : eq($groups.currentUserIsMember, true)
      );
    if (includeLastPost) {
      query.leftJoin($posts, eq($groups.lastPostId, $posts.id));
    }
    if (includeUnreads) {
      query.leftJoin(unreadCounts, eq($groups.id, unreadCounts.groupId));
    }
    return query;
  },
  ({ includeLastPost, includeUnreads }: GetGroupsOptions): TableName[] => [
    'groups',
    ...(includeLastPost ? (['posts'] as TableName[]) : []),
    ...(includeUnreads ? (['unreads'] as TableName[]) : []),
  ]
);

export const getPendingChats = createReadQuery(
  'getPendingChats',
  async () => {
    const pendingGroups = await client.query.groups.findMany({
      where: or(
        eq($groups.haveInvite, true),
        isNotNull($groups.joinStatus),
        eq($groups.haveRequestedInvite, true)
      ),
    });

    const pendingChannels = await client.query.channels.findMany({
      where: eq($channels.isDmInvite, true),
      with: {
        members: {
          with: {
            contact: true,
          },
        },
      },
    });

    return [...pendingChannels, ...pendingGroups];
  },
  ['groups']
);

export const getChats = createReadQuery(
  'getChats',
  async (): Promise<Channel[]> => {
    const partitionedGroupsQuery = client
      .select({
        ...getTableColumns($channels),
        rn: sql`ROW_NUMBER() OVER(PARTITION BY ${$channels.groupId} ORDER BY ${$channels.lastPostAt} DESC)`.as(
          'rn'
        ),
      })
      .from($channels)
      .where(and(isNotNull($channels.groupId)))
      .as('q');

    const groupChannels = client
      .select()
      .from(partitionedGroupsQuery)
      .where(eq(partitionedGroupsQuery.rn, 1));

    const allChannels = client
      .select({
        ...getTableColumns($channels),
        rn: sql`0`.as('rn'),
      })
      .from($channels)
      .where(and(isNull($channels.groupId), eq($channels.isDmInvite, false)))
      .union(groupChannels)
      .as('ac');

    const result = await client
      .select({
        ...allQueryColumns(allChannels),
        group: getTableColumns($groups),
        unread: getTableColumns($unreads),
        pin: getTableColumns($pins),
        lastPost: getTableColumns($posts),
        member: {
          ...getTableColumns($chatMembers),
        },
        contact: getTableColumns($contacts),
      })
      .from(allChannels)
      .leftJoin($groups, eq($groups.id, allChannels.groupId))
      .leftJoin($unreads, eq($unreads.channelId, allChannels.id))
      .leftJoin(
        $pins,
        or(
          eq(allChannels.groupId, $pins.itemId),
          eq(allChannels.id, $pins.itemId)
        )
      )
      .leftJoin($posts, eq($posts.id, allChannels.lastPostId))
      .leftJoin($chatMembers, eq($chatMembers.chatId, allChannels.id))
      .leftJoin($contacts, eq($contacts.id, $chatMembers.contactId))
      .orderBy(
        ascNullsLast($pins.index),
        sql`(CASE WHEN ${$groups.isNew} = 1 THEN 1 ELSE 0 END) DESC`,
        desc($unreads.updatedAt)
      );

    const [chatMembers, filteredChannels] = result.reduce<
      [
        Record<string, (ChatMember & { contact: Contact | null })[]>,
        typeof result,
      ]
    >(
      ([members, filteredChannels], channel) => {
        if (!channel.member || !members[channel.id]) {
          filteredChannels.push(channel);
        }
        if (channel.member) {
          members[channel.id] ||= [];
          members[channel.id].push({
            ...channel.member,
            contact: channel.contact ?? null,
          });
        }
        return [members, filteredChannels];
      },
      [{}, [] as typeof result]
    );

    return filteredChannels.map((c) => {
      return {
        ...c,
        members: chatMembers[c.id] ?? null,
      };
    });
  },
  ['groups', 'channels', 'unreads', 'threadUnreads']
);

export const insertGroups = createWriteQuery(
  'insertGroups',
  async (groupData: Group[], overWrite: boolean = true) => {
    await client.transaction(async (tx) => {
      for (const group of groupData) {
        if (overWrite) {
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
                $groups.privacy,
                $groups.joinStatus,
                $groups.currentUserIsMember,
                $groups.haveInvite
              ),
            });
        } else {
          await tx.insert($groups).values(group).onConflictDoNothing();
        }
        if (group.channels?.length) {
          await tx
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
                $channels.type,
                $channels.isPendingChannel
              ),
            });
        }
        if (group.flaggedPosts?.length) {
          await tx
            .insert($groupFlaggedPosts)
            .values(group.flaggedPosts)
            .onConflictDoNothing();
        }
        if (group.navSections) {
          await tx
            .insert($groupNavSections)
            .values(
              group.navSections.map((s) => ({
                id: s.id,
                groupId: group.id,
                title: s.title,
                description: s.description,
                index: s.index,
              }))
            )
            .onConflictDoUpdate({
              target: $groupNavSections.id,
              set: conflictUpdateSet(
                $groupNavSections.iconImage,
                $groupNavSections.coverImage,
                $groupNavSections.title,
                $groupNavSections.description
              ),
            });

          const navSectionChannels = group.navSections.flatMap(
            (s) => s.channels
          );
          if (navSectionChannels.length) {
            await tx
              .insert($groupNavSectionChannels)
              .values(
                navSectionChannels.map((s) => ({
                  index: s?.index,
                  groupNavSectionId: s?.groupNavSectionId,
                  channelId: s?.channelId,
                }))
              )
              .onConflictDoNothing();
          }
        }
        if (group.roles) {
          await tx
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
          await tx
            .insert($chatMembers)
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
            await tx
              .insert($chatMemberGroupRoles)
              .values(memberRoles)
              .onConflictDoNothing();
          }
        }
      }
      await setLastPosts(tx);
    });
  },
  [
    'groups',
    'groupRoles',
    'contacts',
    'chatMembers',
    'chatMemberGroupRoles',
    'channels',
    'pins',
  ]
);

export const updateGroup = createWriteQuery(
  'updateGroup',
  async (group: Partial<Group> & { id: string }) => {
    return client.update($groups).set(group).where(eq($groups.id, group.id));
  },
  ['groups']
);

export const deleteGroup = createWriteQuery(
  'deleteGroup',
  async (groupId: string) => {
    return client.delete($groups).where(eq($groups.id, groupId));
  },
  ['groups', 'channels']
);

export const insertUnjoinedGroups = createWriteQuery(
  'insertUnjoinedGroups',
  async (groups: Group[]) => {
    if (groups.length === 0) return;
    return client.transaction(async (tx) => {
      // ensure we never delete metadata if we get a partial for some reason
      // during the join process
      const existingUnjoined = await getUnjoinedGroupMeta(tx);
      const compositeUnjoined = getCompositeGroups(groups, existingUnjoined);

      await tx
        .insert($groups)
        .values(compositeUnjoined)
        .onConflictDoUpdate({
          target: $groups.id,
          setWhere: eq($groups.currentUserIsMember, false),
          set: conflictUpdateSetAll($groups),
        });
    });
  },
  ['groups']
);

export const getUnjoinedGroupMeta = createReadQuery(
  'getUnjoinedGroupMeta',
  async (tx: AnySqliteTransaction | AnySqliteDatabase) => {
    return tx.query.groups.findMany({
      where: eq($groups.currentUserIsMember, false),
      columns: GROUP_META_COLUMNS,
    });
  },
  ['groups']
);

export const getUnjoinedGroups = createReadQuery(
  'getUnjoinedGroups',
  async () => {
    return client.query.groups.findMany({
      where: eq($groups.currentUserIsMember, false),
    });
  },
  ['groups']
);

export const insertFlaggedPosts = createWriteQuery(
  'insertFlaggedPosts',
  async (
    content: {
      groupId: string;
      postId: string;
      channelId: string;
      flaggedByContactId: string;
    }[]
  ) => {
    return client
      .insert($groupFlaggedPosts)
      .values(content)
      .onConflictDoNothing();
  },
  ['groupFlaggedPosts']
);

export const getFlaggedPosts = createReadQuery(
  'getFlaggedPosts',
  async (groupId: string) => {
    return client.query.groupFlaggedPosts.findMany({
      where: eq($groupFlaggedPosts.groupId, groupId),
    });
  },
  ['groupFlaggedPosts']
);

export const insertChannelPerms = createWriteQuery(
  'insertChannelPerms',
  (channelsInit: ChannelInit[]): any => {
    const writers = channelsInit.flatMap((chanInit) =>
      chanInit.writers.map((writer) => ({
        channelId: chanInit.channelId,
        roleId: writer,
      }))
    );

    if (!writers.length) {
      return;
    }

    return client
      .insert($channelWriters)
      .values(writers)
      .onConflictDoUpdate({
        target: [$channelWriters.channelId, $channelWriters.roleId],
        set: conflictUpdateSetAll($channelWriters),
      });
  },
  ['channelWriters', 'channels']
);

export const getThreadPosts = createReadQuery(
  'getThreadPosts',
  ({ parentId }: { parentId: string }) => {
    return client.query.posts.findMany({
      where: eq($posts.parentId, parentId),
      with: {
        author: true,
        reactions: true,
      },
      orderBy: [desc($posts.receivedAt)],
    });
  },
  ['posts']
);

export const getThreadUnreadState = createReadQuery(
  'getThreadUnreadState',
  ({ parentId }: { parentId: string }) => {
    return client.query.threadUnreads.findFirst({
      where: eq($threadUnreads.threadId, parentId),
    });
  },
  ['posts']
);

export const getGroupRoles = createReadQuery(
  'getGroupRoles',
  async () => {
    return client.query.groupRoles.findMany();
  },
  ['groupRoles']
);

export const getChatMember = createReadQuery(
  'getChatMember',
  async ({ chatId, contactId }: { chatId: string; contactId: string }) => {
    return client.query.chatMembers
      .findFirst({
        where: and(
          eq($chatMembers.chatId, chatId),
          eq($chatMembers.contactId, contactId)
        ),
        with: {
          roles: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['chatMembers', 'chatMemberGroupRoles']
);

export const addChatMembers = createWriteQuery(
  'addChatMembers',
  async ({
    chatId,
    contactIds,
    type,
  }: {
    chatId: string;
    contactIds: string[];
    type: 'group' | 'channel';
  }) => {
    return client.transaction(async (tx) => {
      await tx
        .insert($chatMembers)
        .values(
          contactIds.map((contactId) => ({
            chatId,
            contactId,
            membershipType: type,
          }))
        )
        .onConflictDoNothing();
    });
  },
  ['chatMembers']
);

export const addGroupInvites = createWriteQuery(
  'addGroupInvites',
  async (invites: { groupId: string; contactIds: string[] }) => {
    return client
      .insert($groupMemberInvites)
      .values(
        invites.contactIds.map((contactId) => ({
          groupId: invites.groupId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupMemberInvites']
);

export const getGroupInvites = createReadQuery(
  'getGroupInvites',
  async (groupId: string) => {
    return client.query.groupMemberInvites.findMany({
      where: eq($groupMemberInvites.groupId, groupId),
    });
  },
  ['groupMemberInvites']
);

export const deleteGroupInvites = createWriteQuery(
  'deleteGroupInvites',
  async (invites: { groupId: string; contactIds: string[] }) => {
    return client
      .delete($groupMemberInvites)
      .where(
        and(
          eq($groupMemberInvites.groupId, invites.groupId),
          inArray($groupMemberInvites.contactId, invites.contactIds)
        )
      );
  },
  ['groupMemberInvites']
);

export const addGroupMemberBans = createWriteQuery(
  'addGroupMemberBans',
  async (bans: { groupId: string; contactIds: string[] }) => {
    return client
      .insert($groupMemberBans)
      .values(
        bans.contactIds.map((contactId) => ({
          groupId: bans.groupId,
          contactId,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupMemberBans']
);

export const getGroupMemberBans = createReadQuery(
  'getGroupMemberBans',
  async (groupId: string) => {
    return client.query.groupMemberBans.findMany({
      where: eq($groupMemberBans.groupId, groupId),
    });
  },
  ['groupMemberBans']
);

export const deleteGroupMemberBans = createWriteQuery(
  'deleteGroupMemberBans',
  async (bans: { groupId: string; contactIds: string[] }) => {
    return client
      .delete($groupMemberBans)
      .where(
        and(
          eq($groupMemberBans.groupId, bans.groupId),
          inArray($groupMemberBans.contactId, bans.contactIds)
        )
      );
  },
  ['groupMemberBans']
);

export const addGroupRankBans = createWriteQuery(
  'addGroupRankBans',
  async (bans: { groupId: string; ranks: Rank[] }) => {
    return client
      .insert($groupRankBans)
      .values(
        bans.ranks.map((rank) => ({
          groupId: bans.groupId,
          rankId: rank,
        }))
      )
      .onConflictDoNothing();
  },
  ['groupRankBans']
);

export const getGroupRankBans = createReadQuery(
  'getGroupRankBans',
  async (groupId: string) => {
    return client.query.groupRankBans.findMany({
      where: eq($groupRankBans.groupId, groupId),
    });
  },
  ['groupRankBans']
);

export const deleteGroupRankBans = createWriteQuery(
  'deleteGroupRankBans',
  async (bans: { groupId: string; ranks: Rank[] }) => {
    return client
      .delete($groupRankBans)
      .where(
        and(
          eq($groupRankBans.groupId, bans.groupId),
          inArray($groupRankBans.rankId, bans.ranks)
        )
      );
  },
  ['groupRankBans']
);

export const addRole = createWriteQuery(
  'addRole',
  async (role: GroupRole) => {
    return client
      .insert($groupRoles)
      .values(role)
      .onConflictDoUpdate({
        target: $groupRoles.id,
        set: conflictUpdateSetAll($groupRoles),
      });
  },
  ['groupRoles']
);

export const deleteRole = createWriteQuery(
  'deleteRole',
  async (roleId: string, groupId: string) => {
    return client
      .delete($groupRoles)
      .where(and(eq($groupRoles.id, roleId), eq($groupRoles.groupId, groupId)));
  },
  ['groupRoles']
);

export const updateRole = createWriteQuery(
  'updateRole',
  async (role: Partial<GroupRole> & { id: string; groupId: string }) => {
    return client
      .update($groupRoles)
      .set(role)
      .where(
        and(eq($groupRoles.groupId, role.groupId), eq($groupRoles.id, role.id))
      );
  },
  ['groupRoles']
);

export const addChatMembersToRoles = createWriteQuery(
  'addChatMembersToRoles',
  async ({
    groupId,
    contactIds,
    roleIds,
  }: {
    groupId: string;
    contactIds: string[];
    roleIds: string[];
  }) => {
    return client.insert($chatMemberGroupRoles).values(
      contactIds.flatMap((contactId) =>
        roleIds.map((roleId) => ({
          groupId,
          contactId,
          roleId,
        }))
      )
    );
  },
  ['chatMembers', 'chatMemberGroupRoles']
);

export const removeChatMembersFromRoles = createWriteQuery(
  'removeChatMembersFromRoles',
  async ({
    groupId,
    contactIds,
    roleIds,
  }: {
    groupId: string;
    contactIds: string[];
    roleIds: string[];
  }) => {
    return client
      .delete($chatMemberGroupRoles)
      .where(
        and(
          eq($chatMemberGroupRoles.groupId, groupId),
          inArray($chatMemberGroupRoles.contactId, contactIds),
          inArray($chatMemberGroupRoles.roleId, roleIds)
        )
      );
  },
  ['chatMemberGroupRoles']
);

export const removeChatMembers = createWriteQuery(
  'removeChatMembers',
  async ({ chatId, contactIds }: { chatId: string; contactIds: string[] }) => {
    return client
      .delete($chatMembers)
      .where(
        and(
          eq($chatMembers.chatId, chatId),
          inArray($chatMembers.contactId, contactIds)
        )
      );
  },
  ['chatMembers']
);

export const getUnreadsCount = createReadQuery(
  'getUnreadsCount',
  async ({ type }: { type?: Unread['type'] } = {}) => {
    const result = await client
      .select({ count: count() })
      .from($unreads)
      .where(() =>
        and(gt($unreads.count, 0), type ? eq($unreads.type, type) : undefined)
      );
    return result[0]?.count ?? 0;
  },
  ['unreads']
);

export interface GetUnreadsOptions {
  orderBy?: 'updatedAt';
  includeFullyRead?: boolean;
  type?: Unread['type'];
}

export const getUnreads = createReadQuery(
  'getUnreads',
  async ({
    orderBy = 'updatedAt',
    includeFullyRead = true,
    type,
  }: GetUnreadsOptions = {}) => {
    return client.query.unreads.findMany({
      where: and(
        type ? eq($unreads.type, type) : undefined,
        includeFullyRead ? undefined : gt($unreads.count, 0)
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

export const getChannelUnread = createReadQuery(
  'getChannelUnread',
  async ({ channelId }: { channelId: string }) => {
    return client.query.unreads.findFirst({
      where: and(eq($unreads.channelId, channelId)),
    });
  },
  ['unreads']
);

export const getThreadActivity = createReadQuery(
  'getThreadActivity',
  async ({ channelId, postId }: { channelId: string; postId: string }) => {
    return client.query.threadUnreads.findFirst({
      where: and(
        eq($threadUnreads.channelId, channelId),
        eq($threadUnreads.threadId, postId)
      ),
    });
  },
  ['unreads', 'threadUnreads']
);

export const getChannel = createReadQuery(
  'getChannel',
  async ({ id, includeMembers }: { id: string; includeMembers?: boolean }) => {
    return client.query.channels
      .findFirst({
        where: eq($channels.id, id),
        with: {
          ...(includeMembers ? { members: { with: { contact: true } } } : {}),
        },
      })
      .then(returnNullIfUndefined);
  },
  ['channels']
);

export const getAllMultiDms = createReadQuery(
  'getAllMultiDms',
  async () => {
    return client.query.channels.findMany({
      where: eq($channels.type, 'groupDm'),
      with: {
        members: true,
      },
    });
  },
  []
);

export const getAllSingleDms = createReadQuery(
  'getAllSingleDms',
  async () => {
    return client.query.channels.findMany({
      where: eq($channels.type, 'dm'),
      with: {
        members: true,
      },
    });
  },
  []
);

export interface GetChannelWithLastPostAndMembersOptions {
  id: string;
}

export const getChannelWithLastPostAndMembers = createReadQuery(
  'getChannelWithLastPostAndMembers',
  async ({
    id,
  }: GetChannelWithLastPostAndMembersOptions): Promise<Channel | undefined> => {
    return await client.query.channels.findFirst({
      where: eq($channels.id, id),
      with: {
        lastPost: true,
        members: {
          with: {
            contact: true,
          },
        },
        unread: true,
        writerRoles: {
          with: {
            role: true,
          },
        },
      },
    });
  },
  ['channels']
);

export const getStaleChannels = createReadQuery(
  'getStaleChannels',
  async () => {
    return client
      .select({
        ...getTableColumns($channels),
        unread: getTableColumns($unreads),
      })
      .from($channels)
      .innerJoin($unreads, eq($unreads.channelId, $channels.id))
      .where(
        or(
          isNull($channels.lastPostAt),
          lt($channels.remoteUpdatedAt, $unreads.updatedAt)
        )
      )
      .leftJoin(
        $pins,
        or(eq($pins.itemId, $channels.id), eq($pins.itemId, $channels.groupId))
      )
      .orderBy(ascNullsLast($pins.index), desc($unreads.updatedAt));
  },
  ['channels']
);

export const insertChannels = createWriteQuery(
  'insertChannels',
  async (channels: Channel[]) => {
    if (channels.length === 0) {
      return;
    }

    logger.log(
      'insertChannels',
      channels.length,
      channels.map((c) => c.id)
    );

    return client.transaction(async (tx) => {
      await tx
        .insert($channels)
        .values(channels)
        .onConflictDoUpdate({
          target: $channels.id,
          set: conflictUpdateSetAll($channels),
        });

      for (const channel of channels) {
        if (channel.members && channel.members.length > 0) {
          await tx
            .delete($chatMembers)
            .where(eq($chatMembers.chatId, channel.id));
          await tx
            .insert($chatMembers)
            .values(channel.members)
            .onConflictDoNothing();
        }
      }
      await setLastPosts(tx);
    });
  },
  ['channels']
);

export const updateChannel = createWriteQuery(
  'updateChannel',
  (update: Partial<Channel> & { id: string }) => {
    logger.log('updateChannel', update.id, update);
    return client
      .update($channels)
      .set(update)
      .where(eq($channels.id, update.id));
  },
  ['channels']
);

export const deleteChannel = createWriteQuery(
  'deleteChannel',
  async (channelId: string) => {
    logger.log(`deleteChannel`, channelId);
    await client.delete($posts).where(eq($posts.channelId, channelId));
    await client.delete($chatMembers).where(eq($chatMembers.chatId, channelId));
    await client.delete($channels).where(eq($channels.id, channelId));
    return;
  },
  ['channels']
);

export const addNavSectionToGroup = createWriteQuery(
  'addNavSectionToGroup',
  async ({
    id,
    groupId,
    meta,
  }: {
    id: string;
    groupId: string;
    meta: ClientMeta;
  }) => {
    return client
      .insert($groupNavSections)
      .values({
        id,
        title: meta.title,
        description: meta.description,
        iconImage: meta.iconImage,
        coverImage: meta.coverImage,
        iconImageColor: meta.iconImageColor,
        coverImageColor: meta.coverImageColor,
        groupId,
      })
      .onConflictDoUpdate({
        target: $groupNavSections.id,
        set: conflictUpdateSetAll($groupNavSections),
      });
  },
  ['groupNavSections']
);

export const updateNavSection = createWriteQuery(
  'updateNavSection',
  async (navSection: Partial<GroupNavSection> & { id: string }) => {
    return client
      .update($groupNavSections)
      .set(navSection)
      .where(eq($groupNavSections.id, navSection.id));
  },
  ['groupNavSections']
);

export const deleteNavSection = createWriteQuery(
  'deleteNavSection',
  async (navSectionId: string) => {
    return client
      .delete($groupNavSections)
      .where(eq($groupNavSections.id, navSectionId));
  },
  ['groupNavSections']
);

export const addChannelToNavSection = createWriteQuery(
  'addChannelToNavSection',
  async ({
    channelId,
    groupNavSectionId,
    index,
  }: {
    channelId: string;
    groupNavSectionId: string;
    index: number;
  }) => {
    return client
      .insert($groupNavSectionChannels)
      .values({
        channelId,
        groupNavSectionId,
        index,
      })
      .onConflictDoNothing();
  },
  ['groupNavSectionChannels']
);

export const deleteChannelFromNavSection = createWriteQuery(
  'deleteChannelFromNavSection',
  async ({
    channelId,
    groupNavSectionId,
  }: {
    channelId: string;
    groupNavSectionId: string;
  }) => {
    return client
      .delete($groupNavSectionChannels)
      .where(
        and(
          eq($groupNavSectionChannels.channelId, channelId),
          eq($groupNavSectionChannels.groupNavSectionId, groupNavSectionId)
        )
      );
  },
  ['groupNavSectionChannels']
);

export const getChannelNavSection = createReadQuery(
  'getChannelNavSection',
  async ({ channelId }: { channelId: string }) => {
    return client.query.groupNavSectionChannels
      .findFirst({
        where: eq($groupNavSectionChannels.channelId, channelId),
        with: {
          groupNavSection: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['groupNavSectionChannels']
);

export const setJoinedGroupChannels = createWriteQuery(
  'setJoinedGroupChannels',
  async ({ channelIds }: { channelIds: string[] }) => {
    if (channelIds.length === 0) return;
    return await client
      .update($channels)
      .set({
        currentUserIsMember: channelIds.length
          ? inArray($channels.id, channelIds)
          : false,
      })
      .where(isNotNull($channels.groupId));
  },
  ['channels']
);

export const setLeftGroupChannels = createWriteQuery(
  'setLeftGroupChannels',
  async ({ channelIds }: { channelIds: string[] }) => {
    return await client
      .update($channels)
      .set({
        currentUserIsMember: not(inArray($channels.id, channelIds)),
      })
      .where(isNotNull($channels.groupId));
  },
  ['channels']
);

export type GetChannelPostsOptions = {
  channelId: string;
  count?: number;
} & (
  | {
      mode: 'newest';
      cursor?: never;
    }
  | {
      mode: 'older' | 'newer' | 'around';
      cursor: string;
    }
);

export const getChannelPosts = createReadQuery(
  'getChannelPosts',
  async ({
    channelId,
    cursor,
    mode,
    count = 50,
  }: GetChannelPostsOptions): Promise<Post[]> => {
    // Find the window (set of contiguous posts) that this cursor belongs to.
    // These are the posts that we can return safely without gaps and without hitting the api.
    const window = await client.query.postWindows.findFirst({
      where: and(
        // For this channel
        eq($postWindows.channelId, channelId),
        // Depending on mode, either older or newer than cursor. If mode is
        // `newest`, we don't need to filter by cursor.
        cursor ? gte($postWindows.newestPostId, cursor) : undefined,
        cursor ? lte($postWindows.oldestPostId, cursor) : undefined
      ),
      orderBy: [desc($postWindows.newestPostId)],
      columns: {
        oldestPostId: true,
        newestPostId: true,
      },
    });
    // If the cursor isn't part of any window, we return an empty array.
    if (!window) {
      return [];
    }

    const relationConfig = {
      author: true,
      reactions: true,
      threadUnread: true,
    } as const;

    if (mode === 'newer' || mode === 'newest' || mode === 'older') {
      // Simple case: just grab a set of posts from either side of the cursor.
      const posts = await client.query.posts.findMany({
        where: and(
          // From this channel
          eq($posts.channelId, channelId),
          // Not a reply
          not(eq($posts.type, 'reply')),
          // In the target window
          gte($posts.id, window.oldestPostId),
          lte($posts.id, window.newestPostId),
          // Depending on mode, either older or newer than cursor. If mode is
          // `newest`, we don't need to filter by cursor.
          mode === 'older' ? lt($posts.id, cursor) : undefined,
          mode === 'newer' ? gt($posts.id, cursor) : undefined
        ),
        with: relationConfig,
        // If newer, we have to ensure that these are the newer posts directly following the cursor
        orderBy: [mode === 'newer' ? asc($posts.id) : desc($posts.id)],
        limit: count,
      });
      // We always want to return posts newest-first
      if (mode === 'newer') {
        posts.reverse();
      }
      return posts;
    } else if (mode === 'around') {
      // It's a bit more complicated to get posts around a cursor. Basic process is:
      // - Start with a query for all posts in the window, selecting
      //   row_number() to track their position within the window.
      // - Find the row number of the cursor post within this window.
      // - Find min row and max row by offsetting the cursor row by half the
      //   count in each direction.
      // - Grab post ids from the window query where row number is between min and max.

      // Get all posts in the window
      const $windowQuery = client
        .select({
          id: $posts.id,
          rowNumber: sql`row_number() OVER (ORDER BY ${$posts.id})`
            .mapWith(Number)
            .as('rowNumber'),
        })
        .from($posts)
        .where(
          and(
            eq($posts.channelId, channelId),
            gte($posts.id, window.oldestPostId),
            lte($posts.id, window.newestPostId)
          )
        )
        .as('posts');

      // Get the row number of the cursor post
      const cursorRow = await client
        .select({
          id: $windowQuery.id,
          rowNumber: $windowQuery.rowNumber,
        })
        .from($windowQuery)
        .where(eq($windowQuery.id, cursor));

      // Calculate min and max rows
      const itemsBefore = Math.floor((count - 1) / 2);
      const itemsAfter = Math.ceil((count - 1) / 2);
      const startRow = cursorRow[0].rowNumber - itemsBefore;
      const endRow = cursorRow[0].rowNumber + itemsAfter;

      // Actually grab posts
      return await client.query.posts.findMany({
        where: inArray(
          $posts.id,
          client
            .select({
              id: $windowQuery.id,
            })
            .from($windowQuery)
            .where(
              and(
                gte($windowQuery.rowNumber, startRow),
                lte($windowQuery.rowNumber, endRow)
              )
            )
        ),
        with: relationConfig,
        orderBy: [desc($posts.id)],
        limit: count,
      });
    } else {
      throw new Error('invalid mode');
    }
  },
  ['posts', 'unreads', 'threadUnreads']
);

export interface GetChannelPostsAroundOptions {
  channelId: string;
  postId: string;
}

export const getChannelPostsAround = createReadQuery(
  'getChannelPosts',
  async ({ channelId, postId }: { channelId: string; postId: string }) => {
    if (!postId) return [];

    // Get desired post
    const referencePost = await client.query.posts.findFirst({
      where: eq($posts.id, postId),
      with: {
        author: true,
        reactions: true,
      },
    });

    if (!referencePost) {
      throw new Error('Reference post not found');
    }

    const sentAt = referencePost.sentAt;

    // Get before posts
    const beforePosts = await client.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), lt($posts.sentAt, sentAt!)),
      orderBy: [desc($posts.receivedAt)],
      limit: 25,
      with: {
        author: true,
        reactions: true,
      },
    });

    // Get after posts
    const afterPosts = await client.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), gt($posts.sentAt, sentAt!)),
      orderBy: [asc($posts.receivedAt)],
      limit: 25,
      with: {
        author: true,
        reactions: true,
      },
    });

    // Return all posts in order
    return [...beforePosts.reverse(), referencePost, ...afterPosts];
  },
  ['posts', 'channels']
);

export const getChannelSearchResults = createReadQuery(
  'getChannelSearchResults',
  async (channelId: string, postIds: string[]) => {
    if (postIds.length === 0) return [];
    return client.query.posts.findMany({
      where: and(eq($posts.channelId, channelId), inArray($posts.id, postIds)),
      orderBy: [desc($posts.receivedAt)],
      with: {
        author: true,
        reactions: true,
      },
    });
  },
  []
);

export const insertChannelPosts = createWriteQuery(
  'insertChannelPosts',
  async ({
    channelId,
    posts,
    newer,
    older,
  }: {
    channelId: string;
    posts: Post[];
    newer?: string | null;
    older?: string | null;
  }) => {
    if (!posts.length) {
      return;
    }
    return client.transaction(async (tx) => {
      await insertPosts(posts, tx);
      // If these are non-reply posts, update group + channel last post as well as post windows.
      const topLevelPosts = posts.filter((p) => p.type !== 'reply');
      if (topLevelPosts.length) {
        await updatePostWindows(
          {
            channelId,
            newPosts: topLevelPosts,
            newer,
            older,
          },
          tx
        );
      }
    });
  },
  ['posts', 'channels', 'groups', 'postWindows']
);

export const insertStandalonePosts = createWriteQuery(
  'insertStandalonePosts',
  async (posts: Post[]) => {
    return client.transaction(async (tx) => {
      await insertPosts(posts, tx);
      for (const post of posts) {
        await updatePostWindows(
          {
            channelId: post.channelId,
            newPosts: [post],
          },
          tx
        );
      }
    });
  },
  ['posts']
);

async function insertPosts(
  posts: Post[],
  tx: AnySqliteTransaction | AnySqliteDatabase
) {
  await tx
    .insert($posts)
    .values(posts.map((p) => ({ ...p })))
    .onConflictDoUpdate({
      target: $posts.id,
      set: conflictUpdateSetAll($posts),
    })
    .onConflictDoUpdate({
      target: [$posts.authorId, $posts.sentAt],
      set: conflictUpdateSetAll($posts),
    });
  await setPostGroups(tx);
  await setLastPosts(tx);
  await clearMatchedPendingPosts(
    posts.filter((p) => p.deliveryStatus !== 'pending'),
    tx
  );
}

function setPostGroups(tx: AnySqliteTransaction | AnySqliteDatabase = client) {
  return tx
    .update($posts)
    .set({
      groupId: sql`${tx
        .select({ groupId: $channels.groupId })
        .from($channels)
        .where(eq($channels.id, $posts.channelId))}`,
    })
    .where(isNull($posts.groupId));
}

async function setLastPosts(
  tx: AnySqliteTransaction | AnySqliteDatabase = client
) {
  const $lastPost = tx
    .$with('lastPost')
    .as(
      tx
        .select({ id: $posts.id, receivedAt: $posts.receivedAt })
        .from($posts)
        .where(eq($posts.channelId, $channels.id))
        .orderBy(desc($posts.receivedAt))
        .limit(1)
    );

  await tx
    .with($lastPost)
    .update($channels)
    .set({
      lastPostId: sql`(select ${$lastPost.id} from ${$lastPost})`,
      lastPostAt: sql`(select ${$lastPost.receivedAt} from ${$lastPost})`,
    });

  const $groupLastPost = tx.$with('groupLastPost').as(
    tx
      .select({
        groupId: $channels.groupId,
        lastPostId: max($channels.lastPostId).as('lastPostId'),
        lastPostAt: max($channels.lastPostAt).as('lastPostAt'),
      })
      .from($channels)
      .where(eq($channels.groupId, $groups.id))
      .orderBy(desc($channels.lastPostAt))
      .groupBy($channels.groupId)
      .limit(1)
  );

  await tx
    .with($groupLastPost)
    .update($groups)
    .set({
      lastPostId: sql`(select ${$groupLastPost.lastPostId} from ${$groupLastPost})`,
      lastPostAt: sql`(select ${$groupLastPost.lastPostAt} from ${$groupLastPost})`,
    });
}

// Delete any pending posts whose sentAt matches the incoming sentAt.
// We do this manually as pending post ids do not correspond to server-side post ids.
async function clearMatchedPendingPosts(
  posts: Post[],
  tx: AnySqliteTransaction | AnySqliteDatabase = client
) {
  const deliveredPosts = posts.filter((p) => p.deliveryStatus !== 'pending');
  if (!deliveredPosts.length) {
    return;
  }
  return await tx
    .delete($posts)
    .where(
      and(
        eq($posts.deliveryStatus, 'pending'),
        inArray(
          $posts.sentAt,
          deliveredPosts.map((p) => p.sentAt)
        )
      )
    )
    .returning({ id: $posts.id });
}

async function updatePostWindows(
  {
    channelId,
    newPosts,
    newer,
    older,
  }: {
    channelId: string;
    newPosts: Post[];
    newer?: string | null;
    older?: string | null;
  },
  tx: AnySqliteDatabase | AnySqliteTransaction
) {
  // Create candidate window based on input
  const window = {
    channelId,
    newestPostId: newPosts[newPosts.length - 1].id,
    oldestPostId: newPosts[0].id,
  };

  const referenceWindow = {
    channelId,
    newestPostId: newer || window.newestPostId,
    oldestPostId: older || window.oldestPostId,
  };

  // Calculate min and max post id of windows that overlap with this one
  const { oldestId, newestId } = (
    await tx
      .select({
        oldestId: min($postWindows.oldestPostId),
        newestId: max($postWindows.newestPostId),
      })
      .from($postWindows)
      .where(overlapsWindow(referenceWindow))
  )[0];

  // Delete intersecting windows.
  await tx.delete($postWindows).where(overlapsWindow(referenceWindow));

  // Calculate final range of merged windows by intersecting existing min and
  // max with candidate window.
  const resolvedStart =
    oldestId && oldestId < window.oldestPostId ? oldestId : window.oldestPostId;
  const resolvedEnd =
    newestId && newestId > window.newestPostId ? newestId : window.newestPostId;

  const finalWindow = {
    channelId: window.channelId,
    oldestPostId: resolvedStart,
    newestPostId: resolvedEnd,
  };

  // Insert final window.
  await tx.insert($postWindows).values(finalWindow);
}

function overlapsWindow(window: PostWindow) {
  return and(
    eq($postWindows.channelId, window.channelId),
    lte($postWindows.oldestPostId, window.newestPostId),
    gte($postWindows.newestPostId, window.oldestPostId)
  );
}

export const updatePost = createWriteQuery(
  'updateChannelPost',
  async (post: Partial<Post> & { id: string }) => {
    return client.update($posts).set(post).where(eq($posts.id, post.id));
  },
  ['posts']
);

export const deletePost = createWriteQuery(
  'deleteChannelPost',
  async (postId: string) => {
    return client.delete($posts).where(eq($posts.id, postId));
  },
  ['posts']
);

export const getPostReaction = createReadQuery(
  'getPostReaction',
  async ({ postId, contactId }: { postId: string; contactId: string }) => {
    return client.query.postReactions
      .findFirst({
        where: and(
          eq($postReactions.postId, postId),
          eq($postReactions.contactId, contactId)
        ),
      })
      .then(returnNullIfUndefined);
  },
  []
);

export const insertPostReactions = createWriteQuery(
  'insertPostReactions',
  async ({ reactions }: { reactions: Reaction[] }) => {
    return client
      .insert($postReactions)
      .values(reactions)
      .onConflictDoUpdate({
        target: [$postReactions.postId, $postReactions.contactId],
        set: conflictUpdateSetAll($postReactions),
      });
  },
  ['posts', 'postReactions', 'contacts']
);

export const replacePostReactions = createWriteQuery(
  'setPostReactions',
  async ({ postId, reactions }: { postId: string; reactions: Reaction[] }) => {
    return client.transaction(async (tx) => {
      await tx.delete($postReactions).where(eq($postReactions.postId, postId));
      if (reactions.length === 0) return;
      await tx.insert($postReactions).values(reactions);
    });
  },
  ['posts', 'postReactions']
);

export const deletePostReaction = createWriteQuery(
  'deletePostReaction',
  async ({ postId, contactId }: { postId: string; contactId: string }) => {
    return client
      .delete($postReactions)
      .where(
        and(
          eq($postReactions.postId, postId),
          eq($postReactions.contactId, contactId)
        )
      );
  },
  ['postReactions']
);

export const deletePosts = createWriteQuery(
  'deletePosts',
  async ({ ids }: { ids: string[] }) => {
    return client.delete($posts).where(inArray($posts.id, ids));
  },
  ['posts']
);

export const getPosts = createReadQuery(
  'getPosts',
  () => {
    return client.select().from($posts);
  },
  ['posts']
);

export const getPost = createReadQuery(
  'getPost',
  async ({ postId }) => {
    const postData = await client
      .select()
      .from($posts)
      .where(eq($posts.id, postId));
    if (!postData.length) return null;
    return postData[0];
  },
  ['posts']
);

export const getPostByCacheId = createReadQuery(
  'getPostByCacheId',
  async ({ sentAt, authorId }: { sentAt: number; authorId: string }) => {
    const postData = await client
      .select()
      .from($posts)
      .where(and(eq($posts.sentAt, sentAt), eq($posts.authorId, authorId)));
    if (!postData.length) return null;
    return postData[0];
  },
  ['posts']
);

export const addReplyToPost = createWriteQuery(
  'addReplyToPost',
  ({
    parentId,
    replyAuthor,
    replyTime,
  }: {
    parentId: string;
    replyAuthor: string;
    replyTime: number;
  }) => {
    return client.transaction(async (tx) => {
      const parentData = await tx
        .select()
        .from($posts)
        .where(eq($posts.id, parentId));
      if (parentData.length) {
        const parentPost = parentData[0];
        const newReplyContacts = appendContactIdToReplies(
          parentPost.replyContactIds ?? [],
          replyAuthor
        );
        await tx
          .update($posts)
          .set({
            replyCount: (parentPost.replyCount ?? 0) + 1,
            replyTime,
            replyContactIds: newReplyContacts,
          })
          .where(eq($posts.id, parentId));
      }
    });
  },
  ['posts']
);

export const getPendingPosts = createReadQuery(
  'getPendingPosts',
  (channelId: string) => {
    return client.query.posts.findMany({
      where: and(
        eq($posts.channelId, channelId),
        isNotNull($posts.deliveryStatus)
      ),
    });
  },
  []
);

export const getPostWithRelations = createReadQuery(
  'getPostWithRelations',
  async ({ id }: { id: string }) => {
    return client.query.posts
      .findFirst({
        where: eq($posts.id, id),
        with: {
          author: true,
          reactions: true,
          threadUnread: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['posts', 'threadUnreads']
);

export const getGroup = createReadQuery(
  'getGroup',
  async ({ id }: { id: string }) => {
    return client.query.groups
      .findFirst({
        where: (groups, { eq }) => eq(groups.id, id),
        with: {
          channels: {
            where: (channels, { eq }) => eq(channels.currentUserIsMember, true),
            with: {
              lastPost: true,
              unread: true,
            },
          },
          roles: true,
          members: {
            with: {
              contact: true,
            },
          },
          navSections: {
            with: {
              channels: true,
            },
          },
        },
      })
      .then(returnNullIfUndefined);
  },
  ['groups', 'unreads']
);

export const getGroupByChannel = createReadQuery(
  'getGroupByChannel',
  async (channelId: string) => {
    const channel = await client.query.channels.findFirst({
      where: (channels, { eq }) => eq(channels.id, channelId),
    });

    if (!channel || !channel.groupId) return null;

    return client.query.groups
      .findFirst({
        where: (groups, { eq }) => eq(groups.id, channel.groupId!),
        with: {
          channels: true,
          roles: true,
          members: true,
        },
      })
      .then(returnNullIfUndefined);
  },
  ['channels', 'groups']
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

export const getContactsBatch = createReadQuery(
  'getContactsBatch',
  async ({ contactIds }: { contactIds: string[] }) => {
    return client.query.contacts.findMany({
      where: (contacts, { inArray }) => inArray(contacts.id, contactIds),
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
  async ({ id }: { id: string }) => {
    return client.query.contacts
      .findFirst({
        where: (contacts, { eq }) => eq(contacts.id, id),
      })
      .then(returnNullIfUndefined);
  },
  ['contacts']
);

export const updateContact = createWriteQuery(
  'updateContact',
  async (contact: Partial<Contact> & { id: string }) => {
    return client
      .update($contacts)
      .set(contact)
      .where(eq($contacts.id, contact.id));
  },
  ['contacts']
);

export const insertContact = createWriteQuery(
  'insertContact',
  async (contact: Contact) => {
    return client
      .insert($contacts)
      .values(contact)
      .onConflictDoUpdate({
        target: $contacts.id,
        set: conflictUpdateSetAll($contacts),
      });
  },
  ['contacts']
);

export const insertContacts = createWriteQuery(
  'insertContacts',
  async (contactsData: Contact[]) => {
    if (contactsData.length === 0) {
      return;
    }

    const contactGroups = contactsData.flatMap(
      (contact) => contact.pinnedGroups || []
    );

    const targetGroups = contactGroups.map(
      (g): Group => ({
        id: g.groupId,
        privacy: g.group?.privacy,
        currentUserIsMember: false,
      })
    );

    await client
      .insert($contacts)
      .values(contactsData)
      .onConflictDoUpdate({
        target: $contacts.id,
        set: conflictUpdateSetAll($contacts),
      });

    if (contactGroups.length === 0) {
      return;
    }

    if (targetGroups.length) {
      await client.insert($groups).values(targetGroups).onConflictDoNothing();
    }
    // TODO: Remove stale pinned groups
    await client
      .insert($contactGroups)
      .values(contactGroups)
      .onConflictDoNothing();
  },
  ['contacts', 'groups', 'contactGroups']
);

export const deleteContact = createWriteQuery(
  'deleteContact',
  async (contactId: string) => {
    return client.delete($contacts).where(eq($contacts.id, contactId));
  },
  ['contacts']
);

export const insertUnreads = createWriteQuery(
  'insertUnreads',
  async (unreads: Unread[]) => {
    if (!unreads.length) return;
    return client.transaction(async (tx) => {
      await tx
        .insert($unreads)
        .values(unreads)
        .onConflictDoUpdate({
          target: [$unreads.channelId],
          set: conflictUpdateSetAll($unreads),
        });
      const threadUnreads = unreads.flatMap((u) => {
        return u.threadUnreads ?? [];
      });
      if (threadUnreads.length) {
        await tx
          .insert($threadUnreads)
          .values(threadUnreads)
          .onConflictDoUpdate({
            target: [$threadUnreads.threadId, $threadUnreads.channelId],
            set: conflictUpdateSetAll($unreads),
          });
      }
    });
  },
  ['unreads']
);

export const clearChannelUnread = createWriteQuery(
  'clearChannelUnread',
  async (channelId: string) => {
    return client
      .update($unreads)
      .set({ countWithoutThreads: 0, firstUnreadPostId: null })
      .where(eq($unreads.channelId, channelId));
  },
  ['unreads']
);

export const insertThreadActivity = createWriteQuery(
  'insertThreadActivity',
  async (threadActivity: ThreadUnreadState[]) => {
    if (!threadActivity.length) return;
    return client
      .insert($threadUnreads)
      .values(threadActivity)
      .onConflictDoUpdate({
        target: [$threadUnreads.threadId, $threadUnreads.channelId],
        set: conflictUpdateSetAll($threadUnreads),
      });
  },
  ['threadUnreads', 'unreads']
);

export const clearThreadUnread = createWriteQuery(
  'clearThreadUnread',
  async ({ channelId, threadId }: { channelId: string; threadId: string }) => {
    return client
      .update($threadUnreads)
      .set({ count: 0, firstUnreadPostId: null })
      .where(
        and(
          eq($threadUnreads.channelId, channelId),
          eq($threadUnreads.threadId, threadId)
        )
      );
  },
  ['threadUnreads']
);

export const insertPinnedItems = createWriteQuery(
  'insertPinnedItems',
  async (pinnedItems: Pin[]) => {
    return client.transaction(async (tx) => {
      await tx.delete($pins);
      // users may not have pinned items
      if (!pinnedItems.length) return;
      await tx.insert($pins).values(pinnedItems);
    });
  },
  ['pins', 'groups']
);

export const insertPinnedItem = createWriteQuery(
  'insertPinnedItem',
  async ({
    itemId,
    type,
    index,
  }: {
    itemId: string;
    type: PinType;
    index?: number;
  }) => {
    return client.transaction(async (tx) => {
      const maxResult = await tx
        .select({ value: max($pins.index) })
        .from($pins);
      const maxIndex = maxResult[0]?.value ?? 0;
      await tx
        .insert($pins)
        .values({ itemId, type, index: index ?? maxIndex + 1 });
    });
  },
  ['pins', 'groups', 'channels']
);

export const deletePinnedItem = createWriteQuery(
  'deletePinnedItem',
  async ({ itemId }: { itemId: string }) => {
    return client.delete($pins).where(eq($pins.itemId, itemId));
  },
  ['pins', 'groups', 'channels']
);

export const getPinnedItems = createReadQuery(
  'getPinnedItems',
  async () => {
    return client.query.pins.findMany({});
  },
  ['pins']
);

// Helpers

function allQueryColumns<T extends Subquery>(
  subquery: T
): T['_']['selectedFields'] {
  return subquery._.selectedFields;
}

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

function returnNullIfUndefined<T>(input: T | undefined): T | null {
  return input ?? null;
}
