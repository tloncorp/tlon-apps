import { render, da } from '@urbit/aura';
import { Poke } from '@urbit/http-api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { Action, ChannelsAction, Posts } from '../urbit';
import { encodeString } from '../urbit/utils';
import { Stringified } from '../utils';
import {
  getCanonicalPostId,
  getChannelIdType,
  isGroupChannelId,
} from './apiUtils';
import { toPostData, toPostReplyData, toReactionsData } from './postsApi';
import {
  poke,
  scry,
  subscribe,
  subscribeOnce,
  thread,
  trackedPoke,
} from './urbit';

const logger = createDevLogger('channelsApi', false);

export function channelAction(
  channelId: string,
  action: Action
): Poke<ChannelsAction> {
  return {
    app: 'channels',
    mark: 'channel-action-1',
    json: {
      channel: {
        nest: channelId,
        action,
      },
    },
  };
}

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
export type OrderUpdate = {
  type: 'updateOrder';
  channelId: string;
  order: string[];
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

export type MetaUpdate = {
  type: 'channelMetaUpdate';
  meta: Stringified<ub.ChannelMetadataSchemaV1> | null;
};

export type ChannelsUpdate =
  | AddPostUpdate
  | PostReactionsUpdate
  | UnknownUpdate
  | PendingUpdate
  | DeletePostUpdate
  | HidePostUpdate
  | ShowPostUpdate
  | MetaUpdate
  | CreateChannelUpdate
  | JoinChannelSuccessUpdate
  | LeaveChannelSuccessUpdate
  | InitialPostsOnChannelJoin
  // | MarkChannelReadUpdate
  | OrderUpdate
  | WritersUpdate;

export const createChannel = async ({
  id,
  ...channelPayload
}: ub.Create & { id: string }) => {
  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action-1',
      json: {
        create: channelPayload,
      },
    },
    { app: 'channels', path: '/v2' },
    (event) => {
      return 'create' in event.response && event.nest === id;
    },
    { tag: 'createChannel' }
  );
};

export async function updateChannelMeta(
  channelId: string,
  metaPayload: Stringified<ub.ChannelMetadataSchemaV1> | null
) {
  return trackedPoke<ub.ChannelsResponse>(
    {
      app: 'channels',
      mark: 'channel-action',
      json: {
        channel: {
          nest: channelId,
          action: {
            meta: metaPayload,
          },
        },
      },
    },
    { app: 'channels', path: '/v2' },
    (event) => {
      return 'meta' in event.response;
    }
  );
}

export const setupChannelFromTemplate = async (
  exampleChannelId: string,
  targetChannelId: string
) => {
  return thread({
    desk: 'groups',
    inputMark: 'hook-setup-template-args',
    outputMark: 'json',
    threadName: 'channel-setup-from-template',
    body: {
      example: exampleChannelId,
      target: targetChannelId,
    },
  });
};

