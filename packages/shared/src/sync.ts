import {
  PagedPostsData,
  getChannelPosts,
  getChannelUnreads,
  getContacts,
  getDMUnreads,
  getGroups,
  getPinnedItems,
} from './api';
import * as db from './db';
import { createDevLogger } from './debug';

// TODO: This is too complicated, clean up.

type Operation<T = unknown> = {
  load: () => Promise<T>;
  store: (params: T) => Promise<unknown>;
};

type OperationMap<T> = {
  [K in keyof T]: T[K] extends Operation<infer V> ? Operation<V> : never;
};

function makeOperations<T extends { [K: string]: Operation<any> }>(
  input: T
): OperationMap<T> {
  return input as unknown as OperationMap<T>;
}

const operations = makeOperations({
  contacts: {
    load: getContacts,
    store: db.insertContacts,
  },
  unreads: {
    load: async () => {
      const [channelUnreads, dmUnreads] = await Promise.all([
        getChannelUnreads(),
        getDMUnreads(),
      ]);
      return [...channelUnreads, ...dmUnreads];
    },
    store: db.insertUnreads,
  },
  groups: {
    load: getGroups,
    store: db.insertGroups,
  },
  pinnedItems: {
    load: getPinnedItems,
    store: db.insertPinnedItems,
  },
  // TODO: This is wacky, but I'm going to restructure.
  posts: {
    load: async () => {
      const unreads = await db.getUnreads();
      for (let unread of unreads) {
        try {
          await syncChannel(unread.channelId, unread.updatedAt);
        } catch (e) {
          console.log('Sync failed', unread.channelId);
        }
      }
      return [];
    },
    store: async (posts: []) => {},
  },
});

type OperationName = keyof typeof operations;

const logger = createDevLogger('sync', true);

export const syncGroups = () => runOperation('groups');
export const syncContacts = () => runOperation('contacts');
export const syncUnreads = () => runOperation('unreads');
export const syncPinnedItems = () => runOperation('pinnedItems');
export const syncPosts = () => runOperation('posts');

export const syncAll = async () =>
  measureDuration('initial sync', async () => {
    const enabledOperations: OperationName[] = [
      'contacts',
      'groups',
      'pinnedItems',
      'unreads',
      'posts',
    ];
    for (const name of enabledOperations) {
      try {
        await runOperation(name);
      } catch (e) {
        console.log(e);
      }
    }
  });

export async function syncPostsBefore(post: db.Post) {
  if (!post.channelId) {
    throw new Error("post is missing channel, can't sync");
  }
  const postsResponse = await getChannelPosts(post.channelId, {
    count: 50,
    direction: 'older',
    cursor: post.id,
    includeReplies: false,
  });
  persistPagedPostData(post.channelId, postsResponse);
}

const MAX_PAGES = 1;

export async function syncChannel(id: string, updatedAt: number) {
  const channel = await db.getChannel(id);
  if (!channel) {
    throw new Error('Unknown channel: ' + id);
  }
  const isStale = (channel.syncedAt ?? 0) < updatedAt;
  if (!isStale) {
    return;
  }
  logger.log('Sync channel', id);
  // If we don't have any posts, start loading backward from the current time
  if (!channel.lastPostId) {
    logger.log('No posts, loading newest');
    let nextOlderPageParams: { date: Date } | { cursor: string } | null = {
      // We want to load anything older than now (which should give us newest).
      // We offset the time into the future to allow for clock skew.
      date: new Date(Date.now() + 60000),
    };
    for (let i = 0; i < MAX_PAGES; ++i) {
      const postsResponse: PagedPostsData = await getChannelPosts(id, {
        direction: 'older',
        ...nextOlderPageParams,
        includeReplies: false,
      });
      persistPagedPostData(channel.id, postsResponse);
      nextOlderPageParams = postsResponse.older
        ? { cursor: postsResponse.older }
        : null;
      if (!nextOlderPageParams) {
        break;
      }
    }
  } else {
    // TODO: fix so this doesn't leave gaps. Should probably also start loading from newest.
    if ((channel.lastPostAt ?? 0) < updatedAt) {
      const postsResponse = await getChannelPosts(id, {
        direction: 'newer',
        cursor: channel.lastPostId,
        includeReplies: false,
      });
      persistPagedPostData(channel.id, postsResponse);
    }
  }
  await db.updateChannel({ id, syncedAt: Date.now() });
}

async function persistPagedPostData(channelId: string, data: PagedPostsData) {
  db.updateChannel({ id: channelId, postCount: data.totalPosts });
  db.insertChannelPosts(channelId, data.posts);
}

async function runOperation(name: OperationName) {
  const startTime = Date.now();
  logger.log('starting', name);
  const operation = operations[name] as Operation;
  const result = await operation.load();
  const loadTime = Date.now() - startTime;
  await operation.store(result);
  const storeTime = Date.now() - startTime - loadTime;
  logger.log(
    'synced',
    name,
    'in',
    loadTime + 'ms (load) +',
    storeTime + 'ms (store)'
  );
}

async function measureDuration<T>(label: string, fn: () => Promise<T>) {
  const startTime = Date.now();
  try {
    return await fn();
  } catch (e) {
    logger.warn(label, 'failed', e, fn);
  } finally {
    logger.log(label, 'finished in', Date.now() - startTime, 'ms');
  }
}
