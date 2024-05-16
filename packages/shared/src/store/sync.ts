import { backOff } from 'exponential-backoff';

import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { useStorage } from './storage';
import { syncQueue } from './syncQueue';

const logger = createDevLogger('sync', false);

export const syncInitData = async () => {
  return syncQueue.add('init', async () => {
    const initData = await api.getInitData();
    await db.insertPinnedItems(initData.pins);
    await db.insertGroups(initData.groups);
    await resetUnreads(initData.unreads);
    await db.insertChannels(initData.channels);
    await db.insertChannelPerms(initData.channelPerms);
  });
};

export const syncSettings = async () => {
  return syncQueue.add('settings', async () => {
    const settings = await api.getSettings();
    await db.insertSettings(settings);
  });
};

export const syncContacts = async () => {
  return syncQueue.add('contacts', async () => {
    const contacts = await api.getContacts();
    await db.insertContacts(contacts);
  });
};

export const syncPinnedItems = async () => {
  const pinnedItems = await api.getPinnedItems();
  await db.insertPinnedItems(pinnedItems);
};

export const syncGroups = async () => {
  const groups = await api.getGroups({ includeMembers: false });
  await db.insertGroups(groups);
};

export const syncDms = async () => {
  const [dms, groupDms] = await Promise.all([api.getDms(), api.getGroupDms()]);
  await db.insertChannels([...dms, ...groupDms]);
};

export const syncUnreads = async () => {
  const [channelUnreads, dmUnreads] = await Promise.all([
    api.getChannelUnreads(),
    api.getDMUnreads(),
  ]);
  const unreads = [...channelUnreads, ...dmUnreads];
  await resetUnreads(unreads);
};

const resetUnreads = async (unreads: db.Unread[]) => {
  await db.insertUnreads(unreads);
  await db.setJoinedGroupChannels({
    channelIds: unreads
      .filter((u) => u.type === 'channel')
      .map((u) => u.channelId),
  });
};

