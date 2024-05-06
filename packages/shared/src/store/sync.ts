import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as urbit from '../urbit';
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

export const handleChannelsUpdate = async (update: api.ChannelsUpdate) => {
  switch (update.type) {
    case 'addPost':
      await db.insertChannelPosts(update.post.channelId, [update.post]);
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
  api.subscribeToChannelsUpdates(handleChannelsUpdate);
};

async function runOperation(name: string, fn: () => Promise<void>) {
  const startTime = Date.now();
  logger.log('starting', name, Date.now());
  await fn();
  logger.log('synced', name, 'in', Date.now() - startTime + 'ms');
}
