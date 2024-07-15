import { backOff } from 'exponential-backoff';
import _ from 'lodash';

import * as api from '../api';
import * as db from '../db';
import { QueryCtx, batchEffects } from '../db/query';
import { createDevLogger } from '../debug';
import { ErrorReporter, withRetry } from '../logic';
import { extractClientVolumes } from '../logic/activity';
import {
  INFINITE_ACTIVITY_QUERY_KEY,
  resetActivityFetchers,
} from '../store/useActivityFetchers';
import { updateSession } from './session';
import { useStorage } from './storage';
import { SyncPriority, syncQueue } from './syncQueue';
import { addToChannelPosts, clearChannelPostsQueries } from './useChannelPosts';

export { SyncPriority, syncQueue } from './syncQueue';

const logger = createDevLogger('sync', false);

// Used to track latest post we've seen for each channel.
// Updated when:
// - We load channel heads
// - We create a new post locally
// - We receive a new post from a subscription
export const channelCursors = new Map<string, string>();
export function updateChannelCursor(channelId: string, cursor: string) {
  if (
    !channelCursors.has(channelId) ||
    cursor > channelCursors.get(channelId)!
  ) {
    channelCursors.set(channelId, cursor);
  }
}

// Used to keep track of which groups/channels we're a part of. If we
// see something new, we refetch init data. Fallback in case we miss
// something over %channels or %groups
const joinedGroupsAndChannels = new Set<string>();

export const syncInitData = async (reporter?: ErrorReporter) => {
  const initData = await syncQueue.highPriority('init', () =>
    api.getInitData()
  );
  reporter?.log('got init data from api');
  initializeJoinedSet(initData.unreads);
  return batchEffects('init sync', async (ctx) => {
    return await Promise.all([
      db
        .insertPinnedItems(initData.pins, ctx)
        .then(() => reporter?.log('inserted pinned items')),
      db
        .insertGroups({ groups: initData.groups }, ctx)
        .then(() => reporter?.log('inserted groups')),
      db
        .insertUnjoinedGroups(initData.unjoinedGroups, ctx)
        .then(() => reporter?.log('inserted unjoined groups')),
      db
        .insertChannels(initData.channels, ctx)
        .then(() => reporter?.log('inserted channels')),
      persistUnreads(initData.unreads, ctx).then(() =>
        reporter?.log('persisted unreads')
      ),
      handleReceivedHiddenPosts({
        reporter,
        hiddenPostIds: initData.hiddenPostIds,
      }).then(() => reporter?.log('handled hidden posts')),
      db
        .insertBlockedContacts({ blockedIds: initData.blockedUsers })
        .then(() => reporter?.log('inserted blocked users')),
      db
        .insertChannelPerms(initData.channelPerms, ctx)
        .then(() => reporter?.log('inserted channel perms')),
      db
        .setLeftGroups({ joinedGroupIds: initData.joinedGroups }, ctx)
        .then(() => reporter?.log('set left groups')),
      db
        .setLeftGroupChannels({ joinedChannelIds: initData.joinedGroups }, ctx)
        .then(() => reporter?.log('set left channels')),
    ]);
  });
};

function initializeJoinedSet({
  channelUnreads,
  groupUnreads,
}: {
  channelUnreads: db.ChannelUnread[];
  groupUnreads: db.GroupUnread[];
}) {
  channelUnreads.forEach((u) => joinedGroupsAndChannels.add(u.channelId));
  groupUnreads.forEach((u) => joinedGroupsAndChannels.add(u.groupId));
}

const debouncedSyncInit = _.debounce(syncInitData, 3000, {
  leading: true,
  trailing: true,
});

