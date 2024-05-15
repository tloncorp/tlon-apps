import { decToUd, unixToDa } from '@urbit/api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as ub from '../urbit';
import { stringToTa } from '../urbit/utils';
import {
  channelAction,
  getCanonicalPostId,
  toPostData,
  toPostReplyData,
  toReactionsData,
} from './postsApi';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('channelsSub', false);

export const getUnreadChannels = async () => {
  const response = await scry<ub.Unreads>({
    app: 'channels',
    path: '/unreads',
  });
  return toUnreadsData(response);
};

export const markChannelRead = async (channelId: string) => {
  const action = channelAction(channelId, { read: null });
  return await poke(action);
};

export type AddPostUpdate = { type: 'addPost'; post: db.Post };
export type PostReactionsUpdate = {
  type: 'updateReactions';
  postId: string;
  reactions: db.Reaction[];
};
export type UnknownUpdate = { type: 'unknown' };
export type PendingUpdate = { type: 'markPostSent'; cacheId: string };
export type DeletePostUpdate = { type: 'deletePost'; postId: string };
export type HidePostUpdate = { type: 'hidePost'; postId: string };
export type ShowPostUpdate = { type: 'showPost'; postId: string };
export type ChannelsUpdate =
  | AddPostUpdate
  | PostReactionsUpdate
  | UnknownUpdate
  | PendingUpdate
  | DeletePostUpdate
  | HidePostUpdate
  | ShowPostUpdate;

export const subscribeToChannelsUpdates = async (
  eventHandler: (update: ChannelsUpdate) => void
) => {
  subscribe(
    { app: 'channels', path: '/v1' },
    (rawEvent: ub.ChannelsSubscribeResponse) => {
      eventHandler(toChannelsUpdate(rawEvent));
    }
  );
};

export function toClientChannelsInit(channels: ub.Channels) {
  return Object.entries(channels).map(([id, channel]) => {
    return toClientChannelInit(id, channel);
  });
}

export type ChannelInit = {
  channelId: string;
  writers: string[];
};

export function toClientChannelInit(
  id: string,
  channel: ub.Channel
): ChannelInit {
  return { channelId: id, writers: channel.perms.writers ?? [] };
}

export const toChannelsUpdate = (
  channelEvent: ub.ChannelsSubscribeResponse
): ChannelsUpdate => {
  logger.log('channel event', {
    channelEvent,
  });

  // hide events
  if (channelEvent.hide !== undefined) {
    const postId = getCanonicalPostId(channelEvent.hide);
    logger.log('hide post event');
    return { type: 'hidePost', postId };
  }

  // show events
  if (channelEvent.show !== undefined) {
    const postId = getCanonicalPostId(channelEvent.show);
    logger.log('show post event');
    return { type: 'showPost', postId };
  }

  const channelId = channelEvent.nest;

  // post events
  if (
    'response' in channelEvent &&
    'post' in channelEvent.response &&
    !('reply' in channelEvent.response.post['r-post'])
  ) {
    const postId = getCanonicalPostId(channelEvent.response.post.id);
    const postResponse = channelEvent.response.post['r-post'];

    if ('set' in postResponse) {
      if (postResponse.set !== null) {
        const postToAdd = { id: postId, ...postResponse.set };

        logger.log(`add post event`);
        return { type: 'addPost', post: toPostData(channelId, postToAdd) };
      }

      logger.log('delete post event');
      return { type: 'deletePost', postId };
    } else if ('reacts' in postResponse && postResponse.reacts !== null) {
      const updatedReacts = toReactionsData(postResponse.reacts, postId);
      logger.log('update reactions event');
      return { type: 'updateReactions', postId, reactions: updatedReacts };
    }
  }

  // reply events
  if (
    'response' in channelEvent &&
    'post' in channelEvent.response &&
    'reply' in channelEvent.response.post['r-post']
  ) {
    const postId = getCanonicalPostId(channelEvent.response.post.id);
    const replyId = getCanonicalPostId(
      channelEvent.response.post['r-post'].reply.id
    );
    const replyResponse = channelEvent.response.post['r-post'].reply['r-reply'];
    if ('set' in replyResponse) {
      if (replyResponse.set !== null) {
        logger.log(`add reply event`);
        return {
          type: 'addPost',
          post: toPostReplyData(channelId, postId, replyResponse.set),
        };
      }

      logger.log('delete reply event');
      return { type: 'deletePost', postId: replyId };
    } else if ('reacts' in replyResponse && replyResponse.reacts !== null) {
      const updatedReacts = toReactionsData(replyResponse.reacts, replyId);
      logger.log('update reply reactions event');
      return {
        type: 'updateReactions',
        postId: replyId,
        reactions: updatedReacts,
      };
    }
  }

  // pending messages (on ship, not on group)
  if ('response' in channelEvent && 'pending' in channelEvent.response) {
    const cacheId = channelEvent.response.pending.id;
    return {
      type: 'markPostSent',
      cacheId: getCanonicalPostId(unixToDa(cacheId.sent).toString()),
    };
  }

  logger.log(`unknown event`);
  return { type: 'unknown' };
};

export const searchChatChannel = async (params: {
  channelId: string;
  query: string;
  cursor?: string;
}) => {
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const encodedQuery = stringToTa(params.query);

  const response = await scry<ub.ChannelScam>({
    app: 'channels',
    path: `/${params.channelId}/search/bounded/text/${
      params.cursor ? decToUd(params.cursor.toString()) : ''
    }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
  });

  const posts = response.scan
    .filter((scanItem) => 'post' in scanItem && scanItem.post !== undefined)
    .map((scanItem) => (scanItem as { post: ub.Post }).post)
    .map((post) => toPostData(params.channelId, post));
  const cursor = response.last;

  return { posts, cursor };
};

type ChannelUnreadData = {
  id: string;
  postCount?: number;
  unreadCount?: number;
  firstUnreadPostId?: string;
  unreadThreads?: db.ThreadUnreadState[];
  lastPostAt?: number;
};

function toUnreadsData(unreads: ub.Unreads): ChannelUnreadData[] {
  return Object.entries(unreads).map(([id, unread]) => {
    return toUnreadData(id, unread);
  });
}

function toUnreadData(channelId: string, unread: ub.Unread): ChannelUnreadData {
  return {
    id: channelId,
    unreadCount: unread.count,
    firstUnreadPostId: unread.unread?.id ?? undefined,
    unreadThreads: toThreadUnreadStateData(unread),
    lastPostAt: unread.recency,
  };
}

function toThreadUnreadStateData(unread: ub.Unread): db.ThreadUnreadState[] {
  return Object.entries(unread.threads).map(([threadId, unreadState]) => {
    return {
      threadId,
      count: unreadState.count,
      firstUnreadId: unreadState.id,
    };
  });
}
