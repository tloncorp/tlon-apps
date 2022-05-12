import {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
} from '@tloncorp/mock-http-api';
import { decToUd, unixToDa } from '@urbit/api';
import mockGroups, { mockGangs } from '../mocks/groups';
import chatWrits, { chatKeys, chatPerm } from '../mocks/mockWrits';
import { ChatDiff } from '../types/chat';
import { GroupAction } from '../types/groups';

const getNowUd = () => decToUd(unixToDa(Date.now() * 1000).toString());

const chatSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/chat/~zod/test/ui`,
} as SubscriptionHandler;

const groupSubs = ['~zod/tlon'].map(
  (g): SubscriptionHandler => ({
    action: 'subscribe',
    app: 'groups',
    path: `/groups/${g}/ui`,
  })
);

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
      const poke = {
        id: req.id,
        ok: true,
        response: 'diff',
        json: {
          ...req.json.update,
          time: getNowUd(),
        },
      };

      if ('draft' in req.json.update.diff) {
        localStorage.setItem(
          req.json.flag,
          JSON.stringify(req.json.update.diff.draft)
        );
      }

      return poke;
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
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/perm',
    func: () => chatPerm,
  } as ScryHandler,

  ...groupSubs,
];

export default mockHandlers;