function checkForNewlyJoined({
  channelUnreads,
  groupUnreads,
}: {
  channelUnreads: db.ChannelUnread[];
  groupUnreads: db.GroupUnread[];
}) {
  const unreadItems = [
    ...channelUnreads.map((u) => u.channelId),
    ...groupUnreads.map((u) => u.groupId),
  ];
  let atLeastOneNew = false;
  for (const item of unreadItems) {
    if (!joinedGroupsAndChannels.has(item)) {
      joinedGroupsAndChannels.add(item);
      atLeastOneNew = true;
    }
  }

  if (atLeastOneNew) {
    logger.log('found newly joined channel or group, resyncing init data');
    debouncedSyncInit();
  }
}

export const syncBlockedUsers = async () => {
  const blockedIds = await api.getBlockedUsers();
  await db.insertBlockedContacts({ blockedIds });
};

export const syncChannelHeads = async (
  reporter?: ErrorReporter,
  priority = SyncPriority.High
) => {
  const result = await Promise.all([
    syncQueue.add('groupChannelHeads', priority, () =>
      api.getLatestPosts({ type: 'channels' })
    ),
    syncQueue.add('chatChannelHeads', priority, () =>
      api.getLatestPosts({ type: 'chats' })
    ),
  ]);
  reporter?.log('got latest posts from api');
  const allPosts = result.flatMap((set) => set.map((p) => p.latestPost));
  allPosts.forEach((p) => updateChannelCursor(p.channelId, p.id));
  await db.insertLatestPosts(allPosts);
};

export const syncSettings = async (priority = SyncPriority.Medium) => {
  const settings = await syncQueue.add('settings', priority, () =>
    api.getSettings()
  );
  return db.insertSettings(settings);
};

export const syncAppInfo = async (priority = SyncPriority.Medium) => {
  const appInfo = await syncQueue.add('appInfo', priority, () =>
    api.getAppInfo()
  );
  return db.setAppInfoSettings(appInfo);
};

export const syncVolumeSettings = async (priority = SyncPriority.Medium) => {
  const volumeSettings = await syncQueue.add('volumeSettings', priority, () =>
    api.getVolumeSettings()
  );
  const clientVolumes = extractClientVolumes(volumeSettings);
  await db.setVolumes(clientVolumes);
};

export const syncContacts = async (priority = SyncPriority.Medium) => {
  const contacts = await syncQueue.add('contacts', priority, () =>
    api.getContacts()
  );
  await db.insertContacts(contacts);
};

export const syncPinnedItems = async (priority = SyncPriority.Medium) => {
  logger.log('syncing pinned items');
  const pinnedItems = await syncQueue.add('pinnedItems', priority, () =>
    api.getPinnedItems()
  );
  logger.log('got pinned items from api', pinnedItems.length);
  await db.insertPinnedItems(pinnedItems);
};

export const syncGroups = async (priority = SyncPriority.Medium) => {
  const groups = await syncQueue.add('groups', priority, () =>
    api.getGroups({ includeMembers: false })
  );
  await db.insertGroups({ groups: groups });
};

export const syncDms = async (priority = SyncPriority.Medium) => {
  const [dms, groupDms] = await syncQueue.add('dms', priority, () =>
    Promise.all([api.getDms(), api.getGroupDms()])
  );
  await db.insertChannels([...dms, ...groupDms]);
};

export const syncUnreads = async (priority = SyncPriority.Medium) => {
  const unreads = await syncQueue.add('unreads', priority, () =>
    api.getGroupAndChannelUnreads()
  );
  checkForNewlyJoined(unreads);
  return batchEffects('initialUnreads', (ctx) => persistUnreads(unreads, ctx));
};

export const syncChannelThreadUnreads = async (
  channelId: string,
  priority = SyncPriority.Medium
) => {
  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    console.warn(
      'cannot get thread unreads for non-existent channel',
      channelId
    );
    return;
  }
  const unreads = await syncQueue.add('thread unreads', priority, () =>
    api.getThreadUnreadsByChannel(channel)
  );
  await db.insertThreadUnreads(unreads);
};

