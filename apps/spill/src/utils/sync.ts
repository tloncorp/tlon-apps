import {atom, useAtomValue, useSetAtom} from 'jotai';
import {useCallback, useRef} from 'react';
import * as api from '@api';
import {PagedPostsData} from '@api/conversion';
import * as db from '@db';
import {createLogger} from './debug';

export const syncStateAtom = atom<{
  isSyncing: boolean;
  stage: 'initial' | 'channels' | 'posts' | 'groups';
  channelsToSync: number;
  channelsSynced: number;
  lastSync: number;
}>({
  isSyncing: false,
  stage: 'initial',
  channelsToSync: 0,
  channelsSynced: 0,
  lastSync: 0,
});

const logger = createLogger('Sync', false);

export const useSyncState = () => useAtomValue(syncStateAtom);

export function useSync() {
  const setSyncState = useSetAtom(syncStateAtom);
  const ops = db.useOps();
  const isSyncing = useRef(false);

  const sync = useCallback(async () => {
    if (isSyncing.current) {
      logger.log('sync already in progress, bailing');
      return;
    }
    setSyncState(state => ({
      ...state,
      isSyncing: true,
      stage: 'groups',
      channelsToSync: 0,
      channelsSynced: 0,
      lastSync: Date.now(),
    }));
    isSyncing.current = true;

    ops.createGroups(await api.getGroups());

    setSyncState(state => ({
      ...state,
      stage: 'channels',
    }));

    const unreads = await api.getUnreadChannels();
    setSyncState(state => ({
      ...state,
      stage: 'posts',
      channelsToSync: unreads.length,
    }));
    const sortedUnreads = unreads.sort((a, b) => {
      return b.unreadState.updatedAt - a.unreadState.updatedAt;
    });
    ops.batch(() => {
      sortedUnreads.forEach(unreadChannel => {
        ops.update('Channel', unreadChannel);
      });
    });
    let counter = 0;
    for (let unreadChannel of sortedUnreads) {
      ++counter;
      await syncChannel(
        unreadChannel.id,
        unreadChannel.unreadState.updatedAt,
        ops,
      );
      setSyncState(state => ({
        ...state,
        channelsSynced: counter,
      }));
    }
    isSyncing.current = false;
    setSyncState(state => ({
      ...state,
      stage: 'initial',
      isSyncing: false,
    }));
  }, [ops, setSyncState]);

  return {sync};
}

export async function syncPostsBefore(post: db.Post, ops: db.Operations) {
  if (!post.channel) {
    throw new Error("post is missing channel, can't sync");
  }
  const postsResponse = await api.getChannelPosts(post.channel?.id, {
    count: 50,
    direction: 'older',
    cursor: post.id,
    includeReplies: false,
  });
  storePostData(post.channel, postsResponse, ops);
}

const MAX_PAGES = 1;

export async function syncChannel(
  id: string,
  updatedAt: number,
  ops: db.Operations,
) {
  const channel = ops.getObject('Channel', id);
  if (!channel) {
    throw new Error('Unknown channel: ' + id);
  }
  const isStale = (channel.syncedAt ?? 0) < updatedAt;
  if (!isStale) {
    logger.log('Skipping unchanged channel', channel.id);
    return;
  }
  logger.log('Sync channel', id);
  // If we don't have any posts, start loading backward from the current time
  if (!channel.latestPost) {
    logger.log('No posts, loading newest');
    let nextOlderPageParams: {date: Date} | {cursor: string} | null = {
      // We want to load anything older than now (which should give us newest).
      // We offset the time into the future to allow for clock skew.
      date: new Date(Date.now() + 60000),
    };
    for (let i = 0; i < MAX_PAGES; ++i) {
      logger.log('loading page', i, 'of channel', id);
      const postsResponse = await api.getChannelPosts(id, {
        direction: 'older',
        ...nextOlderPageParams,
        includeReplies: false,
      });
      storePostData(channel, postsResponse, ops);
      nextOlderPageParams = postsResponse.older
        ? {cursor: postsResponse.older}
        : null;
      if (!nextOlderPageParams) {
        break;
      }
    }
  } else {
    // TODO: fix so this doesn't leave gaps. Should probably also start loading from newest.
    if ((channel.latestPost.sentAt ?? 0) < updatedAt) {
      const postsResponse = await api.getChannelPosts(id, {
        direction: 'newer',
        cursor: channel.latestPost.id,
        includeReplies: false,
      });
      storePostData(channel, postsResponse, ops);
    }
  }
  ops.update('Channel', {id, syncedAt: Date.now()});
}

function storePostData(
  channel: db.Channel,
  data: PagedPostsData,
  ops: db.Operations,
) {
  ops.update('Channel', {id: channel.id, totalPosts: data.totalPosts});
  ops.createChannelPosts(data.posts, channel);
}
