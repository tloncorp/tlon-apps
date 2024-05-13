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
