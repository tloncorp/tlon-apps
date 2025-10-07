import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import {
  deriveFullWrit,
  deriveFullWritReply,
  fromClientMeta,
  getCanonicalPostId,
  toClientMeta,
} from './apiUtils';
import {
  ChannelContentConfiguration,
  StructuredChannelDescriptionPayload,
} from './channelContentConfig';
import { toPostData, toPostReplyData, toReplyMeta } from './postsApi';
import { getCurrentUserId, poke, scry, subscribe, trackedPoke } from './urbit';

const logger = createDevLogger('chatApi', false);

export const markChatRead = (whom: string) =>
  poke({
    app: 'chat',
    mark: 'chat-remark-action',
    json: {
      whom,
      diff: { read: null },
    },
  });

export const createGroupDm = ({
  id,
  members,
}: {
  id: string;
  members: string[];
}) => {
  return poke({
    app: 'chat',
    mark: 'chat-club-create',
    json: {
      id,
      hive: [...members],
    },
  });
};

export const respondToDMInvite = ({
  channel,
  accept,
}: {
  channel: db.Channel;
  accept: boolean;
}) => {
  const currentUserId = getCurrentUserId();

  if (channel.type === 'dm') {
    return poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: {
        ship: channel.id,
        ok: accept,
      },
    });
  }

  const action = multiDmAction(channel.id, {
    team: { ship: currentUserId, ok: accept },
  });
  return poke(action);
};

export const updateDMMeta = async ({
  channelId,
  meta,
}: {
  channelId: string;
  meta: db.ClientMeta;
}) => {
  return await trackedPoke<ub.WritResponse | ub.ClubAction | string[]>(
    multiDmAction(channelId, { meta: fromClientMeta(meta) }),
    { app: 'chat', path: '/' },
    (event) => {
      if (!('diff' in event)) {
        return false;
      }
      const { diff } = event;
      return 'meta' in diff && event.id === channelId;
    },
    { tag: 'updateDMMeta' }
  );
};

export type ChatEvent =
  | { type: 'showPost'; postId: string }
  | { type: 'hidePost'; postId: string }
  | { type: 'syncDmInvites'; channels: db.Channel[] }
  | { type: 'groupDmsUpdate' }
  | { type: 'addPost'; post: db.Post; replyMeta?: db.ReplyMeta | null }
  | { type: 'deletePost'; postId: string }
  | { type: 'addReaction'; postId: string; userId: string; react: string }
  | { type: 'deleteReaction'; postId: string; userId: string }
  | { type: 'unknown' };

export function subscribeToChatUpdates(
  eventHandler: (event: ChatEvent) => void
) {
  subscribe(
    {
      app: 'chat',
      path: '/v3',
    },
    (event: ub.WritResponse | ub.ClubAction | string[]) => {
      logger.log('raw chat sub event', event);

      if ('show' in event) {
        // show/unhide post event
        logger.log('show/unhide post', event.show);
        const postId = getCanonicalPostId(event.show as string);
        return eventHandler({ type: 'showPost', postId });
      }

      if ('hide' in event) {
        // hide post event
        logger.log('hide post', event.hide);
        const postId = getCanonicalPostId(event.hide as string);
        return eventHandler({ type: 'hidePost', postId });
      }

      // check for DM invites sync
      if (Array.isArray(event)) {
        // dm invites - this is the complete list of pending invites
        return eventHandler({
          type: 'syncDmInvites',
          channels: toClientDms(event, true),
        });
      }

      // and club events
      if ('diff' in event) {
        const diff = event.diff;
        if ('uid' in diff && 'delta' in diff) {
          logger.log('club event');
          return eventHandler({
            type: 'groupDmsUpdate',
          });
        }
      }

      // otherwise, handle as if it's a writ response
      if (!('response' in event)) {
        logger.log('unknown event type');
        return eventHandler({ type: 'unknown' });
      }

      const channelId = event.whom;
      const id = getCanonicalPostId(event.id);
      const delta = event.response;

      if ('add' in delta) {
        logger.log('add dm', id, delta);
        const writ = deriveFullWrit(id, delta);
        const post = toPostData(channelId, writ);
        return eventHandler({ type: 'addPost', post });
      }

      if ('del' in delta) {
        logger.log('del dm', id, delta);
        return eventHandler({ type: 'deletePost', postId: id });
      }

      if ('add-react' in delta) {
        logger.log('add react', id, delta);
        const addReact = delta['add-react'];
        
        // Check if this is a shortcode reaction from chat/DM
        if (/^:[a-zA-Z0-9_+-]+:?$/.test(addReact.react)) {
          logger.trackError('Shortcode reaction from chat/DM server', {
            postId: id,
            channelId,
            userId: addReact.author,
            react: addReact.react,
            context: 'chat_dm_reaction'
          });
        }
        
        return eventHandler({
          type: 'addReaction',
          postId: id,
          userId: addReact.author,
          react: addReact.react,
        });
      }

      if ('del-react' in delta) {
        logger.log('del react', id, delta);
        const userId = delta['del-react'];
        return eventHandler({
          type: 'deleteReaction',
          postId: id,
          userId,
        });
      }

      if ('reply' in delta) {
        const replyId = getCanonicalPostId(delta.reply.id);
        const replyDelta = delta.reply.delta;

        if ('add' in replyDelta) {
          logger.log('add dm reply', id, delta);
          const writReply = deriveFullWritReply({
            id: replyId,
            parentId: id,
            delta: replyDelta,
          });
          const post = toPostReplyData(channelId, id, writReply);
          const replyMeta = delta.reply.meta;
          return eventHandler({
            type: 'addPost',
            post,
            replyMeta: toReplyMeta(replyMeta),
          });
        }

        if ('del' in replyDelta) {
          logger.log('del dm reply', id, delta);
          return eventHandler({ type: 'deletePost', postId: replyId });
        }

        if ('add-react' in replyDelta) {
          logger.log('add react reply', id, delta);
          const addReact = replyDelta['add-react'];
          
          // Check if this is a shortcode reaction from chat/DM reply
          if (/^:[a-zA-Z0-9_+-]+:?$/.test(addReact.react)) {
            logger.trackError('Shortcode reaction from chat/DM reply server', {
              postId: replyId,
              parentId: id,
              channelId,
              userId: addReact.author,
              react: addReact.react,
              context: 'chat_dm_reply_reaction'
            });
          }
          
          return eventHandler({
            type: 'addReaction',
            postId: replyId,
            userId: addReact.author,
            react: addReact.react,
          });
        }

        if ('del-react' in replyDelta) {
          logger.log('del react reply', id, delta);
          const userId = replyDelta['del-react'];
          return eventHandler({
            type: 'deleteReaction',
            postId: replyId,
            userId,
          });
        }
      }
    }
  );
}

