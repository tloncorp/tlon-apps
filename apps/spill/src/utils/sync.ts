import * as api from '@api';
import {PagedPostsData} from '@api/conversion';
import * as db from '@db';
import {useCallback, useRef} from 'react';
import {createLogger} from './debug';

const logger = createLogger('sync', true);

export function useSync() {
  const ops = db.useOps();
  const isSyncing = useRef(false);

  const sync = useCallback(async () => {
    if (isSyncing.current) {
      logger.log('sync already in progress, bailing');
      return;
    }
    isSyncing.current = true;

    await syncGroups(ops);

    const unreads = await api.getUnreadChannels();
    const sortedUnreads = unreads.sort((a, b) => {
      return b.unreadState.updatedAt - a.unreadState.updatedAt;
    });
    ops.batch(() => {
      sortedUnreads.forEach(unreadChannel => {
        ops.update('Channel', unreadChannel);
      });
    });
    for (let unreadChannel of sortedUnreads) {
      await syncChannel(
        ops,
        unreadChannel.id,
        unreadChannel.unreadState.updatedAt,
      );
    }
    isSyncing.current = false;
  }, [ops]);

  return {sync};
}

export async function syncUnreadChannels(ops: db.Operations) {
  const unreads = await api.getUnreadChannels();
  const sortedUnreads = unreads.sort((a, b) => {
    return b.unreadState.updatedAt - a.unreadState.updatedAt;
  });
  ops.batch(() => {
    sortedUnreads.forEach(unreadChannel => {
      ops.update('Channel', unreadChannel);
    });
  });
  for (let unreadChannel of sortedUnreads) {
    await syncChannel(
      ops,
      unreadChannel.id,
      unreadChannel.unreadState.updatedAt,
    );
  }
}

export async function syncGroups(ops: db.Operations) {
  const groups = await api.getGroups();
  ops.createGroups(groups);
}

export async function syncPostsBefore(ops: db.Operations, post: db.Post) {
  if (!post.channel) {
    throw new Error("post is missing channel, can't sync");
  }
  const postsResponse = await api.getChannelPosts(post.channel?.id, {
    count: 50,
    direction: 'older',
    cursor: post.id,
    includeReplies: false,
  });
  persistPagedPostData(post.channel, postsResponse, ops);
}

const MAX_PAGES = 1;

export async function syncChannel(
  ops: db.Operations,
  id: string,
  updatedAt: number,
) {
  const channel = ops.getObject('Channel', id);
  if (!channel) {
    throw new Error('Unknown channel: ' + id);
  }
  const isStale = (channel.syncedAt ?? 0) < updatedAt;
  if (!isStale) {
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
      persistPagedPostData(channel, postsResponse, ops);
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
      persistPagedPostData(channel, postsResponse, ops);
    }
  }
  ops.update('Channel', {id, syncedAt: Date.now()});
}

export async function syncChannelReference(
  {channelId, postId, replyId}: db.ChannelReference,
  ops: db.Operations,
) {
  const existingPost = ops.getObject('Post', postId);
  if (existingPost) {
    console.log('Already have post', existingPost.id);
    return;
  }
  const data = await api.getChannelReference(channelId, postId, replyId);
  ops.createChannelPosts([data], {id: channelId});
}

export async function syncGroupReference(
  {groupId}: db.GroupReference,
  ops: db.Operations,
) {
  const existingPost = ops.getObject('Group', groupId);
  if (existingPost) {
    console.log('Already have post', existingPost.id);
    return;
  }
  const data = await api.getGroupReference(groupId);
  ops.createGroups([data]);
}

export async function syncAppReference(
  {userId, appId}: db.AppReference,
  ops: db.Operations,
) {
  const existingApp = ops.getObject('App', userId + '/' + appId);
  if (existingApp) {
    logger.log('Already have app', existingApp.id);
    return;
  }
  const result = await api.getAppReference(userId, appId);
  ops.createApp(result);
}

function persistPagedPostData(
  channel: db.Channel,
  data: PagedPostsData,
  ops: db.Operations,
) {
  ops.update('Channel', {id: channel.id, totalPosts: data.totalPosts});
  ops.createChannelPosts(data.posts, channel);
}
