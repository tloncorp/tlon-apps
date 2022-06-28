import UrbitMock, {
  createResponse,
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
import mockGroups, { mockGangs, pinnedGroups } from './groups';
import {
  makeFakeChatWrits,
  chatKeys,
  dmList,
  pendingDMs,
  pinnedDMs,
} from './chat';
import {
  ChatBriefs,
  ChatDiff,
  ChatStory,
  ChatWhom,
  Club,
  ClubCreate,
  DmRsvp,
  WritDiff,
} from '../types/chat';
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

const fakeDefaultSub = {
  action: 'subscribe',
  app: 'chat',
  path: '/',
} as SubscriptionRequestInterface;

const groupSub = {
  action: 'subscribe',
  app: 'groups',
  path: '/groups/ui',
} as SubscriptionHandler;

const specificGroupSub = {
  action: 'subscribe',
  app: 'groups',
  path: '/groups/:ship/name/ui',
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
  initialResponder: (req) =>
    createResponse(req, 'diff', {
      'contact-update': {
        initial: {
          'is-public': false,
          rolodex: mockContacts,
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
  specificGroupSub,
  {
    action: 'poke',
    app: 'groups',
    mark: 'group-action',
    returnSubscription: specificGroupSub,
    dataResponder: (req: Message & Poke<GroupAction>) =>
      createResponse(req, 'diff', {
        ...req.json.update,
        time: getNowUd(),
      }),
  },
  {
    action: 'scry',
    app: 'groups',
    path: '/groups/pinned',
    func: () => pinnedGroups,
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

const chatSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/chat/:ship/:name/ui/writs`,
} as SubscriptionHandler;

const chat: Handler[] = [
  {
    action: 'scry',
    app: 'chat',
    path: `/chat/:ship/:name/writs/newest/100`,
    func: () => chatWritsSet1,
  } as ScryHandler,
  {
    action: 'scry' as const,
    app: 'chat',
    path: `/chat/:ship/:name/perm`,
    func: () => ({
      writers: [],
    }),
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
        return createResponse(req, 'diff', req.json.update.diff.writs);
      }

      return {
        id: req.id,
        ok: true,
      };
    },
  } as PokeHandler,
  briefsSub,
  {
    action: 'scry' as const,
    app: 'chat',
    path: '/briefs',
    func: () => {
      const unarchived = _.fromPairs(
        Object.entries(dmList).filter(([k]) => !archive.includes(k))
      );

      const briefs: ChatBriefs = {};
      Object.values(mockGroups).forEach((group) =>
        Object.entries(group.channels).forEach(([k]) => {
          briefs[k] = {
            last: 1652302200000,
            count: 1,
            'read-id': null,
          };
        })
      );

      return {
        ...unarchived,
        ...briefs,
        '0w20.000dc.lbOWD.veShq.7aM8c': {
          last: 1652302200000,
          count: 1,
          'read-id': null,
        },
        '~zod/test': {
          last: 1652302200000,
          count: 1,
          'read-id': null,
        },
      };
    },
  },
  {
    action: 'scry',
    app: 'chat',
    path: `/draft/:ship/:name`,
    func: (p, api, params) => {
      if (!params) {
        return '';
      }

      const key = params.name
        ? `draft-${params.ship}/${params.name}`
        : `draft-${params.ship}`;

      return JSON.parse(localStorage.getItem(key) || '');
    },
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-draft',
    returnSubscription: {
      action: 'subscribe',
      app: 'chat',
      path: '/',
    } as SubscriptionRequestInterface,
    dataResponder: (
      req: Message & Poke<{ whom: ChatWhom; story: ChatStory }>
    ) => {
      localStorage.setItem(`draft-${req.json.whom}`, JSON.stringify(req.json));

      return {
        id: req.id!,
        ok: true,
        response: 'diff',
        json: req.json,
      };
    },
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
    ) =>
      createResponse(req, 'diff', {
        whom: req.json.whom,
        brief: { last: 0, count: 0, 'read-id': null },
      }),
  },
];

const olderChats: Handler[] = [
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set1Da}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set2Da}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set3Da}/100`,
    app: 'chat',
    func: () => chatWritsSet4,
  },
];

const dmSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/dm/:ship/ui`,
} as SubscriptionHandler;

const dms: Handler[] = [
  dmSub,
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/newest/100`,
    app: 'chat',
    func: () => chatWritsSet1,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set1Da}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set2Da}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set3Da}/100`,
    app: 'chat',
    func: () => chatWritsSet4,
  },
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
    func: () => pendingDMs,
  },
  {
    action: 'subscribe',
    app: 'chat',
    path: '/dm/invited',
  },
  {
    action: 'scry',
    app: 'chat',
    path: '/dm/pinned',
    func: () => pinnedDMs,
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
    returnSubscription: dmSub,
    initialResponder: (
      req: Message & Poke<{ ship: string; diff: WritDiff }>,
      api: UrbitMock
    ) => {
      if (!Object.keys(dmList).includes(req.json.ship)) {
        const brief = {
          last: 1652302200000,
          count: 1,
          'read-id': null,
        };
        dmList[req.json.ship] = brief;

        api.publishUpdate(briefsSub, {
          whom: req.json.ship,
          brief,
        });
      }

      return createResponse(req);
    },
    dataResponder: (req: Message & Poke<{ ship: string; diff: WritDiff }>) =>
      createResponse(req, 'diff', req.json.diff),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'dm-rsvp',
    returnSubscription: {
      action: 'subscribe',
      app: 'chat',
      path: '/',
    } as SubscriptionRequestInterface,
    dataResponder: (req: Message & Poke<DmRsvp>) => {
      if (req.json.ok) {
        archive.splice(archive.indexOf(req.json.ship), 1);
      } else {
        archive.push(req.json.ship);
      }

      return createResponse(req, 'diff');
    },
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

      return createResponse(req, 'diff');
    },
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'dm-unarchive',
    returnSubscription: fakeDefaultSub,
    dataResponder: (req: Message & Poke<string>) => {
      const index = archive.indexOf(req.json);
      archive.splice(index, 1);

      return createResponse(req, 'diff');
    },
  },
];

const clubs: { [id: string]: Club } = {
  '0w20.000dc.lbOWD.veShq.7aM8c': {
    team: ['~nocsyx-lassul', '~datder-sonnet'],
    hive: ['~rilfun-lidlen', '~finned-palmer'],
    meta: {
      title: 'Pain Gang',
      description: '',
      image: '',
      color: '',
    },
  },
};

const clubSub = {
  action: 'subscribe',
  app: 'chat',
  path: '/club/:id/ui',
} as SubscriptionHandler;

const clubHandlers: Handler[] = [
  clubSub,
  {
    action: 'scry',
    app: 'chat',
    path: '/club/:id/writs/newest/:count',
    func: () => ({}),
  },
  {
    action: 'subscribe',
    app: 'chat',
    path: '/club/:id/ui/writs',
  },
  {
    action: 'scry',
    app: 'chat',
    path: '/club/:id/crew',
    func: (req, api, params) => {
      if (!params || !(params.id in clubs)) {
        return null;
      }

      return clubs[params.id];
    },
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'club-action',
    returnSubscription: clubSub,
    dataResponder: (req) => createResponse(req, 'diff', req.json),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'club-create',
    returnSubscription: fakeDefaultSub,
    dataResponder: (req: Message & Poke<ClubCreate>) => {
      clubs[req.json.id] = {
        team: [window.our],
        hive: req.json.hive,
        meta: {
          title: '',
          description: '',
          image: '',
          color: '',
        },
      };

      return createResponse(req, 'diff');
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
).concat(groups, chat, dms, olderChats, clubHandlers);

export default mockHandlers;
