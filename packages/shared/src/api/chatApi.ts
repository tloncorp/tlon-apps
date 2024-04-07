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

export type GetDmsResponse = (db.ChannelInsert & {
  members: db.ChannelMember[];
})[];

export const getDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/dm' })) as string[];
  return result.map((id) => {
    return {
      id,
      type: 'dm',
      title: '',
      description: '',
      members: [{ channelId: id, contactId: id }],
    };
  });
};

export const getGroupDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/clubs' })) as ub.Clubs;
  return Object.entries(result).map(([id, club]) => ({
    id,
    type: 'groupDm',
    ...toClientMeta(club.meta),
    members: club.team.map((member) => ({
      contactId: member,
      channelId: id,
    })),
  }));
};
