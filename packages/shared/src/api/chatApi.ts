import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { getCanonicalPostId, toClientMeta } from './apiUtils';
import { toPostData } from './postsApi';
import { getCurrentUserId, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('chatApi', true);

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

export type ChatEvent =
  | { type: 'addDmInvites'; channels: db.Channel[] }
  | { type: 'groupDmsUpdate' }
  | { type: 'unknown' };
export function subscribeToChatUpdates(
  eventHandler: (event: ChatEvent) => void
) {
  const currentUserId = getCurrentUserId();

  // subscribe(
  //   {
  //     app: 'chat',
  //     path: '/dm/invited',
  //   },
  //   (data) => {
  //     logger.log('subscribeToChatUpdates', data);
  //     eventHandler(
  //       {
  //         type: 'addDmInvites',
  //         channels: toClientDms(data as string[], true),
  //       },
  //       currentUserId
  //     );
  //   }
  // );

  // subscribe(
  //   {
  //     app: 'chat',
  //     path: '/clubs',
  //   },
  //   (data) => {
  //     logger.log('subscribeToChatUpdates', data);
  //     eventHandler(
  //       {
  //         type: 'groupDmsUpdate',
  //       },
  //       currentUserId
  //     );
  //   }
  // );

  subscribe(
    {
      app: 'chat',
      path: '/',
    },
    (event: ub.WritResponse | { unknown: 'placeholder' }) => {
      logger.log('raw chat sub event', event);

      if (!('response' in event)) {
        logger.log('unknown event type');
        return;
      }

      const id = getCanonicalPostId(event.id);
      const delta = event.response;

      if ('add' in delta) {
        logger.log('add dm', id, delta);
      }

      if ('del' in delta) {
        logger.log('del dm', id, delta);
      }

      if ('add-react' in delta) {
        logger.log('add react', id, delta);
      }

      if ('del-react' in delta) {
        logger.log('del react', id, delta);
      }

      if ('reply' in delta) {
        const replyId = getCanonicalPostId(delta.reply.id);
        const replyDelta = delta.reply.delta;
        const replyMeta = delta.reply.meta;

        if ('add' in replyDelta) {
          logger.log('add dm reply', id, delta);
        }

        if ('del' in replyDelta) {
          logger.log('del dm reply', id, delta);
        }

        if ('add-react' in delta) {
          logger.log('add react reply', id, delta);
        }

        if ('del-react' in replyDelta) {
          logger.log('del react reply', id, delta);
        }
      }

      eventHandler({ type: 'unknown' });
    }
  );
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

function multiDmAction(id: string, delta: ub.ClubDelta) {
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
    .map(([id, club]) => {
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

      return {
        id,
        type: 'groupDm',
        ...toClientMeta(club.meta),
        isDmInvite: !isJoined && isInvited,
        members: [...joinedMembers, ...invitedMembers],
      };
    })
    .filter(Boolean) as db.Channel[];
};