async function handleGroupUpdate(update: api.GroupUpdate) {
  logger.log('received group update', update.type);

  let channelNavSection: db.GroupNavSectionChannel | null | undefined;

  switch (update.type) {
    case 'addGroup':
      await db.insertGroups([update.group]);
      break;
    case 'editGroup':
      await db.updateGroup({ id: update.groupId, meta: update.meta });
      break;
    case 'deleteGroup':
      await db.deleteGroup(update.groupId);
      break;
    case 'inviteGroupMembers':
      await db.addGroupInvites({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'revokeGroupMemberInvites':
      await db.deleteGroupInvites({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'banGroupMembers':
      await db.addGroupMemberBans({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'unbanGroupMembers':
      await db.deleteGroupMemberBans({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'banAzimuthRanks':
      await db.addGroupRankBans({
        groupId: update.groupId,
        ranks: update.ranks,
      });
      break;
    case 'unbanAzimuthRanks':
      await db.deleteGroupRankBans({
        groupId: update.groupId,
        ranks: update.ranks,
      });
      break;
    case 'flagGroupPost':
      await db.insertFlaggedPosts([
        {
          groupId: update.groupId,
          channelId: update.channelId,
          flaggedByContactId: update.flaggingUser,
          postId: update.postId,
        },
      ]);
      break;
    case 'setGroupAsPublic':
      await db.updateGroup({ id: update.groupId, publicOrPrivate: 'public' });
      break;
    case 'setGroupAsPrivate':
      await db.updateGroup({ id: update.groupId, publicOrPrivate: 'private' });
      break;
    case 'setGroupAsSecret':
      await db.updateGroup({ id: update.groupId, isSecret: true });
      break;
    case 'setGroupAsNotSecret':
      await db.updateGroup({ id: update.groupId, isSecret: false });
      break;
    case 'addGroupMembers':
      await db.addChatMembers({
        chatId: update.groupId,
        contactIds: update.ships,
        type: 'group',
      });
      break;
    case 'removeGroupMembers':
      await db.removeChatMembers({
        chatId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'addRole':
      await db.addRole({
        id: update.roleId,
        groupId: update.groupId,
        ...update.meta,
      });
      break;
    case 'editRole':
      await db.updateRole({
        id: update.roleId,
        groupId: update.groupId,
        ...update.meta,
      });
      break;
    case 'deleteRole':
      await db.deleteRole(update.roleId, update.groupId);
      break;
    case 'addGroupMembersToRole':
      await db.addChatMembersToRoles({
        groupId: update.groupId,
        contactIds: update.ships,
        roleIds: update.roles,
      });
      break;
    case 'removeGroupMembersFromRole':
      await db.removeChatMembersFromRoles({
        groupId: update.groupId,
        contactIds: update.ships,
        roleIds: update.roles,
      });
      break;
    case 'addChannel':
      await db.insertChannels([update.channel]);
      break;
    case 'updateChannel':
      await db.updateChannel(update.channel);
      break;
    case 'deleteChannel':
      channelNavSection = await db.getChannelNavSection({
        channelId: update.channelId,
      });

      if (channelNavSection && channelNavSection.groupNavSectionId) {
        await db.deleteChannelFromNavSection({
          channelId: update.channelId,
          groupNavSectionId: channelNavSection.groupNavSectionId,
        });
      }

      await db.deleteChannel(update.channelId);
      break;
    case 'joinChannel':
      await db.setJoinedGroupChannels({ channelIds: [update.channelId] });
      break;
    case 'leaveChannel':
      await db.setLeftGroupChannels({ channelIds: [update.channelId] });
      break;
    case 'addNavSection':
      await db.addNavSectionToGroup({
        id: update.navSectionId,
        groupId: update.groupId,
        meta: update.clientMeta,
      });
      break;
    case 'editNavSection':
      await db.updateNavSection({
        id: update.navSectionId,
        ...update.clientMeta,
      });
      break;
    case 'deleteNavSection':
      await db.deleteNavSection(update.navSectionId);
      break;
    case 'moveNavSection':
      await db.updateNavSection({
        id: update.navSectionId,
        index: update.index,
      });
      break;
    case 'moveChannel':
      logger.log('moving channel', update);
      await db.addChannelToNavSection({
        channelId: update.channelId,
        groupNavSectionId: update.navSectionId,
        index: update.index,
      });
      break;
    case 'addChannelToNavSection':
      logger.log('adding channel to nav section', update);
      await db.addChannelToNavSection({
        channelId: update.channelId,
        groupNavSectionId: update.navSectionId,
        index: 0,
      });
      break;
    case 'unknown':
    default:
      break;
  }
}

async function handleUnreadUpdate(unread: db.Unread) {
  logger.log('event: unread update', unread);
  await db.insertUnreads([unread]);
  const channelExists = await db.getChannel({ id: unread.channelId });
  if (!channelExists) {
    logger.log('channel does not exist, skipping sync');
    return;
  }
  logger.log('syncing channel', unread.channelId);
  await syncChannel(unread.channelId, unread.updatedAt);
}

type StaleChannel = db.Channel & { unread: db.Unread };

export const syncStaleChannels = async () => {
  const channels: StaleChannel[] = optimizeChannelLoadOrder(
    await db.getStaleChannels()
  );
  for (const channel of channels) {
    syncQueue.add(channel.id, () => {
      return syncChannel(channel.id, channel.unread.updatedAt);
    });
  }
};

export const handleChannelsUpdate = async (update: api.ChannelsUpdate) => {
  logger.log('event: channels update', update);
  switch (update.type) {
    case 'addPost':
      // first check if it's a reply. If it is and we haven't already cached
      // it, we need to add it to the parent post
      if (update.post.parentId) {
        const cachedReply = await db.getPostByCacheId({
          sentAt: update.post.sentAt,
          authorId: update.post.authorId,
        });
        if (!cachedReply) {
          await db.addReplyToPost({
            parentId: update.post.parentId,
            replyAuthor: update.post.authorId,
            replyTime: update.post.sentAt,
          });
        }
        // insert the reply
        await db.insertChannelPosts({
          channelId: update.post.channelId,
          posts: [update.post],
        });
      }
      // For non-replies, we skip inserting and sync from the api instead.
      // This is significantly slower, but ensures that windowing stays correct. Better solutions would be:
      // 1. Have the server send the previous post id so that we can match this up with an older window if it exists
      // 2. Return "non-windowed" posts with first window -- would mostly work but could cause missing posts at times.
      // TODO: Implement one of those solutions.
      await syncPosts({
        channelId: update.post.channelId,
        cursor: update.post.id,
        mode: 'around',
        count: 3,
      });
      break;
    case 'updateWriters':
      await db.updateChannel({
        id: update.channelId,
        writerRoles: update.writers.map((r) => ({
          channelId: update.channelId,
          roleId: r,
        })),
      });
      break;
    case 'deletePost':
      await db.deletePosts({ ids: [update.postId] });
      break;
    case 'hidePost':
      await db.updatePost({ id: update.postId, hidden: true });
      break;
    case 'showPost':
      await db.updatePost({ id: update.postId, hidden: false });
      break;
    case 'updateReactions':
      await db.replacePostReactions({
        postId: update.postId,
        reactions: update.reactions,
      });
      break;
    case 'markPostSent':
      await db.updatePost({ id: update.cacheId, deliveryStatus: 'sent' });
      break;
    case 'unknown':
    default:
      break;
  }
};

export const clearSyncQueue = () => {
  // TODO: Model all sync functions as syncQueue.add calls so that this works on
  // more than just `syncStaleChannels`
  syncQueue.clear();
};

/**
 * Optimize load order for our current display. Starting with all channels
 * ordered by update time, sort so recently updated dms are synced before all but
 * the most recently updated channel of each group.
 */
function optimizeChannelLoadOrder(channels: StaleChannel[]): StaleChannel[] {
  const seenGroups = new Set<string>();
  const topChannels: StaleChannel[] = [];
  const skippedChannels: StaleChannel[] = [];
  const restOfChannels: StaleChannel[] = [];
  channels.forEach((c) => {
    if (topChannels.length < 10) {
      if (!c.groupId || !seenGroups.has(c.groupId)) {
        topChannels.push(c);
        if (c.groupId) seenGroups.add(c.groupId);
      } else {
        skippedChannels.push(c);
      }
    } else {
      restOfChannels.push(c);
    }
  });
  return [...topChannels, ...skippedChannels, ...restOfChannels];
}

export async function syncPosts(options: db.GetChannelPostsOptions) {
  logger.log(
    'syncing posts',
    `${options.channelId}/${options.cursor}/${options.mode}`
  );
  const response = await api.getChannelPosts(options);
  if (response.posts.length) {
    await db.insertChannelPosts({
      channelId: options.channelId,
      posts: response.posts,
      newer: response.newer,
      older: response.older,
    });
  }
  return response;
}

export async function syncChannel(id: string, remoteUpdatedAt: number) {
  const startTime = Date.now();
  const channel = await db.getChannel({ id });
  if (!channel) {
    throw new Error('no local channel for' + id);
  }
  // If we don't have any posts, start loading backward from the current time
  if ((channel.remoteUpdatedAt ?? 0) < remoteUpdatedAt) {
    logger.log('loading posts for channel', id);
    const postsResponse = await api.getChannelPosts({
      channelId: id,
      ...(channel.lastPostId
        ? { direction: 'newer', cursor: channel.lastPostId }
        : { direction: 'older', date: new Date() }),
      includeReplies: false,
    });
    await persistPagedPostData(channel.id, postsResponse);
    logger.log(
      'loaded',
      postsResponse.posts?.length,
      `posts for channel ${id} in `,
      Date.now() - startTime + 'ms'
    );
    await db.updateChannel({
      id,
      remoteUpdatedAt,
      syncedAt: Date.now(),
    });
  }
}

export async function syncGroup(id: string) {
  if (id === '') {
    throw new Error('group id cannot be empty');
  }
  const group = await db.getGroup({ id });
  if (!group) {
    throw new Error('no local group for' + id);
  }
  const response = await api.getGroup(id);
  await db.insertGroups([response]);
}

const currentPendingMessageSyncs = new Map<string, Promise<boolean>>();
export async function syncChannelMessageDelivery({
  channelId,
}: {
  channelId: string;
}) {
  if (currentPendingMessageSyncs.has(channelId)) {
    logger.log(`message delivery sync already in progress for ${channelId}`);
  }

  try {
    logger.log(`syncing messsage delivery for ${channelId}`);
    const syncPromise = syncChannelWithBackoff({ channelId });
    currentPendingMessageSyncs.set(channelId, syncPromise);
    await syncPromise;
    logger.log(`all messages in ${channelId} are delivered`);
  } catch (e) {
    logger.error(
      `some messages in ${channelId} still undelivered, is the channel offline?`
    );
  } finally {
    currentPendingMessageSyncs.delete(channelId);
  }
}

export async function syncChannelWithBackoff({
  channelId,
}: {
  channelId: string;
}): Promise<boolean> {
  const checkDelivered = async () => {
    const hasPendingBefore = (await db.getPendingPosts(channelId)).length > 0;
    if (!hasPendingBefore) {
      return true;
    }

    logger.log(`still have undelivered messages, syncing...`);
    await syncChannel(channelId, Date.now());

    const hasPendingAfter = (await db.getPendingPosts(channelId)).length > 0;
    if (hasPendingAfter) {
      throw new Error('Keep going');
    }

    return true;
  };

  try {
    // try checking delivery status immediately
    await checkDelivered();
    return true;
  } catch (e) {
    // thereafter, try checking with exponential backoff. Config values
    // are arbitrary reasonable sounding defaults
    return backOff(checkDelivered, {
      startingDelay: 2000, // 2 seconds
      maxDelay: 3 * 60 * 1000, // 3 minutes
      numOfAttempts: 20,
    });
  }
}

export async function syncThreadPosts({
  postId,
  authorId,
  channelId,
}: {
  postId: string;
  authorId: string;
  channelId: string;
}) {
  const response = await api.getPostWithReplies({
    postId,
    authorId,
    channelId,
  });
  await db.insertChannelPosts({
    channelId,
    posts: [response, ...(response.replies ?? [])],
  });
}

async function persistPagedPostData(
  channelId: string,
  data: api.GetChannelPostsResponse
) {
  await db.updateChannel({
    id: channelId,
    postCount: data.totalPosts,
  });
  if (data.posts.length) {
    await db.insertChannelPosts({
      channelId,
      posts: data.posts,
      newer: data.newer,
      older: data.older,
    });
    const reactions = data.posts
      .map((p) => p.reactions)
      .flat()
      .filter(Boolean) as db.Reaction[];
    if (reactions.length) {
      await db.insertPostReactions({ reactions });
    }
  }
  if (data.deletedPosts?.length) {
    await db.deletePosts({ ids: data.deletedPosts });
  }
}

export const start = async () => {
  api.subscribeUnreads(handleUnreadUpdate);
  api.subscribeToChannelsUpdates(handleChannelsUpdate);
  api.subscribeGroups(handleGroupUpdate);
  useStorage.getState().start();
};
