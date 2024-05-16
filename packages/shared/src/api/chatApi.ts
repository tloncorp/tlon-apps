import * as db from '../db';
import * as ub from '../urbit';
import { toClientMeta } from './converters';
import { poke, scry } from './urbit';

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

export const respondToMultiDMInvite = {};

export type GetDmsResponse = db.Channel[];

export const getDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/dm' })) as string[];
  return toClientDms(result);
};

export const toClientDms = (dmContacts: string[]) => {
  return dmContacts.map((id): db.Channel => {
    return {
      id,
      type: 'dm' as const,
      title: '',
      description: '',
      members: [{ chatId: id, contactId: id, membershipType: 'channel' }],
    };
  });
};

export const getGroupDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/clubs' })) as ub.Clubs;
  return toClientGroupDms(result);
};

export const toClientGroupDms = (groupDms: ub.Clubs): GetDmsResponse => {
  return Object.entries(groupDms).map(([id, club]): db.Channel => {
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

    return {
      id,
      type: 'groupDm',
      ...toClientMeta(club.meta),
      members: [...joinedMembers, ...invitedMembers],
    };
  });
};
