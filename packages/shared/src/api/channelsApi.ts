import { formatUd, unixToDa } from '@urbit/aura';
import bigInt from 'big-integer';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { Posts } from '../urbit';
import { stringToTa } from '../urbit/utils';
import {
  getCanonicalPostId,
  getChannelIdType,
  isGroupChannelId,
} from './apiUtils';
import { toPostData, toPostReplyData, toReactionsData } from './postsApi';
import { scry, subscribe, trackedPoke } from './urbit';

const logger = createDevLogger('channelsSub', false);

export type AddPostUpdate = { type: 'addPost'; post: db.Post };
export type PostReactionsUpdate = {
  type: 'updateReactions';
  postId: string;
  reactions: db.Reaction[];
};
export type UnknownUpdate = { type: 'unknown' };
export type PendingUpdate = { type: 'markPostSent'; cacheId: string };
export type DeletePostUpdate = {
  type: 'deletePost';
  postId: string;
  channelId: string;
};
export type HidePostUpdate = { type: 'hidePost'; postId: string };
export type ShowPostUpdate = { type: 'showPost'; postId: string };
export type WritersUpdate = {
  type: 'updateWriters';
  channelId: string;
  writers: string[];
  groupId: string | null;
};
export type CreateChannelUpdate = {
  type: 'createChannel';
  channelId: string;
  writers: string[];
  groupId: string | null;
};

export type JoinChannelSuccessUpdate = {
  type: 'joinChannelSuccess';
  channelId: string;
};

export type InitialPostsOnChannelJoin = {
  type: 'initialPostsOnChannelJoin';
  channelId: string;
  posts: db.Post[];
};

export type LeaveChannelSuccessUpdate = {
  type: 'leaveChannelSuccess';
  channelId: string;
};

export type MarkChannelReadUpdate = {
  type: 'markChannelRead';
  channelId: string;
};

export type ChannelsUpdate =
  | AddPostUpdate
  | PostReactionsUpdate
  | UnknownUpdate
  | PendingUpdate
  | DeletePostUpdate
  | HidePostUpdate
  | ShowPostUpdate
  // | CreateChannelUpdate
  | JoinChannelSuccessUpdate
  | LeaveChannelSuccessUpdate
  | InitialPostsOnChannelJoin
  // | MarkChannelReadUpdate
  | WritersUpdate;

export const createChannel = async (channelPayload: ub.Create) => {
  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action',
      json: {
        create: channelPayload,
      },
    },
    { app: 'channels', path: '/v1' },
    (event) => {
      return (
        'create' in event.response &&
        event.nest ===
          `${channelPayload.kind}/${channelPayload.group}/${channelPayload.name}`
      );
    }
  );
};

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

export function toClientChannelsInit(
  channels: ub.Channels,
  readersMap: Record<string, string[]>
) {
  return Object.entries(channels).map(([id, channel]) => {
    return toClientChannelInit(id, channel, readersMap[id] ?? []);
  });
}

export type ChannelInit = {
  channelId: string;
  writers: string[];
  readers: string[];
};

