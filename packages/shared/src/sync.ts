import * as api from './api';
import * as db from './db';
import { createDevLogger } from './debug';

const logger = createDevLogger('sync', false);

export const syncContacts = async () => {
  const contacts = await api.getContacts();
  await db.insertContacts(contacts);
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

export const syncPosts = async ({ type }: { type?: 'channel' | 'dm' } = {}) => {
  const staleChannels = await db.getStaleChannels();

  for (let channel of staleChannels) {
    try {
      await syncChannel(channel.id, channel.unread.updatedAt);
    } catch (e) {
      logger.log(
        'sync failed for channel id',
        channel.id,
        e instanceof Error ? e.message : ''
      );
    }
  }
};

export async function syncPostsBefore(post: db.Post) {
  if (!post.channelId) {
    throw new Error("post is missing channel, can't sync");
  }
  const postsResponse = await api.getChannelPosts(post.channelId, {
    count: 50,
    direction: 'older',
    cursor: post.id,
    includeReplies: false,
  });
  persistPagedPostData(post.channelId, postsResponse);
}

export async function syncPostsAround(post: db.Post) {
  if (!post.channelId) {
    throw new Error("post is missing channel, can't sync");
  }
  const postsResponse = await api.getChannelPosts(post.channelId, {
    count: 50,
    direction: 'around',
    cursor: post.id,
    includeReplies: false,
  });
  persistPagedPostData(post.channelId, postsResponse);
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
    const postsResponse = await api.getChannelPosts(id, {
      ...(channel.lastPostId
        ? { direction: 'newer', cursor: channel.lastPostId }
        : { direction: 'older', date: new Date() }),
      includeReplies: false,
    });
    await persistPagedPostData(channel.id, postsResponse);
    logger.log(
      'loaded',
      postsResponse.posts.length,
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
  }
  if (data.deletedPosts.length) {
    await db.deletePosts({ ids: data.deletedPosts });
  }
}

export const start = async () => {
  const enabledOperations: [string, () => Promise<void>][] = [
    ['pinnedItems', syncPinnedItems],
    ['contacts', syncContacts],
    ['groups', syncGroups],
    ['dms', syncDms],
    ['unreads', syncUnreads],
    ['posts', syncPosts],
  ];

  api.subscribeUnreads(handleUnreadUpdate);

  for (const [name, fn] of enabledOperations) {
    try {
      await runOperation(name, fn);
    } catch (e) {
      console.log(e);
    }
  }
};

async function runOperation(name: string, fn: () => Promise<void>) {
  const startTime = Date.now();
  logger.log('starting', name, Date.now());
  await fn();
  logger.log('synced', name, 'in', Date.now() - startTime + 'ms');
}
