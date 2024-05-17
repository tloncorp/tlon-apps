import { backOff } from 'exponential-backoff';

import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { useStorage } from './storage';
import { syncQueue } from './syncQueue';

const logger = createDevLogger('sync', false);

export const syncInitData = async (currentUserId: string) => {
  return syncQueue.add('init', async () => {
    const initData = await api.getInitData(currentUserId);
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

export const syncDms = async (currentUserId: string) => {
  const [dms, groupDms] = await Promise.all([
    api.getDms(),
    api.getGroupDms(currentUserId),
  ]);
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

async function handleUnreadUpdate(unread: db.Unread) {
  logger.log('received new unread', unread.channelId);
  await db.insertUnreads([unread]);
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

export const handleGroupsUpdate = async (update: api.GroupsUpdate) => {
  switch (update.type) {
    case 'addGroups':
      await db.insertGroups(update.groups);
      break;
    case 'deleteGroup':
      await db.deleteGroup(update.groupId);
      break;
    case 'setUnjoinedGroups':
      await db.insertUnjoinedGroups(update.groups);
      break;
    default:
      break;
  }
};

export const handleChannelsUpdate = async (update: api.ChannelsUpdate) => {
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
      }

      // finally, always insert the post itself
      await db.insertChannelPosts(update.post.channelId, [update.post]);
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

export const handleChatUpdate = async (event: api.ChatEvent) => {
  switch (event.type) {
    case 'addDmInvites':
      // make sure we have contacts for any new DMs
      await api.addContacts(
        event.channels
          .filter((chan) => chan.type === 'dm')
          .map((chan) => chan.id)
      );

      // insert the new DMs
      db.insertChannels(event.channels);
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
  const response = await api.getChannelPosts(options);
  if (response.posts.length) {
    await db.insertChannelPosts(options.channelId, response.posts);
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
  const group = await db.getGroup({ id });
  if (!group) {
    throw new Error('no local group for' + id);
  }
  const response = await api.getGroup(id);
  await db.insertGroups([response]);
}

export async function syncNewGroup(id: string) {
  const response = await api.getGroup(id);
  console.log(`syncing new group`, response);
  console.log(`num chans`, response.channels?.length);
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
  await db.insertChannelPosts(channelId, [
    response,
    ...(response.replies ?? []),
  ]);
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
    await db.insertChannelPosts(channelId, data.posts);
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
  api.subscribeToGroupsUpdates(handleGroupsUpdate);
  api.subscribeToChannelsUpdates(handleChannelsUpdate);
  api.subscribeToChatUpdates(handleChatUpdate);
  useStorage.getState().start();
};

async function runOperation(name: string, fn: () => Promise<void>) {
  const startTime = Date.now();
  logger.log('starting', name, Date.now());
  await fn();
  logger.log('synced', name, 'in', Date.now() - startTime + 'ms');
}
