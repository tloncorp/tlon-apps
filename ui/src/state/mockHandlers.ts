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
  chatSub,
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-action',
    returnSubscription: chatSub,
    dataResponder: (
      req: Message &
        Poke<{ flag: string; update: { time: string; diff: ChatDiff } }>
    ) => ({
      id: req.id,
      ok: true,
      response: 'diff',
      json: {
        ...req.json.update,
        time: getNowUd(),
      },
    }),
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
  ...groupSubs,
];

export default mockHandlers;