export async function syncPostReference(options: {
  postId: string;
  channelId: string;
  replyId?: string;
}) {
  // We exclude this from the sync queue as these operations can take quite a
  // while; they're also not blocking as we're just waiting on a subscription
  // event.
  const response = await api.getPostReference(options);
  await db.insertChannelPosts({
    channelId: options.channelId,
    posts: [response],
  });
}

export async function syncThreadPosts(
  {
    postId,
    authorId,
    channelId,
  }: {
    postId: string;
    authorId: string;
    channelId: string;
  },
  priority = SyncPriority.Medium
) {
  const response = await syncQueue.add('syncThreadPosts', priority, () =>
    api.getPostWithReplies({
      postId,
      authorId,
      channelId,
    })
  );
  await db.insertChannelPosts({
    channelId,
    posts: [response, ...(response.replies ?? [])],
  });
}

export async function syncGroup(id: string, priority = SyncPriority.High) {
  const response = await syncQueue.add('syncGroup', priority, () =>
    api.getGroup(id)
  );
  await db.insertGroups({ groups: [response] });
}

export const syncStorageSettings = (priority = SyncPriority.Medium) => {
  return syncQueue.add('initialize storage', priority, () => {
    return useStorage.getState().start();
  });
};

const persistUnreads = async (activity: api.ActivityInit, ctx?: QueryCtx) => {
  const { groupUnreads, channelUnreads, threadActivity } = activity;
  await db.insertGroupUnreads(groupUnreads, ctx);
  await db.insertChannelUnreads(channelUnreads, ctx);
  await db.insertThreadUnreads(threadActivity, ctx);
  await db.setJoinedGroupChannels(
    {
      channelIds: channelUnreads
        .filter((u) => u.type === 'channel')
        .map((u) => u.channelId),
    },
    ctx
  );
};

export const resetActivity = async () => {
  const activityEvents = await api.getInitialActivity();
  await db.clearActivityEvents();
  await db.insertActivityEvents(activityEvents);
  resetActivityFetchers();
};

