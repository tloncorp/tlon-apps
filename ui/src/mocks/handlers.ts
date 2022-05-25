import {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
  SubscriptionRequestInterface,
} from '@tloncorp/mock-http-api';
import { decToUd, udToDec, unixToDa } from '@urbit/api';

import _ from 'lodash';
import bigInt from 'big-integer';
import mockGroups, { mockGangs } from './groups';
import { makeFakeChatWrits, chatKeys, dmList } from './chat';
import { ChatDiff, ChatWhom, DmAction, WritDiff } from '../types/chat';
import { GroupAction } from '../types/groups';
import mockContacts from './contacts';

const getNowUd = () => decToUd(unixToDa(Date.now() * 1000).toString());

const archive: string[] = [];
const sortByUd = (aString: string, bString: string) => {
  const a = bigInt(udToDec(aString));
  const b = bigInt(udToDec(bString));

  return a.compare(b);
};

const chatWritsSet1 = makeFakeChatWrits(0);
const startIndexSet1 = Object.keys(chatWritsSet1).sort(sortByUd)[0];
const set1Da = startIndexSet1;

const chatWritsSet2 = makeFakeChatWrits(1);
const startIndexSet2 = Object.keys(chatWritsSet2).sort(sortByUd)[0];
const set2Da = startIndexSet2;

const chatWritsSet3 = makeFakeChatWrits(2);
const startIndexSet3 = Object.keys(chatWritsSet3).sort(sortByUd)[0];
const set3Da = startIndexSet3;

const chatWritsSet4 = makeFakeChatWrits(3);

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

const groupSub = {
  action: 'subscribe',
  app: 'groups',
  path: '/groups/ui',
} as SubscriptionHandler;

const briefsSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/briefs`,
} as SubscriptionHandler;

const settingsSub = {
  action: 'subscribe',
  app: 'settings-store',
  path: '/desk/homestead',
} as SubscriptionHandler;

const contactSub = {
  action: 'subscribe',
  app: 'contact-store',
  path: '/all',
  initialResponder: (req) => ({
    id: req.id!,
    ok: true,
    response: 'diff',
    json: {
      'contact-update': {
        initial: {
          'is-public': false,
          rolodex: mockContacts,
        },
      },
    },
  }),
} as SubscriptionHandler;

const contactNacksSub = {
  action: 'subscribe',
  app: 'contact-pull-hook',
  path: '/nacks',
} as SubscriptionHandler;

const groups: Handler[] = [
  groupSub,
  ...groupSubs,
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
];

const chat: Handler[] = [
  chatSub,
  briefsSub,
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/writs/newest/100',
    func: () => chatWritsSet1,
  } as ScryHandler,
  {
    action: 'scry',
    app: 'chat',
    path: '/chat/~zod/test/draft',
    func: () => JSON.parse(localStorage.getItem('~zod/test') || ''),
  },
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
    action: 'scry' as const,
    app: 'chat',
    path: '/briefs',
    func: () => {
      const unarchived = _.fromPairs(
        Object.entries(dmList).filter(([k]) => !archive.includes(k))
      );
      return {
        ...unarchived,
        '~zod/test': {
          last: 1652302200000,
          count: 1,
          'read-id': null,
        },
      };
    },
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
    app: 'chat',
    path: '/chat',
    func: () => chatKeys,
  } as ScryHandler,
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-remark-action',
    returnSubscription: briefsSub,
    dataResponder: (
      req: Message & Poke<{ whom: ChatWhom; diff: { read: null } }>
    ) => ({
      id: req.id!,
      ok: true,
      response: 'diff',
      json: {
        whom: req.json.whom,
        brief: { last: 0, count: 0, 'read-id': null },
      },
    }),
  },
];

const olderChats: Handler[] = [
  {
    action: 'scry' as const,
    path: `/chat/~zod/test/writs/older/${set1Da}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/chat/~zod/test/writs/older/${set2Da}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  {
    action: 'scry' as const,
    path: `/chat/~zod/test/writs/older/${set3Da}/100`,
    app: 'chat',
    func: () => chatWritsSet4,
  },
];

const dmHandlers = Object.keys(dmList)
  .map((ship): Handler[] => {
    const dmSub = {
      action: 'subscribe',
      app: 'chat',
      path: `/dm/${ship}/ui`,
    } as SubscriptionHandler;

    return [
      {
        action: 'scry' as const,
        path: `/dm/${ship}/writs/newest/100`,
        app: 'chat',
        func: () => chatWritsSet1,
      },
      {
        action: 'scry' as const,
        path: `/dm/${ship}/writs/older/${set1Da}/100`,
        app: 'chat',
        func: () => chatWritsSet2,
      },
      {
        action: 'scry' as const,
        path: `/dm/${ship}/writs/older/${set2Da}/100`,
        app: 'chat',
        func: () => chatWritsSet3,
      },
      {
        action: 'scry' as const,
        path: `/dm/${ship}/writs/older/${set3Da}/100`,
        app: 'chat',
        func: () => chatWritsSet4,
      },
      dmSub,
    ];
  })
  .flat();

const dms: Handler[] = [
  ...dmHandlers,
  {
    action: 'scry',
    app: 'chat',
    path: '/dm',
    func: () => Object.keys(dmList).filter((k) => !archive.includes(k)),
  },
  {
    action: 'scry',
    app: 'chat',
    path: '/dm/invited',
    func: () => [],
  },
  {
    action: 'scry',
    app: 'chat',
    path: '/dm/archive',
    func: () => archive,
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'dm-action',
    returnSubscription: (req: Message & Poke<DmAction>) =>
      (dmHandlers.find(
        (h) => h.action === 'subscribe' && h.path === `/dm/${req.json.ship}/ui`
      ) || {
        action: 'subscribe',
        app: 'chat',
        path: '/',
      }) as SubscriptionRequestInterface,
    dataResponder: (req: Message & Poke<{ ship: string; diff: WritDiff }>) => ({
      id: req.id!,
      ok: true,
      response: 'diff',
      json: req.json.diff,
    }),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'dm-archive',
    returnSubscription: {
      action: 'subscribe',
      app: 'chat',
      path: '/',
    } as SubscriptionRequestInterface,
    dataResponder: (req: Message & Poke<string>) => {
      archive.push(req.json);

      return {
        id: req.id!,
        ok: true,
        response: 'diff',
        json: req.json,
      };
    },
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'dm-unarchive',
    returnSubscription: {
      action: 'subscribe',
      app: 'chat',
      path: '/',
    } as SubscriptionRequestInterface,
    dataResponder: (req: Message & Poke<string>) => {
      const index = archive.indexOf(req.json);
      archive.splice(index, 1);

      return {
        id: req.id!,
        ok: true,
        response: 'diff',
        json: req.json,
      };
    },
  },
];

const mockHandlers: Handler[] = (
  [
    settingsSub,
    contactSub,
    contactNacksSub,
    {
      action: 'scry',
      app: 'settings-store',
      path: '/desk/homestead',
      func: () => ({
        desk: {
          display: {
            theme: 'auto',
          },
        },
      }),
    },
  ] as Handler[]
).concat(groups, chat, dms, olderChats);

export default mockHandlers;