export const subscribeToChannelsUpdates = async (
  eventHandler: (update: ChannelsUpdate) => void
) => {
  subscribe(
    { app: 'channels', path: '/v2' },
    (rawEvent: ub.ChannelsSubscribeResponse) => {
      logger.log('channels received event', rawEvent);
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
  order: string[];
  writers: string[];
  readers: string[];
};

export function toClientChannelInit(
  id: string,
  channel: ub.Channel,
  readers: string[]
): ChannelInit {
  return {
    channelId: id,
    writers: channel.perms.writers ?? [],
    readers,
    order: channel.order.map((x) => getCanonicalPostId(x)),
  };
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
    if ('order' in channelEvent.response) {
      return {
        type: 'updateOrder',
        channelId,
        order: channelEvent.response.order.map((id) => getCanonicalPostId(id)),
      };
    }

    if ('perm' in channelEvent.response) {
      return {
        type: 'updateWriters',
        channelId,
        writers: channelEvent.response.perm.writers,
        groupId: channelEvent.response.perm.group,
      };
    }

    if ('meta' in channelEvent.response) {
      return {
        type: 'channelMetaUpdate',
        meta: channelEvent.response.meta,
      };
    }

    // not clear that this is necessary
    if ('create' in channelEvent.response) {
      return {
        type: 'createChannel',
        channelId,
        writers: channelEvent.response.create.writers,
        groupId: channelEvent.response.create.group,
      };
    }

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
          // Check for shortcodes in raw reactions from server
          const shortcodeReactions = Object.entries(postResponse.reacts).filter(([, v]) => 
            typeof v === 'string' && /^:[a-zA-Z0-9_+-]+:?$/.test(v)
          );
          
          if (shortcodeReactions.length > 0) {
            logger.trackError('Shortcode reactions received from server (post)', {
              postId,
              shortcodeReactions: shortcodeReactions.map(([k, v]) => ({ user: k, value: v })),
              allReacts: postResponse.reacts,
              context: 'channel_post_update'
            });
          }
          
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
          // Check for shortcodes in raw reply reactions from server
          const shortcodeReactions = Object.entries(replyResponse.reacts).filter(([, v]) => 
            typeof v === 'string' && /^:[a-zA-Z0-9_+-]+:?$/.test(v)
          );
          
          if (shortcodeReactions.length > 0) {
            logger.trackError('Shortcode reactions received from server (reply)', {
              replyId,
              shortcodeReactions: shortcodeReactions.map(([k, v]) => ({ user: k, value: v })),
              allReacts: replyResponse.reacts,
              context: 'channel_reply_update'
            });
          }
          
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
        cacheId: getCanonicalPostId(da.fromUnix(cacheId.sent).toString()),
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
    meta: null,
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
    { app: 'channels', path: '/v2' },
    (event) => {
      const { response, nest } = event;
      return (
        'create' in response &&
        nest ===
          `${channelPayload.kind}/${currentUserId}/${channelPayload.name}`
      );
    },
    { tag: 'createNewGroupDefaultChannel' }
  );
};

export const searchChannel = async (params: {
  channelId: string;
  query: string;
  cursor?: string;
}) => {
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const isGroupChannel = isGroupChannelId(params.channelId);
  const encodedQuery = encodeString(params.query);

  let response;
  if (isGroupChannel) {
    // channels agent
    response = await scry<ub.ChannelScam>({
      app: 'channels',
      path: `/${params.channelId}/search/bounded/text/${
        params.cursor ? render('ud', BigInt(params.cursor ?? 0)) : ''
      }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
    });
  } else {
    // chat agent
    const type = getChannelIdType(params.channelId) === 'dm' ? 'dm' : 'club';
    response = await scry<ub.ChatScam>({
      app: 'chat',
      path: `/${type}/${params.channelId}/search/bounded/text/${
        params.cursor ? render('ud', BigInt(params.cursor ?? 0)) : ''
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

export const setOrder = async (
  channelId: string,
  arrangedPostIds: string[]
) => {
  await poke({
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest: channelId,
        action: {
          order: arrangedPostIds,
        },
      },
    },
  });
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
    { app: 'channels', path: '/v2' },
    (event) => {
      return 'leave' in event.response && event.response.leave === channelId;
    },
    { tag: 'leaveChannel' }
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
    { app: 'channels', path: '/v2' },
    (event) => {
      return 'join' in event.response && event.nest === channelId;
    },
    { tag: 'joinChannel' }
  );
};

export async function getChannelHooksPreview(channelId: string) {
  return subscribeOnce<ub.ChannelHooksPreview>(
    {
      app: 'channels',
      path: `/v1/hooks/preview/${channelId}`,
    },
    10_000
  );
}

export async function addChannelWriters({
  channelId,
  writers,
}: {
  channelId: string;
  writers: string[];
}) {
  return poke(channelAction(channelId, { 'add-writers': writers }));
}

export async function removeChannelWriters({
  channelId,
  writers,
}: {
  channelId: string;
  writers: string[];
}) {
  return poke(channelAction(channelId, { 'del-writers': writers }));
}