export const syncPushNotificationsSetting = async () => {
  const setting = await api.getPushNotificationsSetting();
  await db.setPushNotificationsSetting(setting);
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
      await db.addJoinedGroupChannel({ channelId: update.channelId });
      break;
    case 'leaveChannel':
      await db.removeJoinedGroupChannel({ channelId: update.channelId });
      break;
    case 'addNavSection':
      logger.log('adding nav section', update);
      await db.addNavSectionToGroup({
        id: update.navSectionId,
        sectionId: update.sectionId,
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
        sectionIndex: update.index,
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

const createActivityUpdateHandler = (queueDebounce: number = 100) => {
  const queue: api.ActivityUpdateQueue = {
    groupUnreads: [],
    channelUnreads: [],
    threadUnreads: [],
    volumeUpdates: [],
    activityEvents: [],
  };
  const processQueue = _.debounce(
    async () => {
      const activitySnapshot = _.cloneDeep(queue);
      queue.groupUnreads = [];
      queue.channelUnreads = [];
      queue.threadUnreads = [];
      queue.volumeUpdates = [];
      queue.activityEvents = [];

      logger.log(
        `processing activity queue`,
        activitySnapshot.groupUnreads.length,
        activitySnapshot.channelUnreads.length,
        activitySnapshot.threadUnreads.length,
        activitySnapshot.volumeUpdates.length,
        activitySnapshot.activityEvents.length
      );
      await batchEffects('activityUpdate', async (ctx) => {
        await db.insertGroupUnreads(activitySnapshot.groupUnreads, ctx);
        await db.insertChannelUnreads(activitySnapshot.channelUnreads, ctx);
        await db.insertThreadUnreads(activitySnapshot.threadUnreads, ctx);
        await db.setVolumes(activitySnapshot.volumeUpdates, ctx);
        await db.insertActivityEvents(activitySnapshot.activityEvents, ctx);
      });

      // if we inserted new activity, invalidate the activity page
      // data loader
      if (activitySnapshot.activityEvents.length > 0) {
        api.queryClient.invalidateQueries({
          queryKey: [INFINITE_ACTIVITY_QUERY_KEY],
        });
      }

      // check for any newly joined groups and channels
      checkForNewlyJoined({
        groupUnreads: activitySnapshot.groupUnreads,
        channelUnreads: activitySnapshot.channelUnreads,
      });
    },
    queueDebounce,
    { leading: true, trailing: true }
  );

  return (event: api.ActivityEvent) => {
    switch (event.type) {
      case 'updateGroupUnread':
        queue.groupUnreads.push(event.unread);
        break;
      case 'updateChannelUnread':
        queue.channelUnreads.push(event.activity);
        break;
      case 'updateThreadUnread':
        queue.threadUnreads.push(event.activity);
        break;
      case 'updateItemVolume':
        queue.volumeUpdates.push(event.volumeUpdate);
        break;
      case 'addActivityEvent':
        queue.activityEvents.push(...event.events);
        break;
      case 'updatePushNotificationsSetting':
        db.setPushNotificationsSetting(event.value);
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
    case 'joinChannelSuccess':
      await db.addJoinedGroupChannel({ channelId: update.channelId });
      break;
    case 'leaveChannelSuccess':
      await db.removeJoinedGroupChannel({ channelId: update.channelId });
      break;
    case 'initialPostsOnChannelJoin':
      await db.insertChannelPosts({
        channelId: update.channelId,
        posts: update.posts,
      });
      break;
    case 'unknown':
      logger.log('unknown channels update', update);
      break;
    default:
      break;
  }
};

export const handleChatUpdate = async (update: api.ChatEvent) => {
  logger.log('event: chat update', update);

  switch (update.type) {
    case 'showPost':
      await db.updatePost({ id: update.postId, hidden: false });
      break;
    case 'hidePost':
      await db.updatePost({ id: update.postId, hidden: true });
      break;
    case 'addPost':
      await handleAddPost(update.post, update.replyMeta);
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

let lastAdded: string;

export async function handleAddPost(
  post: db.Post,
  replyMeta?: db.ReplyMeta | null
) {
  // We frequently get duplicate addPost events from the api,
  // so skip if we've just added this.
  if (post.id === lastAdded) {
    logger.log('skipping duplicate post.');
  } else {
    lastAdded = post.id;
  }

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
        replyMeta,
      });
    }
    await db.insertChannelPosts({
      channelId: post.channelId,
      posts: [post],
    });
  } else {
    const older = channelCursors.get(post.channelId);
    addToChannelPosts(post, older);
    updateChannelCursor(post.channelId, post.id);
    await db.insertChannelPosts({
      channelId: post.channelId,
      posts: [post],
      older,
    });
  }
}

export async function syncHiddenPosts(reporter: ErrorReporter) {
  const hiddenPosts = await syncQueue.add(
    'hiddenPosts',
    SyncPriority.High,
    () => api.getHiddenPosts()
  );
  reporter?.log('got hidden channel posts data from api');
  const hiddenDMPosts = await syncQueue.add(
    'hiddenDMPosts',
    SyncPriority.High,
    () => api.getHiddenDMPosts()
  );
  reporter?.log('got hidden dm posts data from api');
  handleReceivedHiddenPosts({
    reporter,
    hiddenPostIds: [...hiddenPosts, ...hiddenDMPosts],
  });
}

export async function handleReceivedHiddenPosts({
  reporter,
  hiddenPostIds,
}: {
  reporter?: ErrorReporter;
  hiddenPostIds: string[];
}) {
  const currentHiddenPosts = await db.getHiddenPosts();

  // if the user deleted the posts from another client while we were offline,
  // we should remove them from our hidden posts list
  currentHiddenPosts.forEach(async (hiddenPost) => {
    if (!hiddenPostIds.some((postId) => postId === hiddenPost.id)) {
      reporter?.log(`deleting hidden post ${hiddenPost.id}`);
      await db.updatePost({ id: hiddenPost.id, hidden: false });
    }
  });

  await db.insertHiddenPosts(hiddenPostIds);
  reporter?.log('inserted hidden posts');
}

export async function syncPosts(
  options: api.GetChannelPostsOptions,
  priority = SyncPriority.Medium
) {
  logger.log(
    'syncing posts',
    `${options.channelId}/${options.cursor}/${options.mode}`
  );
  const response = await syncQueue.add('channelPosts', priority, () =>
    api.getChannelPosts(options)
  );
  if (response.posts.length) {
    await db.insertChannelPosts({
      channelId: options.channelId,
      posts: response.posts,
      newer: response.newer,
      older: response.older,
    });
  }
  if (!response.newer) {
    await db.updateChannel({
      id: options.channelId,
      syncedAt: Date.now(),
    });
  }

  return response;
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
    await syncPosts({ channelId, mode: 'newest' }, SyncPriority.High);

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

export const clearSyncQueue = () => {
  // TODO: Model all sync functions as syncQueue.add calls so that this works on
  // more than just `syncStaleChannels`
  syncQueue.clear();
};

/*
  If there's a gap in time where we weren't subscribed to changes, we need to
  make sure our local data remains up to date. For now, this focuses on immediate
  concerns and punts on full correctness.
*/
export const handleDiscontinuity = async () => {
  updateSession(null);

  // drop potentially outdated newest post markers
  channelCursors.clear();

  // clear any existing channel queries
  clearChannelPostsQueries();

  // finally, refetch start data
  await syncStart(true);
};

export const syncStart = async (alreadySubscribed?: boolean) => {
  const reporter = new ErrorReporter('sync start', logger);
  try {
    reporter.log(`sync start running${alreadySubscribed ? ' (recovery)' : ''}`);
    // highest priority, do immediately
    await withRetry(() => syncInitData(reporter));
    reporter.log(`finished syncing init data`);
    await withRetry(() => syncHiddenPosts(reporter));
    reporter.log(`finished syncing hidden posts`);

    await withRetry(() => syncChannelHeads(reporter));
    reporter.log(`finished syncing latest posts`);

    await withRetry(() =>
      Promise.all([
        syncContacts(SyncPriority.High).then(() =>
          reporter.log(`finished syncing contacts`)
        ),
        resetActivity().then(() => reporter.log(`finished resetting activity`)),
      ])
    );

    if (!alreadySubscribed) {
      await withRetry(() => setupSubscriptions());
      reporter.log(`subscriptions setup`);
    } else {
      reporter.log(`already subscribed, skipping`);
    }
    updateSession({ startTime: Date.now() });

    await withRetry(() =>
      Promise.all([
        syncSettings().then(() => reporter.log(`finished syncing settings`)),
        syncVolumeSettings().then(() =>
          reporter.log(`finished syncing volume settings`)
        ),
        syncStorageSettings().then(() =>
          reporter.log(`finished initializing storage`)
        ),
        syncPushNotificationsSetting().then(() =>
          reporter.log(`finished syncing push notifications setting`)
        ),
        syncBlockedUsers().then(() => {
          reporter.log(`finished syncing blocked users`);
        }),
        syncAppInfo().then(() => {
          reporter.log(`finished syncing app info`);
        }),
      ])
    );

    reporter.log('sync start complete');
  } catch (e) {
    reporter.report(e);
    logger.warn('INITIAL SYNC FAILED', e);
    throw e;
  }
};

export const setupSubscriptions = async () => {
  await Promise.all([
    api.subscribeToActivity(createActivityUpdateHandler()),
    api.subscribeGroups(handleGroupUpdate),
    api.subscribeToChannelsUpdates(handleChannelsUpdate),
    api.subscribeToChatUpdates(handleChatUpdate),
    api.subscribeToContactUpdates(handleContactUpdate),
  ]);
};
