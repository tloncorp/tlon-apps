import { backOff } from 'exponential-backoff';
import _ from 'lodash';

import * as api from '../api';
import * as db from '../db';
import { QueryCtx, batchEffects } from '../db/query';
import { createDevLogger } from '../debug';
import { extractClientVolumes } from '../logic/activity';
import { useStorage } from './storage';
import { syncQueue } from './syncQueue';

const logger = createDevLogger('sync', true);

// Used to track latest post we've seen for each channel.
// Updated when:
// - We load channel heads
// - We create a new post locally
// - We receive a new post from a subscription
export const channelCursors = new Map<string, string>();

export const syncInitData = async () => {
  const initData = await syncQueue.add('init', () => api.getInitData());
  return batchEffects('init sync', async (ctx) => {
    return await Promise.all([
      db.insertPinnedItems(initData.pins, ctx),
      db.insertGroups({ groups: initData.groups }, ctx),
      db.insertUnjoinedGroups(initData.unjoinedGroups, ctx),
      db.insertChannels(initData.channels, ctx),
      resetActivity(initData.activity, ctx),
      db.insertChannelPerms(initData.channelPerms, ctx),
    ]);
  });
};

export const syncLatestPosts = async () => {
  const result = await syncQueue.add('latest-posts', async () =>
    Promise.all([
      api.getLatestPosts({ type: 'channels' }),
      api.getLatestPosts({ type: 'chats' }),
    ])
  );
  const allPosts = result.flatMap((set) => set.map((p) => p.latestPost));
  for (const post of allPosts) {
    if (
      !channelCursors.has(post.channelId) ||
      post.id > channelCursors.get(post.channelId)!
    ) {
      channelCursors.set(post.channelId, post.id);
    }
  }
  await db.insertLatestPosts(allPosts);
};

export const syncChanges = async (options: api.GetChangedPostsOptions) => {
  const result = await syncQueue.add('changes', () =>
    api.getChangedPosts(options)
  );
  await persistPagedPostData(options.channelId, result);
};

export const syncSettings = async () => {
  const settings = await syncQueue.add('settings', () => api.getSettings());
  return db.insertSettings(settings);
};

export const syncVolumeSettings = async () => {
  return syncQueue.add('volumeSettings', async () => {
    const volumeSettings = await api.getVolumeSettings();
    const clientVolume = extractClientVolumes(volumeSettings);

    await db.storeVolumeSettings(volumeSettings); // TODO: remove?

    await db.setChannelVolumes(clientVolume.channelVolumes);
    await db.setGroupVolumes(clientVolume.groupVolumes);
  });
};

export const syncActivityEvents = async () => {
  return syncQueue.add('activity', async () => {
    const events = await api.getActivityEvents();
    await db.insertActivityEvents(events);
  });
};

export const syncContacts = async () => {
  const contacts = await syncQueue.add('contacts', () => api.getContacts());
  await db.insertContacts(contacts);
};

export const syncPinnedItems = async () => {
  const pinnedItems = await syncQueue.add('pinnedItems', () =>
    api.getPinnedItems()
  );
  await db.insertPinnedItems(pinnedItems);
};

export const syncGroups = async () => {
  const groups = await syncQueue.add('groups', () =>
    api.getGroups({ includeMembers: false })
  );
  await db.insertGroups({ groups: groups });
};

export const syncDms = async () => {
  const [dms, groupDms] = await syncQueue.add('dms', () =>
    Promise.all([api.getDms(), api.getGroupDms()])
  );
  await db.insertChannels([...dms, ...groupDms]);
};

export const syncUnreads = async () => {
  const { channelActivity, threadActivity } = await api.getUnreads();
  await db.insertUnreads(channelActivity);
  await db.insertThreadActivity(threadActivity);

  await db.setJoinedGroupChannels({
    channelIds: channelActivity
      .filter((u) => u.type === 'channel')
      .map((u) => u.channelId),
  });
};

const resetActivity = async (activity: api.ActivityInit, ctx?: QueryCtx) => {
  const { channelActivity, threadActivity } = activity;
  await db.insertUnreads(channelActivity);
  await db.insertThreadActivity(threadActivity);

  await db.setJoinedGroupChannels({
    channelIds: channelActivity
      .filter((u) => u.type === 'channel')
      .map((u) => u.channelId),
  });
};

async function handleGroupUpdate(update: api.GroupUpdate) {
  logger.log('received group update', update.type);

  let channelNavSection: db.GroupNavSectionChannel | null | undefined;

  switch (update.type) {
    case 'addGroup':
      await db.insertGroups({ groups: [update.group] });
      break;
    case 'editGroup':
      await db.updateGroup({ id: update.groupId, ...update.meta });
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
      await db.updateGroup({ id: update.groupId, privacy: 'public' });
      break;
    case 'setGroupAsPrivate':
      await db.updateGroup({ id: update.groupId, privacy: 'private' });
      break;
    case 'setGroupAsSecret':
      await db.updateGroup({ id: update.groupId, privacy: 'secret' });
      break;
    case 'setGroupAsNotSecret':
      await db.updateGroup({ id: update.groupId, privacy: 'private' });
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
      await db.deleteRole({ roleId: update.roleId, groupId: update.groupId });
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
    case 'setUnjoinedGroups':
      await db.insertUnjoinedGroups(update.groups);
      break;
    case 'unknown':
    default:
      break;
  }
}

