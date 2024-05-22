import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { toClientMeta } from './apiUtils';
import { poke, scry, subscribe } from './urbit';

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
  currentUserId,
}: {
  id: string;
  members: string[];
  currentUserId: string;
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
  currentUserId,
}: {
  channel: db.Channel;
  accept: boolean;
  currentUserId: string;
}) => {
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
  | { type: 'groupDmsUpdate' };
export function subscribeToChatUpdates(
  currentUserId: string,
  eventHandler: (event: ChatEvent, currentUserId: string) => void
) {
  subscribe(
    {
      app: 'chat',
      path: '/dm/invited',
    },
    (data) => {
      logger.log('subscribeToChatUpdates', data);
      eventHandler(
        {
          type: 'addDmInvites',
          channels: toClientDms(data as string[], true),
        },
        currentUserId
      );
    }
  );

  subscribe(
    {
      app: 'chat',
      path: '/clubs',
    },
    (data) => {
      logger.log('subscribeToChatUpdates', data);
      eventHandler(
        {
          type: 'groupDmsUpdate',
        },
        currentUserId
      );
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

export const getGroupDms = async (
  currentUserId: string
): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/clubs' })) as ub.Clubs;
  return toClientGroupDms(result, currentUserId);
};

export const toClientGroupDms = (
  groupDms: ub.Clubs,
  currentUserId: string
): GetDmsResponse => {
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
