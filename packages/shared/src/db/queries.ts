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
import { shortPostId } from '../debug';
import { appendContactIdToReplies } from '../logic';
import { desig } from '../urbit';
import { AnySqliteDatabase, AnySqliteTransaction, client } from './client';
import { createReadQuery, createWriteQuery } from './query';
import {
  channelWriters as $channelWriters,
  channels as $channels,
  chatMemberGroupRoles as $chatMemberGroupRoles,
  chatMembers as $chatMembers,
  contactGroups as $contactGroups,
  contacts as $contacts,
  groupNavSectionChannels as $groupNavSectionChannels,
  groupNavSections as $groupNavSections,
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
  Contact,
  Group,
  Pin,
  PinType,
  Post,
  Reaction,
  Settings,
  TableName,
  Unread,
} from './types';

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
      .where(includeUnjoined ? undefined : eq($groups.isJoined, true));
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
      .where(isNull($channels.groupId))
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
      .orderBy(ascNullsLast($pins.index), desc($unreads.updatedAt));
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
  ['groups', 'channels']
);

export const insertGroups = createWriteQuery(
  'insertGroups',
  async (groupData: Group[]) => {
    await client.transaction(async (tx) => {
      for (const group of groupData) {
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
                $channels.type
              ),
            });
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

export const insertChannelPerms = createWriteQuery(
  'insertChannelPerms',
  (channelsInit: ChannelInit[]) => {
    const writers = channelsInit.flatMap((chanInit) =>
      chanInit.writers.map((writer) => ({
        channelId: chanInit.channelId,
        roleId: writer,
      }))
    );
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

export const getUnreadsCount = createReadQuery(
  'getUnreadsCount',
  async ({ type }: { type?: Unread['type'] }) => {
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

    return client.transaction(async (tx) => {
      await tx
        .insert($channels)
        .values(channels)
        .onConflictDoUpdate({
          target: $channels.id,
          set: conflictUpdateSetAll($posts),
        });

      for (const channel of channels) {
        if (channel.members && channel.members.length > 0) {
          await tx
            .delete($chatMembers)
            .where(eq($chatMembers.chatId, channel.id));
          await tx.insert($chatMembers).values(channel.members);
        }
      }
    });
  },
  ['channels']
);

export const updateChannel = createWriteQuery(
  'updateChannel',
  (update: Partial<Channel> & { id: string }) => {
    return client
      .update($channels)
      .set(update)
      .where(eq($channels.id, update.id));
  },
  ['channels']
);

export const setJoinedGroupChannels = createWriteQuery(
  'setJoinedGroupChannels',
  async ({ channelIds }: { channelIds: string[] }) => {
    return await client
      .update($channels)
      .set({
        currentUserIsMember: inArray($channels.id, channelIds),
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
      cursor?: undefined;
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
    });
    if (!window) {
      return [];
    }
    if (mode === 'around') {
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

      const cursorRow = await client
        .select({
          id: $windowQuery.id,
          rowNumber: $windowQuery.rowNumber,
        })
        .from($windowQuery)
        .where(eq($windowQuery.id, cursor));

      const itemsBefore = Math.floor((count - 1) / 2);
      const itemsAfter = Math.ceil((count - 1) / 2);
      const startRow = cursorRow[0].rowNumber - itemsBefore;
      const endRow = cursorRow[0].rowNumber + itemsAfter;

      const $aroundQuery = await client
        .select({
          id: $windowQuery.id,
          rowNumber: $windowQuery.rowNumber,
        })
        .from($windowQuery)
        .where(
          and(
            gte($windowQuery.rowNumber, startRow),
            lte($windowQuery.rowNumber, endRow)
          )
        );
      return await client.query.posts.findMany({
        where: inArray(
          $posts.id,
          $aroundQuery.map((p) => p.id)
        ),
        with: {
          author: true,
          reactions: true,
        },
        orderBy: [desc($posts.id)],
        limit: count,
      });
    }

    return await client.query.posts.findMany({
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
      with: {
        author: true,
        reactions: true,
      },
      orderBy: [desc($posts.id)],
      limit: count,
    });
  },
  ['posts']
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
      // Find the group id which corresponds to this channel id
      const { groupId } =
        (await tx.query.channels.findFirst({
          where: eq($channels.id, channelId),
          columns: { groupId: true },
        })) ?? {};
      // Insert posts
      await tx
        .insert($posts)
        .values(posts.map((p) => ({ ...p, groupId, channelId })))
        .onConflictDoUpdate({
          target: $posts.id,
          set: conflictUpdateSetAll($posts),
        })
        .onConflictDoUpdate({
          target: [$posts.authorId, $posts.sentAt],
          set: conflictUpdateSetAll($posts),
        });
      // If these are non-reply posts, update group + channel last post as well as post windows.
      const topLevelPosts = posts.filter((p) => p.type !== 'reply');
      console.log(
        'total posts',
        posts.length,
        'top level posts:',
        topLevelPosts.length
      );
      if (topLevelPosts.length) {
        await setLastPost(
          {
            channelId: topLevelPosts[0].channelId,
            groupId,
            post: topLevelPosts[topLevelPosts.length - 1],
          },
          tx
        );
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

async function setLastPost(
  {
    groupId,
    channelId,
    post,
  }: {
    channelId: string;
    groupId?: string | null;
    post: Post;
  },
  tx: AnySqliteDatabase | AnySqliteTransaction
) {
  // Update last post meta for the channel these posts belong to,
  // Also grab that channels groupId for updating the group's lastPostAt and
  // associating the posts with the group.
  await tx
    .update($channels)
    .set({ lastPostId: post.id, lastPostAt: post.receivedAt })
    .where(
      and(
        eq($channels.id, channelId),
        or(
          isNull($channels.lastPostAt),
          lt($channels.lastPostAt, post.receivedAt ?? 0)
        )
      )
    );
  // Update group if we found one.
  if (groupId) {
    await tx
      .update($groups)
      .set({ lastPostId: post.id, lastPostAt: post.receivedAt })
      .where(
        and(
          eq($groups.id, groupId),
          or(
            isNull($groups.lastPostAt),
            lt($groups.lastPostAt, post.receivedAt ?? 0)
          )
        )
      );
  }
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
  // Update post window
  const window = {
    channelId,
    newestPostId: newPosts[newPosts.length - 1].id,
    oldestPostId: newPosts[0].id,
  };

  const { startId, endId } = (
    await tx
      .select({
        startId: min($postWindows.oldestPostId),
        endId: max($postWindows.newestPostId),
      })
      .from($postWindows)
      .where(
        and(
          eq($postWindows.channelId, window.channelId),
          lte($postWindows.oldestPostId, newer ?? window.newestPostId),
          gte($postWindows.newestPostId, older ?? window.oldestPostId)
        )
      )
  )[0];
  const resolvedStart =
    startId && startId < window.oldestPostId ? startId : window.oldestPostId;
  const resolvedEnd =
    endId && endId > window.newestPostId ? endId : window.newestPostId;

  await tx
    .delete($postWindows)
    .where(
      and(
        eq($postWindows.channelId, window.channelId),
        lte($postWindows.oldestPostId, endId ?? window.newestPostId),
        gte($postWindows.newestPostId, startId ?? window.oldestPostId)
      )
    )
    .returning({
      channelId: $postWindows.channelId,
      oldestPostId: $postWindows.oldestPostId,
      newestPostId: $postWindows.newestPostId,
    });

  console.log(
    'inserting window',
    shortPostId(resolvedStart),
    '=>',
    shortPostId(resolvedEnd)
  );

  await tx.insert($postWindows).values({
    channelId: window.channelId,
    oldestPostId: resolvedStart,
    newestPostId: resolvedEnd,
  });
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
        },
      })
      .then(returnNullIfUndefined);
  },
  ['posts']
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
  ['groups']
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
    const contactGroups = contactsData.flatMap(
      (contact) => contact.pinnedGroups || []
    );
    const targetGroups = contactGroups.map(
      (g): Group => ({
        id: g.groupId,
        isSecret: false,
      })
    );
    await client
      .insert($contacts)
      .values(contactsData)
      .onConflictDoUpdate({
        target: $contacts.id,
        set: conflictUpdateSetAll($contacts),
      });
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

export const insertUnreads = createWriteQuery(
  'insertUnreads',
  async (unreads: Unread[]) => {
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

export const getPostWindows = createReadQuery(
  'getPostWindows',
  async ({
    channelId,
    orderBy,
  }: { channelId?: string; orderBy?: 'windowStart' | 'windowEnd' } = {}) => {
    return client.query.postWindows.findMany({
      where: channelId ? eq($postWindows.channelId, channelId) : undefined,
      orderBy:
        orderBy === 'windowStart'
          ? asc($postWindows.oldestPostId)
          : orderBy === 'windowEnd'
            ? asc($postWindows.newestPostId)
            : undefined,
    });
  },
  ['postWindows']
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
