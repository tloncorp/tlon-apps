import * as api from './api';
import * as db from './db';
import { createDevLogger } from './debug';
import { getChannelType, nestToFlag } from './urbit';

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
  const unreads = await api.getChannelUnreads();
  const groups = await api.getGroups({ unreads, includeMembers: false });
  await db.insertGroups(groups);
};

export const syncUnreads = async () => {
  const [channelUnreads, dmUnreads] = await Promise.all([
    api.getChannelUnreads(),
    api.getDMUnreads(),
  ]);
  await db.insertUnreads([...channelUnreads, ...dmUnreads]);
};

export const syncPosts = async () => {
  const unreads = await db.getUnreads({ type: 'channel' });

  for (let unread of unreads) {
    try {
      await syncChannel(unread.channelId, unread.updatedAt);
    } catch (e) {
      logger.log(
        'sync failed for channel id',
        unread.channelId,
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

export async function syncChannel(id: string, remoteUpdatedAt: number) {
  const startTime = Date.now();
  const channel = await db.getChannel(id);
  if (!channel) {
    throw new Error('no local channel for' + id);
  }
  // If we don't have any posts, start loading backward from the current time
  if ((channel.remoteUpdatedAt ?? 0) < remoteUpdatedAt) {
    logger.log('loading posts for channel', id);
    const postsResponse: api.PagedPostsData = await api.getChannelPosts(id, {
      direction: 'older',
      date: new Date(Date.now() + 60000),
      includeReplies: false,
    });
    persistPagedPostData(channel.id, postsResponse);
    logger.log(
      'loaded',
      postsResponse.posts.length,
      `posts for channel ${id} in `,
      Date.now() - startTime + 'ms'
    );
  }
  const type = getChannelType(id);

  await db.updateChannel({ id, type, remoteUpdatedAt, syncedAt: Date.now() });
}

async function persistPagedPostData(
  channelId: string,
  data: api.PagedPostsData
) {
  const type = getChannelType(channelId);

  await db.updateChannel({ id: channelId, type, postCount: data.totalPosts });

  await db.insertChannelPosts(channelId, data.posts);
}

export const syncAll = async () => {
  const enabledOperations: [string, () => Promise<void>][] = [
    ['contacts', syncContacts],
    ['groups', syncGroups],
    ['pinnedItems', syncPinnedItems],
    ['unreads', syncUnreads],
    ['posts', syncPosts],
  ];

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
