import * as db from '../db';
import * as ub from '../urbit';
import { toClientMeta } from './apiUtils';
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
  return Object.entries(groupDms).map(
    ([id, club]): db.Channel => ({
      id,
      type: 'groupDm',
      ...toClientMeta(club.meta),
      members: club.team.map(
        (member): db.ChatMember => ({
          contactId: member,
          chatId: id,
          membershipType: 'channel',
        })
      ),
    })
  );
};
