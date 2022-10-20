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
import heapHandlers from '@/mocks/heaps';
import mockGroups, {
  createMockIndex,
  mockGangs,
  pinnedGroups,
} from '@/mocks/groups';
import {
  makeFakeChatWrits,
  chatKeys,
  dmList,
  pendingDMs,
  pinnedDMs,
} from '@/mocks/chat';
import {
  ChatBriefs,
  ChatDiff,
  ChatStory,
  ChatWhom,
  Club,
  ClubAction,
  ClubCreate,
  DmRsvp,
  Pins,
  WritDiff,
} from '@/types/chat';
import { GroupAction } from '@/types/groups';
import mockContacts from '@/mocks/contacts';

const getNowUd = () => decToUd(unixToDa(Date.now() * 1000).toString());

const archive: string[] = [];
let pins: string[] = [...pinnedDMs, ...pinnedGroups];
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

const briefsSub = {
  action: 'subscribe',
  app: 'chat',
  path: `/briefs`,
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
    mark: 'group-action-0',
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
  {
    action: 'scry',
    app: 'chat',
    path: '/pins',
    func: () => ({ pins }),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-pins',
    returnSubscription: fakeDefaultSub,
    initialResponder: (req: Message & Poke<Pins>) => {
      pins = req.json.pins;

      return createResponse(req);
    },
    dataResponder: (req) => createResponse(req, 'diff'),
  },
  {
    action: 'poke',
    app: 'chat',
    mark: 'chat-action-0',
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
        '0v4.00000.qcas9.qndoa.7loa7.loa7l': {
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

        api.publishUpdate(
          briefsSub,
          {
            whom: req.json.ship,
            brief,
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
    mark: 'club-action',
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
