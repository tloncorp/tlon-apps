import { Poke, unixToDa } from '@urbit/api';

import * as db from '../db';
import { JSONToInlines } from '../logic/tiptap';
import * as ub from '../urbit';
import {
  ClubAction,
  ClubDelta,
  DmAction,
  JSONContent,
  WritDelta,
  WritDeltaAdd,
  WritDiff,
  WritResponse,
  constructStory,
  whomIsDm,
} from '../urbit';
import { formatUd, toClientMeta } from './converters';
import { poke, scry } from './urbit';

interface OptimisticAction {
  action: Poke<DmAction | ClubAction>;
  event: WritDiff | WritResponse;
}

function dmAction(ship: string, delta: WritDelta, id: string): Poke<DmAction> {
  return {
    app: 'chat',
    mark: 'chat-dm-action',
    json: {
      ship,
      diff: {
        id,
        delta,
      },
    },
  };
}

function multiDmAction(id: string, delta: ClubDelta): Poke<ClubAction> {
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

function getActionAndEvent(
  whom: string,
  id: string,
  delta: WritDelta
): OptimisticAction {
  if (whomIsDm(whom)) {
    const action = dmAction(whom, delta, id);
    return {
      action,
      event: action.json.diff,
    };
  }

  const diff: WritDiff = { id, delta };
  return {
    action: multiDmAction(whom, { writ: diff }),
    event: diff,
  };
}

export const markChatRead = (whom: string) =>
  poke({
    app: 'chat',
    mark: 'chat-remark-action',
    json: {
      whom,
      diff: { read: null },
    },
  });

export const sendDirectMessage = async (
  to: string,
  content: JSONContent,
  author: string
) => {
  const inlines = JSONToInlines(content);
  const story = constructStory(inlines);

  const delta: WritDeltaAdd = {
    add: {
      memo: {
        content: story,
        sent: Date.now(),
        author,
      },
      kind: null,
      time: null,
    },
  };

  const { action } = getActionAndEvent(
    to,
    `${delta.add.memo.author}/${formatUd(unixToDa(delta.add.memo.sent).toString())}`,
    delta
  );
  await poke(action);
};

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