const handleActivityUpdate = (queueDebounce: number = 300) => {
  const queue: api.ActivityUpdateQueue = {
    channelActivity: [],
    threadActivity: [],
    volumeSettings: [],
    channelVolumeUpdates: [],
    groupVolumeUpdates: [],
    activityEvents: [],
  };
  const processQueue = _.debounce(
    async () => {
      const activitySnapshot = _.cloneDeep(queue);
      queue.channelActivity = [];
      queue.threadActivity = [];
      queue.volumeSettings = [];
      queue.channelVolumeUpdates = [];
      queue.groupVolumeUpdates = [];
      queue.activityEvents = [];

      logger.log(
        `processing activity queue`,
        activitySnapshot.channelActivity.length,
        activitySnapshot.threadActivity.length,
        activitySnapshot.volumeSettings.length,
        activitySnapshot.channelVolumeUpdates.length,
        activitySnapshot.groupVolumeUpdates.length,
        activitySnapshot.activityEvents.length
      );
      await db.insertUnreads(activitySnapshot.channelActivity);
      await db.insertThreadActivity(activitySnapshot.threadActivity);
      await db.mergeVolumeSettings(activitySnapshot.volumeSettings);
      await db.setChannelVolumes(activitySnapshot.channelVolumeUpdates);
      await db.setGroupVolumes(activitySnapshot.groupVolumeUpdates);
      await db.insertActivityEvents(activitySnapshot.activityEvents);
    },
    queueDebounce,
    { leading: true, trailing: true }
  );

  return (event: api.ActivityEvent) => {
    logger.log('received activity event', event);
    switch (event.type) {
      case 'updateChannelActivity':
        queue.channelActivity.push(event.activity);
        break;
      case 'updateThreadActivity':
        queue.threadActivity.push(event.activity);
        break;
      case 'updateVolumeSetting':
        queue.volumeSettings.push(event.update);
        break;
      case 'updateChannelVolume':
        queue.channelVolumeUpdates.push(event.volumeUpdate);
        break;
      case 'updateGroupVolume':
        queue.groupVolumeUpdates.push(event.volumeUpdate);
        break;
      case 'addActivityEvent':
        queue.activityEvents.push(event.event);
        break;
    }
    processQueue();
  };
};

export const handleContactUpdate = async (update: api.ContactsUpdate) => {
  switch (update.type) {
    case 'add':
      await db.insertContacts([update.contact]);
      break;
    case 'delete':
      await db.deleteContact(update.contactId);
      break;
  }
};

export const handleChatUpdate = async (update: api.ChatEvent) => {
  switch (update.type) {
    case 'addPost':
      await handleAddPost(update.post);
      break;
    case 'deletePost':
      await db.deletePosts({ ids: [update.postId] });
      break;
    case 'addReaction':
      db.insertPostReactions({
        reactions: [
          {
            postId: update.postId,
            contactId: update.userId,
            value: update.react,
          },
        ],
      });
      break;
    case 'deleteReaction':
      db.deletePostReaction({
        postId: update.postId,
        contactId: update.userId,
      });
      break;
    case 'addDmInvites':
      db.insertChannels(update.channels);
      break;

    case 'groupDmsUpdate':
      syncDms();
      break;
  }
};

export const handleChannelsUpdate = async (update: api.ChannelsUpdate) => {
  logger.log('event: channels update', update);
  switch (update.type) {
    case 'addPost':
      await handleAddPost(update.post);
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

async function handleAddPost(post: db.Post) {
  // first check if it's a reply. If it is and we haven't already cached
  // it, we need to add it to the parent post
  if (post.parentId) {
    const cachedReply = await db.getPostByCacheId({
      sentAt: post.sentAt,
      authorId: post.authorId,
    });
    if (!cachedReply) {
      await db.addReplyToPost({
        parentId: post.parentId,
        replyAuthor: post.authorId,
        replyTime: post.sentAt,
      });
    }
  }
  // insert the reply
  await db.insertChannelPosts({
    channelId: post.channelId,
    posts: [post],
    older: channelCursors.get(post.channelId),
  });
  channelCursors.set(post.channelId, post.id);
}

export async function syncPosts(options: api.GetChannelPostsOptions) {
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
        ? { mode: 'newer', cursor: channel.lastPostId }
        : { mode: 'older', cursor: new Date() }),
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
  await db.insertGroups({ groups: [response] });
}

export async function syncNewGroup(id: string) {
  const response = await api.getGroup(id);
  await db.insertGroups({ groups: [response] });
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
  async function isStillPending() {
    return (await db.getPendingPosts(channelId)).length > 0;
  }

  const checkDelivered = async () => {
    if (!(await isStillPending())) {
      return true;
    }

    logger.log(`still have undelivered messages, syncing...`);
    await syncChannel(channelId, Date.now());

    if (await isStillPending()) {
      throw new Error('Keep going');
    }

    return true;
  };

  return backOff(checkDelivered, {
    delayFirstAttempt: true,
    startingDelay: 3000, // 3 seconds
    maxDelay: 3 * 60 * 1000, // 3 minutes
    numOfAttempts: 20,
  });
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

export const clearSyncQueue = () => {
  // TODO: Model all sync functions as syncQueue.add calls so that this works on
  // more than just `syncStaleChannels`
  syncQueue.clear();
};

export const initializeStorage = () => {
  return syncQueue.add('initialize storage', async () => {
    return useStorage.getState().start();
  });
};

export const setupSubscriptions = async () => {
  return syncQueue.add('setup subscriptions', async () => {
    await Promise.all([
      api.subscribeToActivity(handleActivityUpdate()),
      api.subscribeGroups(handleGroupUpdate),
      api.subscribeToChannelsUpdates(handleChannelsUpdate),
      api.subscribeToChatUpdates(handleChatUpdate),
      api.subscribeToContactUpdates(handleContactUpdate),
    ]);
  });
};
