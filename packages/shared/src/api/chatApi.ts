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

function getActionAndEvent(
  whom: string,
  id: string,
  delta: WritDelta
): OptimisticAction {
  if (whomIsDm(whom)) {
    const action: Poke<DmAction> = {
      app: 'chat',
      mark: 'chat-dm-action',
      json: {
        ship: whom,
        diff: {
          id,
          delta,
        },
      },
    };
    return {
      action,
      event: action.json.diff,
    };
  }

  const diff: WritDiff = { id, delta };
  const action: Poke<ClubAction> = {
    app: 'chat',
    mark: 'chat-club-action-0',
    json: {
      id: whom,
      diff: {
        uid: '0v3',
        delta: { writ: diff },
      },
    },
  };

  return {
    action,
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
  author: string,
  blocks?: ub.Block[]
) => {
  const inlines = JSONToInlines(content);
  const story = constructStory(inlines);

  if (blocks && blocks.length > 0) {
    story.push(...blocks.map((b) => ({ block: b })));
  }

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

export type GetDmsResponse = db.ChannelInsert[];

export const getDms = async (): Promise<GetDmsResponse> => {
  const result = (await scry({ app: 'chat', path: '/dm' })) as string[];
  return toClientDms(result);
};

export const toClientDms = (dmContacts: string[]) => {
  return dmContacts.map((id): db.ChannelInsert => {
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
    ([id, club]): db.ChannelInsert => ({
      id,
      type: 'groupDm',
      ...toClientMeta(club.meta),
      members: club.team.map(
        (member): db.ChatMemberInsert => ({
          contactId: member,
          chatId: id,
          membershipType: 'channel',
        })
      ),
    })
  );
};