export function toClientChannelInit(
  id: string,
  channel: ub.Channel,
  readers: string[]
): ChannelInit {
  return { channelId: id, writers: channel.perms.writers ?? [], readers };
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

  if ('response' in channelEvent) {
    if ('perm' in channelEvent.response) {
      return {
        type: 'updateWriters',
        channelId,
        writers: channelEvent.response.perm.writers,
        groupId: channelEvent.response.perm.group,
      };
    }

    // not clear that this is necessary
    // if ('create' in channelEvent.response) {
    // return {
    // type: 'createChannel',
    // channelId,
    // writers: channelEvent.response.create.writers,
    // groupId: channelEvent.response.create.group,
    // };
    // }

    if ('join' in channelEvent.response) {
      return {
        type: 'joinChannelSuccess',
        channelId,
      };
    }

    // not clear that this is necessary
    // if ('read' in channelEvent.response) {
    // return {
    // type: 'markChannelRead',
    // channelId,
    // };
    // }

    if ('leave' in channelEvent.response) {
      return {
        type: 'leaveChannelSuccess',
        channelId,
      };
    }

    if ('posts' in channelEvent.response) {
      const { posts: postsFromBackend }: { posts: Posts } =
        channelEvent.response;

      const posts = Object.entries(postsFromBackend)
        .filter(([_, post]) => post !== null)
        .map(([_, post]) => {
          return toPostData(channelId, post!);
        });

      return { type: 'initialPostsOnChannelJoin', channelId, posts };
    }

    if ('post' in channelEvent.response) {
      // post events
      if (!('reply' in channelEvent.response.post['r-post'])) {
        const postId = getCanonicalPostId(channelEvent.response.post.id);
        const postResponse = channelEvent.response.post['r-post'];

        if ('set' in postResponse) {
          if (postResponse.set !== null) {
            const postToAdd = { id: postId, ...postResponse.set };

            logger.log(`add post event`);
            return { type: 'addPost', post: toPostData(channelId, postToAdd) };
          }

          logger.log('delete post event');
          return { type: 'deletePost', postId, channelId };
        } else if ('reacts' in postResponse && postResponse.reacts !== null) {
          const updatedReacts = toReactionsData(postResponse.reacts, postId);
          logger.log('update reactions event');
          return { type: 'updateReactions', postId, reactions: updatedReacts };
        }
      }

      // reply events
      if ('reply' in channelEvent.response.post['r-post']) {
        const postId = getCanonicalPostId(channelEvent.response.post.id);
        const replyId = getCanonicalPostId(
          channelEvent.response.post['r-post'].reply.id
        );
        const replyResponse =
          channelEvent.response.post['r-post'].reply['r-reply'];
        if ('set' in replyResponse) {
          if (replyResponse.set !== null) {
            logger.log(`add reply event`);
            return {
              type: 'addPost',
              post: toPostReplyData(channelId, postId, replyResponse.set),
            };
          }

          logger.log('delete reply event');
          return { type: 'deletePost', postId: replyId, channelId };
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
    }

    // pending messages (on ship, not on group)
    if ('pending' in channelEvent.response) {
      const cacheId = channelEvent.response.pending.id;
      return {
        type: 'markPostSent',
        cacheId: getCanonicalPostId(unixToDa(cacheId.sent).toString()),
      };
    }
  }

  logger.log(`unknown event`, channelEvent);
  return { type: 'unknown' };
};

export const createNewGroupDefaultChannel = async ({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string;
}) => {
  const randomNumber = Math.floor(Math.random() * 10000);
  const channelPayload: ub.Create = {
    kind: 'chat',
    group: groupId,
    name: `welcome-${randomNumber}`,
    title: 'Welcome',
    description: 'Welcome to your new group!',
    readers: [],
    writers: [],
  };

  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action',
      json: {
        create: channelPayload,
      },
    },
    { app: 'channels', path: '/v1' },
    (event) => {
      const { response, nest } = event;
      return (
        'create' in response &&
        nest ===
          `${channelPayload.kind}/${currentUserId}/${channelPayload.name}`
      );
    }
  );
};

export const searchChannel = async (params: {
  channelId: string;
  query: string;
  cursor?: string;
}) => {
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const isGroupChannel = isGroupChannelId(params.channelId);
  const encodedQuery = stringToTa(params.query);

  let response;
  if (isGroupChannel) {
    // channels agent
    response = await scry<ub.ChannelScam>({
      app: 'channels',
      path: `/${params.channelId}/search/bounded/text/${
        params.cursor ? formatUd(bigInt(params.cursor ?? 0)) : ''
      }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
    });
  } else {
    // chat agent
    const type = getChannelIdType(params.channelId) === 'dm' ? 'dm' : 'club';
    response = await scry<ub.ChatScam>({
      app: 'chat',
      path: `/${type}/${params.channelId}/search/bounded/text/${
        params.cursor ? formatUd(bigInt(params.cursor ?? 0)) : ''
      }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
    });
  }

  // note: we avoid incurring the cost of sorting here since the main consumer (useChannelSearch)
  // aggregates results across multiple pages
  const posts: db.Post[] = response.scan
    .map((scanItem) => {
      if ('post' in scanItem) {
        return toPostData(params.channelId, scanItem.post);
      }
      if ('writ' in scanItem) {
        return toPostData(params.channelId, scanItem.writ);
      }
      if ('reply' in scanItem) {
        const parentId = isGroupChannel
          ? getCanonicalPostId(scanItem.reply['id-post'])
          : getCanonicalPostId(scanItem.reply.reply.seal['parent-id']);
        return toPostReplyData(
          params.channelId,
          parentId,
          scanItem.reply.reply
        );
      }
      return false;
    })
    .filter((post) => post !== false) as db.Post[];

  const cursor = response.last;

  return { posts, cursor };
};

export const leaveChannel = async (channelId: string) => {
  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action',
      json: {
        channel: {
          nest: channelId,
          action: {
            leave: null,
          },
        },
      },
    },
    { app: 'channels', path: '/v1' },
    (event) => {
      return 'leave' in event.response && event.response.leave === channelId;
    }
  );
};

export const joinChannel = async (channelId: string, groupId: string) => {
  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action',
      json: {
        channel: {
          nest: channelId,
          action: {
            join: groupId,
          },
        },
      },
    },
    { app: 'channels', path: '/v1' },
    (event) => {
      return 'join' in event.response && event.nest === channelId;
    }
  );
};
