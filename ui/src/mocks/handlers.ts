import {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
} from '@tloncorp/mock-http-api';
import { decToUd, unixToDa } from '@urbit/api';

import mockGroups, { mockGangs } from './groups';
import chatWrits, { chatKeys, chatPerm, dmList } from './chat';
import { ChatDiff, WritDiff } from '../types/chat';
import { GroupAction } from '../types/groups';

const getNowUd = () => decToUd(unixToDa(Date.now() * 1000).toString());

const chatSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/chat/~zod/test/ui/writs`,
} as SubscriptionHandler;

const groupSubs = ['~zod/tlon'].map(
  (g): SubscriptionHandler => ({
    action: 'subscribe',
    app: 'groups',
    path: `/groups/${g}/ui`,
  })
);
const dmSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/dm/~hastuc-dibtux/ui`,
} as SubscriptionHandler;

const mockDm = dmList
  .map((ship): Handler[] => [
    {
      action: 'scry' as const,
      path: `/dm/${ship}/writs/newest/100`,
      app: 'chat',
      func: () => chatWrits,
    },
    {
      action: 'poke',
      app: 'chat',
      mark: 'dm-action',
      returnSubscription: dmSub,
      dataResponder: (
        req: Message & Poke<{ ship: string; diff: WritDiff }>
      ) => ({
        id: req.id!,
        ok: true,
        response: 'diff',
        json: req.json.diff,
      }),
    },
  ])
  .flat();

const mockHandlers: Handler[] = [
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/writs/newest/100',
    func: () => chatWrits,
  } as ScryHandler,
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/draft',
    func: () => JSON.parse(localStorage.getItem('~zod/test') || ''),
  },
  chatSub,
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-action',
    returnSubscription: chatSub,
    dataResponder: (
      req: Message &
        Poke<{ flag: string; update: { time: string; diff: ChatDiff } }>
    ) => {
      if ('writs' in req.json.update.diff) {
        return {
          id: req.id,
          ok: true,
          response: 'diff',
          json: req.json.update.diff.writs,
        };
      }

      if ('draft' in req.json.update.diff) {
        localStorage.setItem(
          req.json.flag,
          JSON.stringify(req.json.update.diff.draft)
        );
      }
      return {
        id: req.id,
        ok: true,
      };
    },
  } as PokeHandler,
  {
    action: 'poke',
    app: 'groups',
    mark: 'group-action',
    returnSubscription: groupSubs[0],
    dataResponder: (req: Message & Poke<GroupAction>) => ({
      id: req.id!,
      ok: true,
      response: 'diff',
      json: {
        ...req.json.update,
        time: getNowUd(),
      },
    }),
  },
  {
    action: 'scry' as const,
    app: 'chat',
    path: '/dm',
    func: () => dmList,
  },
  {
    action: 'scry' as const,
    app: 'chat',
    path: '/chat/~zod/test/perm',
    func: () => ({
      writers: [],
    }),
  },

  {
    action: 'scry',
    app: 'groups',
    path: '/groups',
    func: () => mockGroups,
  } as ScryHandler,
  {
    action: 'scry',
    app: 'groups',
    path: '/gangs',
    func: () => mockGangs,
  } as ScryHandler,
  {
    action: 'scry',
    app: 'chat',
    path: '/chat',
    func: () => chatKeys,
  } as ScryHandler,
  ...groupSubs,
  dmSub,
  ...mockDm,
];

export default mockHandlers;