export function getBlockedUsers() {
  return scry<ub.BlockedShips>({ app: 'chat', path: '/blocked' });
}

export function blockUser(userId: string) {
  return poke({
    app: 'chat',
    mark: 'chat-block-ship',
    json: { ship: userId },
  });
}

export function unblockUser(userId: string) {
  return poke({
    app: 'chat',
    mark: 'chat-unblock-ship',
    json: { ship: userId },
  });
}

export function multiDmAction(id: string, delta: ub.ClubDelta) {
  return {
    app: 'chat',
    mark: 'chat-club-action-0',
    json: {
      id,
      diff: {
        uid: '0v3',
        delta,
      },
    },
  };
}

export type GetDmsResponse = db.Channel[];

export const getDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/dm' })) as string[];
  return toClientDms(result);
};

export const toClientDms = (
  dmContacts: string[],
  areInvites?: boolean
): db.Channel[] => {
  return dmContacts.map((id) => toClientDm(id, areInvites));
};

export const toClientDm = (id: string, isInvite?: boolean): db.Channel => {
  return {
    id,
    type: 'dm' as const,
    title: '',
    description: '',
    isDmInvite: !!isInvite,
    contactId: id,
    members: [{ chatId: id, contactId: id, membershipType: 'channel' }],
  };
};

export const getGroupDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/clubs' })) as ub.Clubs;
  return toClientGroupDms(result);
};

export const toClientGroupDms = (groupDms: ub.Clubs): GetDmsResponse => {
  const currentUserId = getCurrentUserId();
  return Object.entries(groupDms)
    .map(([id, club]): db.Channel | null => {
      const joinedMembers = club.team.map(
        (member): db.ChatMember => ({
          contactId: member,
          chatId: id,
          membershipType: 'channel',
          status: 'joined',
        })
      );
      const invitedMembers = club.hive.map(
        (member): db.ChatMember => ({
          contactId: member,
          chatId: id,
          membershipType: 'channel',
          status: 'invited',
        })
      );

      const isJoined = joinedMembers.some(
        (member) => member.contactId === currentUserId
      );
      const isInvited = invitedMembers.some(
        (member) => member.contactId === currentUserId
      );
      // clubs continue to show up after being declined, so we need to make sure you're
      // either a member or invited before importing it
      if (!isJoined && !isInvited) {
        return null;
      }

      const metaFields = toClientMeta(club.meta);

      // Channel meta is different from other metas, since we can overload the
      // `description` to fit other channel-specific data.
      // Attempt to decode that extra info here.
      const decodedDesc = StructuredChannelDescriptionPayload.decode(
        metaFields.description
      );

      return {
        id,
        type: 'groupDm',
        ...metaFields,
        isDmInvite: !isJoined && isInvited,
        members: [...joinedMembers, ...invitedMembers],
        contentConfiguration: decodedDesc.channelContentConfiguration,
        description: decodedDesc.description,
      };
    })
    .filter(Boolean) as db.Channel[];
};
