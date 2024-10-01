import { ChannelStatus } from '@urbit/http-api';
import { backOff } from 'exponential-backoff';
import _ from 'lodash';

import * as api from '../api';
import { GetChangedPostsOptions } from '../api';
import * as db from '../db';
import { QueryCtx, batchEffects } from '../db/query';
import { createDevLogger, runIfDev } from '../debug';
import { extractClientVolumes } from '../logic/activity';
import {
  INFINITE_ACTIVITY_QUERY_KEY,
  resetActivityFetchers,
} from '../store/useActivityFetchers';
import { ErrorReporter } from './errorReporting';
import { useLureState } from './lure';
import { updateIsSyncing, updateSession } from './session';
import { SyncCtx, SyncPriority, syncQueue } from './syncQueue';
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

export const syncInitData = async (
  reporter?: ErrorReporter,
  syncCtx?: SyncCtx,
  queryCtx?: QueryCtx,
  yieldWriter?: boolean
): Promise<() => Promise<void>> => {
  const initData = await syncQueue.add('init', syncCtx, () =>
    api.getInitData()
  );
  reporter?.log('got init data from api');
  initializeJoinedSet(initData.unreads);
  useLureState.getState().start();

  const writer = async () => {
    await db
      .insertGroups({ groups: initData.groups }, queryCtx)
      .then(() => reporter?.log('inserted groups'));
    await db
      .insertUnjoinedGroups(initData.unjoinedGroups, queryCtx)
      .then(() => reporter?.log('inserted unjoined groups'));

    await db
      .insertChannels(initData.channels, queryCtx)
      .then(() => reporter?.log('inserted channels'));
    await persistUnreads({
      unreads: initData.unreads,
      ctx: queryCtx,
      includesAllUnreads: true,
    }).then(() => reporter?.log('persisted unreads'));

    await db
      .insertPinnedItems(initData.pins, queryCtx)
      .then(() => reporter?.log('inserted pinned items'));

    await db
      .resetHiddenPosts(initData.hiddenPostIds, queryCtx)
      .then(() => reporter?.log('handled hidden posts'));
    await db
      .insertBlockedContacts({ blockedIds: initData.blockedUsers }, queryCtx)
      .then(() => reporter?.log('inserted blocked users'));

    await db
      .insertChannelPerms(initData.channelPerms, queryCtx)
      .then(() => reporter?.log('inserted channel perms'));
    await db
      .setLeftGroups({ joinedGroupIds: initData.joinedGroups }, queryCtx)
      .then(() => reporter?.log('set left groups'));
    await db
      .setLeftGroupChannels(
        { joinedChannelIds: initData.joinedChannels },
        queryCtx
      )
      .then(() => reporter?.log('set left channels'));
  };

  if (yieldWriter) {
    return writer;
  } else {
    await writer();
    return () => Promise.resolve();
  }
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

export const syncBlockedUsers = async (ctx?: SyncCtx) => {
  const blockedIds = await syncQueue.add('getBlockedUsers', ctx, () =>
    api.getBlockedUsers()
  );
  await db.insertBlockedContacts({ blockedIds });
};

export const syncLatestPosts = async (
  reporter?: ErrorReporter,
  ctx?: SyncCtx,
  queryCtx?: QueryCtx,
  yieldWriter?: boolean
): Promise<() => Promise<void>> => {
  const result = await syncQueue.add('latestPosts', ctx, () =>
    api.getLatestPosts({})
  );
  reporter?.log('got latest posts from api');
  const allPosts = result.map((p) => p.latestPost);
  const writer = async (): Promise<void> => {
    allPosts.forEach((p) => updateChannelCursor(p.channelId, p.id));
    await db.insertLatestPosts(allPosts, queryCtx);
  };

  if (yieldWriter) {
    return writer;
  } else {
    await writer();
    return () => Promise.resolve();
  }
};

export const syncSettings = async (ctx?: SyncCtx) => {
  const settings = await syncQueue.add('settings', ctx, () =>
    api.getSettings()
  );
  return db.insertSettings(settings);
};

export const syncAppInfo = async (ctx?: SyncCtx) => {
  const appInfo = await syncQueue.add('appInfo', ctx, () => api.getAppInfo());
  return db.setAppInfoSettings(appInfo);
};

export const syncVolumeSettings = async (ctx?: SyncCtx) => {
  const volumeSettings = await syncQueue.add('volumeSettings', ctx, () =>
    api.getVolumeSettings()
  );
  const clientVolumes = extractClientVolumes(volumeSettings);
  await db.setVolumes({ volumes: clientVolumes, deleteOthers: true });
};

export const syncContacts = async (ctx?: SyncCtx) => {
  const contacts = await syncQueue.add('contacts', ctx, () =>
    api.getContacts()
  );
  await db.insertContacts(contacts);
};

export const syncPinnedItems = async (ctx?: SyncCtx) => {
  logger.log('syncing pinned items');
  const pinnedItems = await syncQueue.add('pinnedItems', ctx, () =>
    api.getPinnedItems()
  );
  logger.log('got pinned items from api', pinnedItems.length);
  await db.insertPinnedItems(pinnedItems);
};

export const syncGroups = async (ctx?: SyncCtx) => {
  const groups = await syncQueue.add('groups', ctx, () =>
    api.getGroups({ includeMembers: false })
  );
  await db.insertGroups({ groups: groups });
};

export const syncDms = async (ctx?: SyncCtx) => {
  const [dms, groupDms] = await syncQueue.add('dms', ctx, () =>
    Promise.all([api.getDms(), api.getGroupDms()])
  );
  await db.insertChannels([...dms, ...groupDms]);
};

export const syncUnreads = async (ctx?: SyncCtx) => {
  const unreads = await syncQueue.add('unreads', ctx, () =>
    api.getGroupAndChannelUnreads()
  );
  checkForNewlyJoined(unreads);
  return batchEffects('initialUnreads', (ctx) =>
    persistUnreads({ unreads, ctx, includesAllUnreads: true })
  );
};

export const syncChannelThreadUnreads = async (
  channelId: string,
  ctx?: SyncCtx
) => {
  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    console.warn(
      'cannot get thread unreads for non-existent channel',
      channelId
    );
    return;
  }
  const unreads = await syncQueue.add('thread unreads', ctx, () =>
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

export async function syncUpdatedPosts(
  options: GetChangedPostsOptions,
  ctx?: SyncCtx
) {
  logger.log(
    'syncing updated posts',
    runIfDev(() => JSON.stringify(options))
  );
  const response = await syncQueue.add('syncUpdatedPosts', ctx, async () =>
    api.getChangedPosts(options)
  );
  logger.log(`got ${response.posts.length} updated posts, inserting...`);

  // ignore cursors since we're always fetching from old posts we have
  await db.insertChannelPosts({
    channelId: options.channelId,
    posts: response.posts,
  });

  return response;
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
  ctx?: SyncCtx
) {
  const response = await syncQueue.add('syncThreadPosts', ctx, () =>
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

export async function syncGroup(id: string, ctx?: SyncCtx) {
  const response = await syncQueue.add('syncGroup', ctx, () =>
    api.getGroup(id)
  );
  await db.insertGroups({ groups: [response] });
}

export const syncStorageSettings = (ctx?: SyncCtx) => {
  return Promise.all([
    syncQueue
      .add('storageSettings', ctx, () => api.getStorageConfiguration())
      .then((config) => db.setStorageConfiguration(config)),
    syncQueue
      .add('storageCredentials', ctx, () => api.getStorageCredentials())
      .then((creds) => db.setStorageCredentials(creds)),
  ]);
};

export const persistUnreads = async ({
  unreads,
  ctx,
  includesAllUnreads,
}: {
  unreads: api.ActivityInit;
  ctx?: QueryCtx;
  includesAllUnreads?: boolean;
}) => {
  const { groupUnreads, channelUnreads, threadActivity } = unreads;
  await db.insertGroupUnreads(groupUnreads, ctx);
  await db.insertChannelUnreads(channelUnreads, ctx);
  await db.insertThreadUnreads(threadActivity, ctx);

  // if we have all channel unreads, we should use that data to update which
  // channels we're joined to
  if (includesAllUnreads) {
    await db.setJoinedGroupChannels(
      {
        channelIds: channelUnreads
          .filter((u) => u.type === 'channel')
          .map((u) => u.channelId),
      },
      ctx
    );
  }
};

export const resetActivity = async (syncCtx?: SyncCtx) => {
  const { relevantUnreads, events } = await syncQueue.add(
    'getInitialActivity',
    syncCtx,
    () => api.getInitialActivity()
  );
  await batchEffects('resetActivity', async (ctx) => {
    await db.clearActivityEvents(ctx);
    await db.insertActivityEvents(events, ctx);
    await persistUnreads({ unreads: relevantUnreads, ctx });
  });
  resetActivityFetchers();
};

export const syncPushNotificationsSetting = async (ctx?: SyncCtx) => {
  const setting = await syncQueue.add('getPushNotificationSettings', ctx, () =>
    api.getPushNotificationsSetting()
  );
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
    case 'groupJoinRequest':
      await db.addGroupJoinRequests({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'revokeGroupJoinRequests':
      await db.deleteGroupJoinRequests({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      break;
    case 'banGroupMembers':
      await db.addGroupMemberBans({
        groupId: update.groupId,
        contactIds: update.ships,
      });
      await db.removeChatMembers({
        chatId: update.groupId,
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
        await db.setVolumes({ volumes: activitySnapshot.volumeUpdates }, ctx);
        await db.insertActivityEvents(activitySnapshot.activityEvents, ctx);
      });

      // if we inserted new activity, invalidate the activity page
      // data loader
      if (activitySnapshot.activityEvents.length > 0) {
        api.queryClient.invalidateQueries({
          queryKey: [INFINITE_ACTIVITY_QUERY_KEY],
          refetchType: 'active',
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

export const handleStorageUpdate = async (update: api.StorageUpdate) => {
  switch (update.type) {
    case 'storageCredentialsChanged': {
      await db.setStorageCredentials(update.credentials);
      break;
    }
    case 'storageCongfigurationChanged': {
      await db.setStorageConfiguration(update.configuration);
      break;
    }
    case 'storageAccessKeyIdChanged': {
      await db.updateStorageCredentials({
        accessKeyId: update.setAccessKeyId,
      });
      break;
    }
    case 'storageSecretAccessKeyChanged': {
      await db.updateStorageCredentials({
        secretAccessKey: update.setSecretAccessKey,
      });
      break;
    }
    case 'storageRegionChanged': {
      await db.updateStorageConfiguration({
        region: update.setRegion,
      });
      break;
    }
    case 'storageServiceToggled': {
      // TODO: is this right???
      await db.toggleStorageService(update.toggleService);
      break;
    }
    case 'storagePresignedUrlChanged': {
      await db.updateStorageConfiguration({
        presignedUrl: update.setPresignedUrl,
      });
      break;
    }
    case 'storageCurrentBucketChanged': {
      await db.updateStorageConfiguration({
        currentBucket: update.setCurrentBucket,
      });
      break;
    }
    case 'storageBucketAdded': {
      await db.addStorageBucket(update.addBucket);
      break;
    }
    case 'storageBucketRemoved': {
      await db.removeStorageBucket(update.removeBucket);
      break;
    }
    case 'storageEndpointChanged': {
      await db.updateStorageCredentials({
        endpoint: update.setEndpoint,
      });
      break;
    }
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
      await db.markPostAsDeleted(update.postId);
      await db.updateChannel({ id: update.channelId, lastPostId: null });
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
  logger.log('event: add post', post);
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

export async function syncPosts(
  options: api.GetChannelPostsOptions,
  ctx?: SyncCtx
) {
  logger.log(
    'syncing posts',
    `${options.channelId}/${options.cursor}/${options.mode}`
  );
  const response = await syncQueue.add('channelPosts', ctx, () =>
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

  if (response.deletedPosts?.length) {
    if (options.count && response.deletedPosts.length === options.count) {
      // if the number of deleted ("null") posts matches the requested count,
      // we should fetch more posts to ensure we're not missing any.
      // if we don't do this, we may assume we're up to date when we're not.
      await syncPosts(
        {
          ...options,
          count: options.count * 2,
        },
        ctx
      );
    }
  }

  if (!response.newer) {
    await db.updateChannel({
      id: options.channelId,
      syncedAt: Date.now(),
    });
  }

  return response;
}

export async function syncGroupPreviews(groupIds: string[]) {
  const promises = groupIds.map(async (groupId) => {
    const group = await db.getGroup({ id: groupId });
    if (group?.currentUserIsMember) {
      return group;
    }

    const groupPreview = await api.getGroupPreview(groupId);
    await db.insertUnjoinedGroups([groupPreview]);
    return groupPreview;
  });

  return Promise.all(promises);
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
    logger.crumb(`all messages in channel are delivered`);
    logger.sensitiveCrumb(`channelId: ${channelId}`);
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
    await syncPosts(
      { channelId, mode: 'newest' },
      { priority: SyncPriority.High }
    );

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

export const handleChannelStatusChange = async (status: ChannelStatus) => {
  if (status === 'reconnecting') {
    updateSession({ isReconnecting: true });
  } else if (status === 'reconnected')
    updateSession({
      isReconnecting: false,
    });
};

export const syncStart = async (alreadySubscribed?: boolean) => {
  updateIsSyncing(true);
  const reporter = new ErrorReporter('sync start', logger);
  reporter.log(`sync start running${alreadySubscribed ? ' (recovery)' : ''}`);

  batchEffects('sync start (high)', async (ctx) => {
    // this allows us to run the api calls first in parallel but handle
    // writing the data in a specific order
    const yieldWriter = true;

    // first kickoff the fetching
    const syncInitPromise = syncInitData(
      reporter,
      { priority: SyncPriority.High, retry: true },
      ctx,
      yieldWriter
    );
    const syncLatestPostsPromise = syncLatestPosts(
      reporter,
      {
        priority: SyncPriority.High,
        retry: true,
      },
      ctx,
      yieldWriter
    );
    const subsPromise = alreadySubscribed
      ? Promise.resolve()
      : setupHighPrioritySubscriptions({
          priority: SyncPriority.High - 1,
        }).then(() => reporter.log('subscribed high priority'));

    // then enforce the ordering of writes to avoid race conditions
    const initWriter = await syncInitPromise;
    await initWriter();
    reporter.log('finished writing init data');

    const latestPostsWriter = await syncLatestPostsPromise;
    await latestPostsWriter();
    reporter.log('finished writing latest posts');

    await subsPromise;
    reporter.log('finished initializing high priority subs');

    reporter.log(`finished high priority init sync`);
    updateSession({ startTime: Date.now() });
  });

  const lowPriorityPromises = [
    alreadySubscribed
      ? Promise.resolve()
      : setupLowPrioritySubscriptions({
          priority: SyncPriority.Medium,
        }).then(() => reporter.log('subscribed low priority')),
    resetActivity({ priority: SyncPriority.Medium + 1, retry: true }).then(() =>
      reporter.log(`finished resetting activity`)
    ),
    syncContacts({ priority: SyncPriority.Medium + 1, retry: true }).then(() =>
      reporter.log(`finished syncing contacts`)
    ),
    syncSettings({ priority: SyncPriority.Medium }).then(() =>
      reporter.log(`finished syncing settings`)
    ),
    syncVolumeSettings({ priority: SyncPriority.Low }).then(() =>
      reporter.log(`finished syncing volume settings`)
    ),
    syncStorageSettings({ priority: SyncPriority.Low }).then(() =>
      reporter.log(`finished initializing storage`)
    ),
    syncPushNotificationsSetting({ priority: SyncPriority.Low }).then(() =>
      reporter.log(`finished syncing push notifications setting`)
    ),
    syncAppInfo({ priority: SyncPriority.Low }).then(() => {
      reporter.log(`finished syncing app info`);
    }),
  ];

  await Promise.all(lowPriorityPromises)
    .then(() => {
      reporter.log(`finished low priority sync`);
    })
    .catch((e) => {
      reporter.report(e);
    });

  updateIsSyncing(false);
};

export const setupHighPrioritySubscriptions = async (ctx?: SyncCtx) => {
  return syncQueue.add('setupHighPrioritySubscriptions', ctx, () => {
    return Promise.all([
      api.subscribeToChannelsUpdates(handleChannelsUpdate),
      api.subscribeToChatUpdates(handleChatUpdate),
    ]);
  });
};

export const setupLowPrioritySubscriptions = async (ctx?: SyncCtx) => {
  return syncQueue.add('setupLowPrioritySubscription', ctx, () => {
    return Promise.all([
      api.subscribeToActivity(createActivityUpdateHandler()),
      api.subscribeGroups(handleGroupUpdate),
      api.subscribeToContactUpdates(handleContactUpdate),
      api.subscribeToStorageUpdates(handleStorageUpdate),
    ]);
  });
};
