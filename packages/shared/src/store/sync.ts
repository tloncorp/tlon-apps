import { ChannelStatus } from '@urbit/http-api';
import { backOff } from 'exponential-backoff';
import _ from 'lodash';

import * as api from '../api';
import { GetChangedPostsOptions } from '../api';
import * as db from '../db';
import { QueryCtx, batchEffects } from '../db/query';
import { SETTINGS_SINGLETON_KEY } from '../db/schema';
import { createDevLogger, runIfDev } from '../debug';
import { AnalyticsEvent } from '../domain';
import { extractClientVolumes } from '../logic/activity';
import {
  INFINITE_ACTIVITY_QUERY_KEY,
  resetActivityFetchers,
} from '../store/useActivityFetchers';
import * as LocalCache from './cachedData';
import { addChannelToNavSection, moveChannel } from './groupActions';
import { verifyUserInviteLink } from './inviteActions';
import { useLureState } from './lure';
import { Session, getSession, updateSession } from './session';
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
  syncCtx?: SyncCtx,
  queryCtx?: QueryCtx,
  yieldWriter?: boolean
): Promise<() => Promise<void>> => {
  const initData = await syncQueue.add('init', syncCtx, () =>
    api.getInitData()
  );
  logger.crumb('got init data from api');
  initializeJoinedSet(initData.unreads);
  useLureState.getState().start();

  const writer = async () => {
    await db
      .insertGroups({ groups: initData.groups }, queryCtx)
      .then(() => logger.crumb('inserted groups'));
    await db
      .insertUnjoinedGroups(initData.unjoinedGroups, queryCtx)
      .then(() => logger.crumb('inserted unjoined groups'));

    await db
      .insertChannels(initData.channels, queryCtx)
      .then(() => logger.crumb('inserted channels'));
    await persistUnreads({
      unreads: initData.unreads,
      ctx: queryCtx,
      includesAllUnreads: true,
    }).then(() => logger.crumb('persisted unreads'));

    await db
      .insertPinnedItems(initData.pins, queryCtx)
      .then(() => logger.crumb('inserted pinned items'));

    await db
      .resetHiddenPosts(initData.hiddenPostIds, queryCtx)
      .then(() => logger.crumb('handled hidden posts'));
    await db
      .insertBlockedContacts({ blockedIds: initData.blockedUsers }, queryCtx)
      .then(() => logger.crumb('inserted blocked users'));

    await db
      .insertChannelPerms(initData.channelPerms, queryCtx)
      .then(() => logger.crumb('inserted channel perms'));
    await db
      .setLeftGroups({ joinedGroupIds: initData.joinedGroups }, queryCtx)
      .then(() => logger.crumb('set left groups'));
    await db
      .setLeftGroupChannels(
        { joinedChannelIds: initData.joinedChannels },
        queryCtx
      )
      .then(() => logger.crumb('set left channels'));
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
  ctx?: SyncCtx,
  queryCtx?: QueryCtx,
  yieldWriter?: boolean
): Promise<() => Promise<void>> => {
  const syncedAt = await db.headsSyncedAt.getValue();
  const result = await syncQueue.add('latestPosts', ctx, () =>
    api.getLatestPosts({
      afterCursor: new Date(syncedAt),
    })
  );
  logger.crumb('got latest posts from api');
  const allPosts = result.map((p) => p.latestPost);
  const writer = async (): Promise<void> => {
    allPosts.forEach((p) => updateChannelCursor(p.channelId, p.id));
    await db.insertLatestPosts(allPosts, queryCtx);
    await db.headsSyncedAt.setValue(Date.now());
  };

  if (yieldWriter) {
    return writer;
  } else {
    await writer();
    return () => Promise.resolve();
  }
};

/**
 * Syncs a subset of channels' latest posts; attempts to match the behavior of `useChannelPosts`.
 *
 * This is a best-effort attempt at preloading channels, and should only be
 * executed with a low priority `SyncCtx` to ensure that syncing a channel that
 * the user is looking at can interrupt this.
 * This function internally enqueues work on the sync queue; do not
 * explicitly enqueue this function, or else sync threads will get clogged up.
 */
const syncRelevantChannelPosts = async (
  ctx?: SyncCtx,
  queryCtx?: QueryCtx
): Promise<void> => {
  const session = getSession();
  if (session == null) {
    throw new Error('Missing session');
  }
  const channelsToSync = await db.getChannelsForPredictiveSync(
    { session, limit: 20 },
    queryCtx
  );

  const errors: { [channelId: string]: unknown } = {};
  for (const channel of channelsToSync) {
    try {
      await fillChannelGap({
        channelId: channel.id,
        getSession,
        syncCtx: ctx,
      });
    } catch (err) {
      logger.error('error syncing channel', channel.id, err);
      errors[channel.id] = err;
    }
  }
  if (Object.keys(errors).length === channelsToSync.length) {
    throw new Error('Failed predictive sync', errors);
  }
};

export const syncSettings = async (ctx?: SyncCtx) => {
  const settings = await syncQueue.add('settings', ctx, () =>
    api.getSettings()
  );
  logger.log('got settings from api', settings);
  return db.insertSettings(settings);
};

export const syncAppInfo = async (ctx?: SyncCtx) => {
  const appInfo = await syncQueue.add('appInfo', ctx, () => api.getAppInfo());
  return db.appInfo.setValue(appInfo);
};

export const syncVolumeSettings = async (ctx?: SyncCtx) => {
  const volumeSettings = await syncQueue.add('volumeSettings', ctx, () =>
    api.getVolumeSettings()
  );
  const clientVolumes = extractClientVolumes(volumeSettings);
  await db.setVolumes({ volumes: clientVolumes, deleteOthers: true });
};

export const syncContacts = async (ctx?: SyncCtx, yieldWriter = false) => {
  const contacts = await syncQueue.add('contacts', ctx, () =>
    api.getContacts()
  );
  logger.log('got contacts from api', contacts);

  const writer = async () => {
    try {
      await db.insertContacts(contacts);
      LocalCache.cacheContacts(contacts);
    } catch (e) {
      logger.error('error inserting contacts', e);
    }
  };

  if (yieldWriter) {
    return writer;
  } else {
    await writer();
    return () => Promise.resolve();
  }
};

export const syncUserAttestations = async (ctx?: SyncCtx) => {
  logger.log('syncing verifications');
  try {
    const attestations = await syncQueue.add('attestations', ctx, () =>
      api.fetchUserAttestations()
    );

    try {
      await db.insertCurrentUserAttestations({ attestations });
    } catch (e) {
      logger.trackEvent('Error Inserting Lanyard Verifications', {
        message: e.message,
      });
    }
  } catch (e) {
    logger.trackError('Error Fetching Lanyard Verifications', e);
  }
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
  const existingUnreads = await db.getThreadUnreadsByChannel({ channelId });

  // filter out any unreads that we already have in the db so we can avoid
  // invalidating queries that don't need to be invalidated
  const newUnreads = unreads.filter((unread) => {
    const existing = existingUnreads.find(
      (u) => u.threadId === unread.threadId
    );

    if (!existing) {
      return true;
    }

    return !_.isEqual(unread, existing);
  });

  if (newUnreads.length === 0) {
    return;
  }

  await db.insertThreadUnreads(newUnreads);
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

  await db.deletePosts({
    ids: response.deletedPosts ?? [],
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
  logger.log('got thread posts from api', response);
  await db.insertChannelPosts({
    channelId,
    posts: [response, ...(response.replies ?? [])],
  });
}

const groupSyncsInProgress = new Set<string>();

export async function syncGroup(id: string, ctx?: SyncCtx) {
  if (groupSyncsInProgress.has(id)) {
    return;
  }
  groupSyncsInProgress.add(id);
  try {
    const group = await db.getGroup({ id });
    const session = getSession();
    if (group && session && (session.startTime ?? 0) < (group.syncedAt ?? 0)) {
      return;
    }
    const response = await syncQueue.add('syncGroup', ctx, () =>
      api.getGroup(id)
    );
    await batchEffects('syncGroup', async (ctx) => {
      await db.insertGroups({ groups: [response] }, ctx);
      await db.updateGroup({ id, syncedAt: Date.now() }, ctx);
    });
  } catch (e) {
    logger.trackError('group sync failed', { errorMessage: e.message });
    throw e;
  } finally {
    groupSyncsInProgress.delete(id);
  }
}

export const syncStorageSettings = (ctx?: SyncCtx) => {
  return Promise.all([
    syncQueue
      .add('storageSettings', ctx, () => api.getStorageConfiguration())
      .then((config) => db.storageConfiguration.setValue(config)),
    syncQueue
      .add('storageCredentials', ctx, () => api.getStorageCredentials())
      .then((creds) => db.storageCredentials.setValue(creds)),
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
  const { baseUnread, groupUnreads, channelUnreads, threadActivity } = unreads;
  if (baseUnread) {
    await db.insertBaseUnread(baseUnread, ctx);
  }
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
  await db.pushNotificationSettings.setValue(setting);
};

async function handleLanyardUpdate(update: api.LanyardUpdate) {
  logger.log('received lanyard update', update.type);
  switch (update.type) {
    // for right now, we'll handle any subscription event as a signal to resync
    default:
      logger.log('resyncing attestations');
      await syncUserAttestations();
  }
}

async function handleGroupUpdate(update: api.GroupUpdate) {
  logger.log('received group update', update.type);

  let channelNavSection: db.GroupNavSectionChannel | null | undefined;
  let group: db.Group | null | undefined;

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
    case 'setGroupAsOpen':
      await db.updateGroup({ id: update.groupId, privacy: 'public' });
      break;
    case 'setGroupAsShut':
      group = await db.getGroup({ id: update.groupId });

      if (group?.privacy !== 'secret') {
        await db.updateGroup({ id: update.groupId, privacy: 'private' });
      }
      break;
    case 'setGroupAsSecret':
      await db.updateGroup({ id: update.groupId, privacy: 'secret' });
      break;
    case 'setGroupAsNotSecret':
      group = await db.getGroup({ id: update.groupId });
      await db.updateGroup({
        id: update.groupId,
        privacy: group?.privacy === 'public' ? 'public' : 'private',
      });
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
    case 'addGroupMembersToRole': {
      await db.addChatMembersToRoles({
        groupId: update.groupId,
        contactIds: update.ships,
        roleIds: update.roles,
      });
      await syncGroup(update.groupId);
      await syncUnreads();
      break;
    }
    case 'removeGroupMembersFromRole': {
      await db.removeChatMembersFromRoles({
        groupId: update.groupId,
        contactIds: update.ships,
        roleIds: update.roles,
      });
      await syncGroup(update.groupId);
      await syncUnreads();
      break;
    }
    case 'addChannel': {
      await db.insertChannels([update.channel]);
      if (update.channel.groupId) {
        await syncGroup(update.channel.groupId);
        await syncUnreads();
      }
      break;
    }
    case 'updateChannel': {
      await db.updateChannel(update.channel);
      if (update.channel.groupId) {
        await syncGroup(update.channel.groupId);
        await syncUnreads();
      }
      break;
    }
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

      await db.deleteChannels([update.channelId]);
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
      await moveChannel({
        channelId: update.channelId,
        groupId: update.groupId,
        navSectionId: update.sectionId,
        index: update.index,
      });
      break;
    case 'addChannelToNavSection':
      logger.log('adding channel to nav section', update);

      await addChannelToNavSection({
        channelId: update.channelId,
        groupId: update.groupId,
        navSectionId: update.sectionId,
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
    baseUnread: undefined,
    groupUnreads: [],
    channelUnreads: [],
    threadUnreads: [],
    volumeUpdates: [],
    activityEvents: [],
  };
  const processQueue = _.debounce(
    async () => {
      const activitySnapshot = _.cloneDeep(queue);
      queue.baseUnread = undefined;
      queue.groupUnreads = [];
      queue.channelUnreads = [];
      queue.threadUnreads = [];
      queue.volumeUpdates = [];
      queue.activityEvents = [];

      logger.log(
        `processing activity queue`,
        activitySnapshot.baseUnread,
        activitySnapshot.groupUnreads.length,
        activitySnapshot.channelUnreads.length,
        activitySnapshot.threadUnreads.length,
        activitySnapshot.volumeUpdates.length,
        activitySnapshot.activityEvents.length
      );
      await batchEffects('activityUpdate', async (ctx) => {
        if (activitySnapshot.baseUnread) {
          await db.insertBaseUnread(activitySnapshot.baseUnread, ctx);
        }
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
      // WARNING -- removing this will break loading of initial channnels on
      // group join. Shouldn't be the case, but here we are.
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
      case 'updateBaseUnread':
        queue.baseUnread = event.unread;
        break;
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
        db.pushNotificationSettings.setValue(event.value);
        break;
    }
    processQueue();
  };
};

export const handleContactUpdate = async (update: api.ContactsUpdate) => {
  switch (update.type) {
    case 'upsertContact':
      await db.upsertContact(update.contact);
      break;

    case 'removeContact':
      await db.updateContact({
        id: update.contactId,
        isContact: false,
        customNickname: null,
        customAvatarImage: null,
      });
      break;
  }
};

export const handleStorageUpdate = async (update: api.StorageUpdate) => {
  switch (update.type) {
    case 'storageCredentialsChanged': {
      await db.storageCredentials.setValue(update.credentials);
      break;
    }
    case 'storageCongfigurationChanged': {
      await db.storageConfiguration.setValue(update.configuration);
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

export const handleSettingsUpdate = async (update: api.SettingsUpdate) => {
  switch (update.type) {
    case 'updateSetting':
      await db.insertSettings({
        id: SETTINGS_SINGLETON_KEY,
        ...update.setting,
      });
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
      channelId: post.channelId,
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

export async function syncChannelPreivews(channelIds: string[]) {
  const promises = channelIds.map(async (channelId) => {
    const channel = await db.getChannelWithRelations({ id: channelId });
    if (channel) {
      return channel;
    }

    const channelPreview = await api.getChannelPreview(channelId);
    if (!channelPreview) {
      return;
    }
    await db.insertChannels([channelPreview]);
    return channelPreview;
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
  logger.trackEvent(AnalyticsEvent.SyncDiscontinuity);
  if (isSyncing) {
    // we probably don't want to do this while we're already syncing
    return;
  }
  updateSession(null);

  // drop potentially outdated newest post markers
  channelCursors.clear();

  // clear any existing channel queries
  clearChannelPostsQueries();

  // finally, refetch start data
  await syncStart(true);
};

export const handleChannelStatusChange = async (status: ChannelStatus) => {
  // Since Eyre doesn't send a response body when opening an event
  // source request, the reconnect request won't resolve until we get a new fact
  // or a heartbeat. We call this method to manually trigger a fact -- anything
  // that does so would work.
  //
  // Eyre issue is fixed in this PR, https://github.com/urbit/urbit/pull/7080,
  // we should remove this hack once 410 is rolled out.
  if (status === 'reconnecting') {
    api.checkExistingUserInviteLink();
  }
  updateSession({ channelStatus: status });
};

let isSyncing = false;

export const syncStart = async (alreadySubscribed?: boolean) => {
  if (isSyncing) {
    // we probably don't want multiple sync starts
    return;
  }
  isSyncing = true;

  const startTime = Date.now();
  logger.crumb(`sync start running${alreadySubscribed ? ' (recovery)' : ''}`);

  let didLoadCachedContacts = false;

  try {
    await batchEffects('sync start (high)', async (ctx) => {
      // this allows us to run the api calls first in parallel but handle
      // writing the data in a specific order
      const yieldWriter = true;

      // first kickoff the fetching
      const syncInitPromise = syncInitData(
        { priority: SyncPriority.High, retry: true },
        ctx,
        yieldWriter
      );
      const syncLatestPostsPromise = syncLatestPosts(
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
          }).then(() => logger.crumb('subscribed high priority'));

      didLoadCachedContacts = await LocalCache.loadCachedContacts();
      // if we don't have cached contacts, we need to load them with high priority
      const syncContactsPromise = didLoadCachedContacts
        ? () => Promise.resolve()
        : syncContacts(
            { priority: SyncPriority.High, retry: true },
            yieldWriter
          );

      const trackStep = (function () {
        let last = Date.now();
        return (event: AnalyticsEvent) => {
          const now = Date.now();
          logger.trackEvent(event, { duration: now - last });
          last = now;
        };
      })();

      // then enforce the ordering of writes to avoid race conditions
      const initWriter = await syncInitPromise;
      trackStep(AnalyticsEvent.InitDataFetched);
      await initWriter();
      trackStep(AnalyticsEvent.InitDataWritten);
      logger.crumb('finished writing init data');

      const latestPostsWriter = await syncLatestPostsPromise;
      trackStep(AnalyticsEvent.LatestPostsFetched);
      await latestPostsWriter();
      trackStep(AnalyticsEvent.LatestPostsWritten);
      logger.crumb('finished writing latest posts');

      const contactsWriter = await syncContactsPromise;
      await contactsWriter();

      await subsPromise;
      trackStep(AnalyticsEvent.SubscriptionsEstablished);
      logger.crumb('finished initializing high priority subs');

      logger.crumb(`finished high priority init sync`);
      logger.trackEvent(AnalyticsEvent.SessionInitialized, {
        duration: Date.now() - startTime,
      });
      updateSession({ startTime: Date.now() });
    });
  } catch (err) {
    logger.trackError(AnalyticsEvent.ErrorSyncStartHighPriority, {
      errorMessage: err.message,
    });
  }

  const lowPriorityPromises = [
    alreadySubscribed
      ? Promise.resolve()
      : setupLowPrioritySubscriptions({
          priority: SyncPriority.Medium,
        }).then(() => logger.crumb('subscribed low priority')),
    resetActivity({ priority: SyncPriority.Medium + 1, retry: true }).then(() =>
      logger.crumb(`finished resetting activity`)
    ),
    // if we had cached contacts, we refresh them here with low priority
    didLoadCachedContacts
      ? syncContacts({ priority: SyncPriority.Medium + 1, retry: true }).then(
          () => logger.crumb(`finished syncing contacts`)
        )
      : Promise.resolve(),
    syncSettings({ priority: SyncPriority.Medium }).then(() =>
      logger.crumb(`finished syncing settings`)
    ),
    syncVolumeSettings({ priority: SyncPriority.Low }).then(() =>
      logger.crumb(`finished syncing volume settings`)
    ),
    syncStorageSettings({ priority: SyncPriority.Low }).then(() =>
      logger.crumb(`finished initializing storage`)
    ),
    syncPushNotificationsSetting({ priority: SyncPriority.Low }).then(() =>
      logger.crumb(`finished syncing push notifications setting`)
    ),
    syncAppInfo({ priority: SyncPriority.Low }).then(() => {
      logger.crumb(`finished syncing app info`);
    }),
    syncRelevantChannelPosts({ priority: SyncPriority.Low }).then(() => {
      logger.crumb(`finished channel predictive sync`);
    }),
  ];

  await Promise.all(lowPriorityPromises)
    .then(() => {
      logger.crumb(`finished low priority sync`);
    })
    .catch((e) => {
      logger.trackError(AnalyticsEvent.ErrorSyncStartLowPriority, {
        errorMessage: e.message,
      });
    });

  // post sync initialization work
  await verifyUserInviteLink();

  isSyncing = false;
  db.userHasCompletedFirstSync.setValue(true);
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
      api.subscribeToLanyardUpdates(handleLanyardUpdate),
      api.subscribeToSettings(handleSettingsUpdate),
    ]);
  });
};

/**
 * Requires `channel` to be up-to-date from DB.
 */
export function hasChannelCachedNewestPosts({
  session,
  channel,
}: {
  session: Session | null;
  channel: db.Channel;
}) {
  if (session == null) {
    return false;
  }
  const { syncedAt, lastPostAt } = channel;

  if (syncedAt == null) {
    return false;
  }

  // `syncedAt` is only set when sync endpoint reports that there are no newer posts.
  // https://github.com/tloncorp/tlon-apps/blob/adde000f4330af7e0a2e19bdfcb295f5eb9fe3da/packages/shared/src/store/sync.ts#L905-L910
  // We are guaranteed to have the most recent post before `syncedAt`; and
  // we are guaranteed to have the most recent post after `session.startTime`.

  // This case checks that we have overlap between sync backfill and session subscription.
  //
  //   ------------------------| syncedAt
  //     session.startTime |---------------
  if (syncedAt >= (session.startTime ?? 0)) {
    return true;
  }

  // `lastPostAt` is set with the channel's latest post during session init:
  // https://github.com/tloncorp/tlon-apps/blob/adde000f4330af7e0a2e19bdfcb295f5eb9fe3da/packages/shared/src/store/sync.ts#L1052
  //
  // Since we already checked that a session is active, this case checks
  // that we've hit `syncedAt`'s "no newer posts" at some point _after_ the
  // channel's most recent post's timestamp.
  //
  //          lastPostAt
  //              v
  //   ------------------------| syncedAt
  //
  // This check would fail if we first caught up via sync, and then later
  // started a session: in that case, there could be missing posts between
  // `syncedAt`'s "no newer posts" and the start of the session:
  //
  //                lastPostAt (post not received)
  //                    v
  //   ----| syncedAt
  //         session.startTime |---------
  //
  // NB: In that case, we *do* have the single latest post for the channel,
  // but we'd likely be missing all other posts in the gap. Wait until we
  // filled in the gap to show posts.
  if (lastPostAt && syncedAt > lastPostAt) {
    return true;
  }
  return false;
}

/**
 * In the specified channel, fetch posts until we have cached all messages
 * between the channel's unread marker and "now". If we have no unread marker,
 * do nothing. This function does not fetch anything older than unread marker
 * (i.e. this should not fetch posts spanning to the start of the channel
 * timeline).
 */
async function fillChannelGap(opts: {
  channelId: db.Channel['id'];
  getSession: () => Session | null;
  syncCtx: SyncCtx | undefined;
}) {
  // How many syncs do we want to do before moving on to the next channel?
  // This will be hit on any channel for which the user has an unread marker,
  // and which has many unfetched newer posts in the corresponding post window
  // for the unread.
  // (example: If someone has visited a bunch of active channels in the past,
  // left the network for a while, then installs this app fresh, they'll
  // probably hit this max for every channel in the predictive sync set, since
  // there are a lot of posts to fetch between their unread marker and the most
  // recent post in each channel.)
  let maxLoops = 2;

  while (maxLoops > 0) {
    const fillResult = await stepFillChannelGap(opts);
    if (fillResult == null || fillResult.fetchedPosts.length === 0) {
      break;
    }
    maxLoops--;
  }
  if (maxLoops <= 0) {
    logger.info('Max fetches reached', opts.channelId);
  }
}

/**
 * Performs one "step" of channel backfill. Run repeatedly to fully backfill.
 * Returns `true` if there may be more to fetch.
 */
async function stepFillChannelGap({
  channelId,
  getSession,
  syncCtx,
}: {
  channelId: db.Channel['id'];
  getSession: () => Session | null;
  syncCtx: SyncCtx | undefined;
}): Promise<{
  /** ordered by sent-at, desc */
  fetchedPosts: db.Post[];
} | null> {
  const latestChannel = await db.getChannel({ id: channelId });
  if (latestChannel == null) {
    throw new Error('Missing channel');
  }
  const hasCachedNewestPosts = hasChannelCachedNewestPosts({
    session: getSession(),
    channel: latestChannel,
  });
  if (hasCachedNewestPosts) {
    // nothing left to fetch
    return null;
  }

  const baseSyncParams = {
    channelId,
    includeReplies: false,
    count: 30,
  } as const;

  const syncParams: api.GetChannelPostsOptions = await (async () => {
    const unread = await db.getChannelUnread({ channelId });
    const unreadPostId = unread?.firstUnreadPostId;
    if (unreadPostId == null) {
      // no unread - we want to bring user to newest posts
      return {
        ...baseSyncParams,
        mode: 'newest',
      };
    }

    const mainWindow = await db.getPostWindow({
      channelId,
      postId: unreadPostId,
    });
    if (mainWindow == null) {
      // unread is outside a window - we want to show the unread to the user,
      // so start fetching around the unread.
      return {
        ...baseSyncParams,
        mode: 'around',
        cursor: unreadPostId,
      };
    }

    // we know what window we want to grow - fetch newer posts
    return {
      ...baseSyncParams,
      mode: 'newer' as const,
      cursor: mainWindow.newestPostId,
    };
  })();

  const resp = await syncPosts(syncParams, syncCtx);
  return { fetchedPosts: resp.posts };
}
