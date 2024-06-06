import UrbitMock, {
  Handler,
  Message,
  Poke,
  PokeHandler,
  ScryHandler,
  SubscriptionHandler,
  SubscriptionRequestInterface,
  createResponse,
} from '@tloncorp/mock-http-api';
import {
  Club,
  ClubAction,
  ClubCreate,
  DMUnreads,
  DMWhom,
  DmRsvp,
  WritDiff,
} from '@tloncorp/shared/dist/urbit/dms';
import { GroupAction } from '@tloncorp/shared/dist/urbit/groups';
import { decToUd, udToDec, unixToDa } from '@urbit/api';
import bigInt from 'big-integer';
import _ from 'lodash';

import {
  chatKeys,
  dmList,
  makeFakeChatWrits,
  pendingDMs,
  pinnedDMs,
} from '@/mocks/chat';
import mockContacts from '@/mocks/contacts';
import mockGroups, {
  createMockIndex,
  mockGangs,
  pinnedGroups,
} from '@/mocks/groups';
import heapHandlers from '@/mocks/heaps';

const getNowUd = () => decToUd(unixToDa(Date.now() * 1000).toString());

const archive: string[] = [];
const pins: string[] = [...pinnedDMs, ...pinnedGroups];
const sortByUd = (aString: string, bString: string) => {
  const a = bigInt(udToDec(aString));
  const b = bigInt(udToDec(bString));

  return a.compare(b);
};

const emptyChatWritsSet = {};

const chatWritsSet1 = makeFakeChatWrits(0);
const chatWritsSet1Keys = Object.keys(chatWritsSet1).sort(sortByUd);
const startIndexSet1 = chatWritsSet1Keys[0];
const set1StartDa = startIndexSet1;
const set1EndDa = chatWritsSet1Keys[chatWritsSet1Keys.length - 1];

const chatWritsSet2 = makeFakeChatWrits(1);
const chatWritsSet2Keys = Object.keys(chatWritsSet2).sort(sortByUd);
const startIndexSet2 = chatWritsSet2Keys[0];
const set2StartDa = startIndexSet2;
const set2EndDa = chatWritsSet2Keys[chatWritsSet2Keys.length - 1];

const chatWritsSet3 = makeFakeChatWrits(2);
const chatWritsSet3Keys = Object.keys(chatWritsSet3).sort(sortByUd);
const startIndexSet3 = chatWritsSet3Keys[0];
const set3StartDa = startIndexSet3;
const set3EndDa = chatWritsSet3Keys[chatWritsSet3Keys.length - 1];

const chatWritsSet4 = makeFakeChatWrits(3);
const chatWritsSet4Keys = Object.keys(chatWritsSet4).sort(sortByUd);
const startIndexSet4 = chatWritsSet4Keys[0];
const set4StartDa = startIndexSet4;
const set4EndDa = chatWritsSet4Keys[chatWritsSet4Keys.length - 1];

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
  path: '/groups/:ship/:name/ui',
} as SubscriptionHandler;

const unreadsSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/unreads`,
} as SubscriptionHandler;

const settingsSub = {
  action: 'subscribe',
  app: 'settings-store',
  path: '/desk/groups',
} as SubscriptionHandler;

const settingsPoke: PokeHandler = {
  action: 'poke',
  app: 'settings-store',
  mark: 'settings-action',
  returnSubscription: settingsSub,
  dataResponder: (req: Message & Poke<any>) => createResponse(req),
};

const contactSub = {
  action: 'subscribe',
  app: 'contact-store',
  path: '/all',
  initialResponder: (req) =>
    createResponse(req, 'diff', {
      'contact-update-0': {
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

const groupIndexSub = {
  action: 'subscribe',
  app: 'groups',
  path: '/gangs/index/:ship',
  initialResponder: (req) =>
    createResponse(req, 'diff', {
      ...createMockIndex(req.ship),
    }),
} as SubscriptionHandler;

const groups: Handler[] = [
  groupSub,
  specificGroupSub,
  {
    action: 'poke',
    app: 'groups',
    mark: 'group-action-2',
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
    path: '/groups',
    func: () => mockGroups,
  } as ScryHandler,
  {
    action: 'scry',
    app: 'groups',
    path: '/gangs',
    func: () => mockGangs,
  } as ScryHandler,
  groupIndexSub,
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
    action: 'scry',
    app: 'chat',
    path: `/chat/:ship/:name/perm`,
    func: () => ({
      writers: [],
    }),
  },
  unreadsSub,
  {
    action: 'scry' as const,
    app: 'chat',
    path: '/unreads',
    func: () => {
      const unarchived = _.fromPairs(
        Object.entries(dmList).filter(([k]) => !archive.includes(k))
      );

      const unreads: DMUnreads = {};
      Object.values(mockGroups).forEach((group) =>
        Object.entries(group.channels).forEach(([k]) => {
          unreads[k] = {
            recency: 1652302200000,
            count: 1,
            unread: null,
            threads: {},
          };
        })
      );

      return {
        ...unarchived,
        ...unreads,
        '0v4.00000.qcas9.qndoa.7loa7.loa7l': {
          recency: 1652302200000,
          count: 1,
          unread: null,
          threads: {},
        },
        '~zod/test': {
          recency: 1652302200000,
          count: 1,
          unread: null,
          threads: {},
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
    action: 'scry',
    app: 'chat',
    path: '/chat',
    func: () => chatKeys,
  } as ScryHandler,
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-remark-action',
    returnSubscription: unreadsSub,
    dataResponder: (
      req: Message & Poke<{ whom: DMWhom; diff: { read: null } }>
    ) =>
      createResponse(req, 'diff', {
        whom: req.json.whom,
        unread: {
          recency: 0,
          count: 0,
          unread: null,
          threads: {},
        },
      }),
  },
];

const newerChats: ScryHandler[] = [
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/newer/${set1EndDa}/100`,
    app: 'chat',
    func: () => emptyChatWritsSet,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/newer/${set2EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet1,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/newer/${set3EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/newer/${set4EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
];

const olderChats: ScryHandler[] = [
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set1StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set2StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set3StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet4,
  },
  {
    action: 'scry' as const,
    path: `/chat/:ship/:name/writs/older/${set4StartDa}/100`,
    app: 'chat',
    func: () => emptyChatWritsSet,
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
  // newer
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/newer/${set1EndDa}/100`,
    app: 'chat',
    func: () => emptyChatWritsSet,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/newer/${set2EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet1,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/newer/${set3EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/newer/${set4EndDa}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  // older
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set1StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet2,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set2StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet3,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set3StartDa}/100`,
    app: 'chat',
    func: () => chatWritsSet4,
  },
  {
    action: 'scry' as const,
    path: `/dm/:ship/writs/older/${set4StartDa}/100`,
    app: 'chat',
    func: () => emptyChatWritsSet,
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
    path: '/dm/archive',
    func: () => archive,
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-dm-action',
    returnSubscription: dmSub,
    initialResponder: (
      req: Message & Poke<{ ship: string; diff: WritDiff }>,
      api: UrbitMock
    ) => {
      if (!Object.keys(dmList).includes(req.json.ship)) {
        const unread = {
          recency: 1652302200000,
          count: 1,
          notify: false,
          unread: null,
          children: [],
        };
        dmList[req.json.ship] = unread;

        api.publishUpdate(
          unreadsSub,
          {
            whom: req.json.ship,
            unread,
          },
          req.mark
        );
      }

      return createResponse(req);
    },
    dataResponder: (req: Message & Poke<{ ship: string; diff: WritDiff }>) =>
      createResponse(req, 'diff', req.json.diff),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-dm-rsvp',
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
    mark: 'chat-dm-archive',
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
    mark: 'chat-dm-unarchive',
    returnSubscription: fakeDefaultSub,
    dataResponder: (req: Message & Poke<string>) => {
      const index = archive.indexOf(req.json);
      archive.splice(index, 1);

      return createResponse(req, 'diff');
    },
  },
];

const clubs: { [id: string]: Club } = {
  '0v4.00000.qcas9.qndoa.7loa7.loa7l': {
    team: ['~nocsyx-lassul', '~datder-sonnet'],
    hive: ['~rilfun-lidlen', '~finned-palmer'],
    meta: {
      title: 'Pain Gang',
      description: '',
      image: '',
      cover: '',
    },
  },
};

const clubSub = {
  action: 'subscribe',
  app: 'chat',
  path: '/club/:id/ui',
} as SubscriptionHandler;

const clubWritsSub = {
  action: 'subscribe',
  app: 'chat',
  path: '/club/:id/ui/writs',
} as SubscriptionHandler;

const clubHandlers: Handler[] = [
  clubSub,
  clubWritsSub,
  {
    action: 'subscribe',
    app: 'chat',
    path: '/club/new',
  },
  {
    action: 'scry',
    app: 'chat',
    path: '/club/:id/writs/newest/:count',
    func: () => ({}),
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
    mark: 'chat-club-action',
    returnSubscription: (req: Message & Poke<ClubAction>) =>
      'writ' in req.json.diff.delta ? clubWritsSub : clubSub,
    dataResponder: (req: Message & Poke<ClubAction>) =>
      createResponse(
        req,
        'diff',
        'writ' in req.json.diff.delta
          ? req.json.diff.delta.writ
          : req.json.diff.delta
      ),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-club-create',
    returnSubscription: fakeDefaultSub,
    dataResponder: (req: Message & Poke<ClubCreate>) => {
      clubs[req.json.id] = {
        team: [window.our],
        hive: req.json.hive,
        meta: {
          title: '',
          description: '',
          image: '',
          cover: '',
        },
      };

      return createResponse(req, 'diff');
    },
  },
];

const mockHandlers: Handler[] = (
  [
    settingsSub,
    settingsPoke,
    contactSub,
    contactNacksSub,
    {
      action: 'scry',
      app: 'settings-store',
      path: '/desk/groups',
      func: () => ({
        desk: {
          display: {
            theme: 'auto',
          },
        },
      }),
    },
  ] as Handler[]
).concat(groups, chat, dms, newerChats, olderChats, clubHandlers, heapHandlers);

export default mockHandlers;
