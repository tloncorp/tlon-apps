import {
  Handler,
  ScryHandler,
  SubscriptionHandler,
} from '@tloncorp/mock-http-api';
import { Channels, Perm, Posts } from '@tloncorp/shared/dist/urbit/channel';
import { subMinutes } from 'date-fns';

const unixTime = subMinutes(new Date(), 1).getTime();

const mockPerms: Perm = {
  writers: ['~zod', '~finned-palmer'],
  group: '~zod/test',
};

const mockStash: Channels = {
  'heap/~zod/testHeap': {
    perms: mockPerms,
    view: 'grid',
    order: [],
    sort: 'time',
    pending: {
      posts: {},
      replies: {},
    },
  },
};

const mockCurios: Posts = {
  '170141184505776467152677676749638598656': {
    seal: {
      id: '170141184505776467152677676749638598656',
      replies: [],
      meta: {
        lastReply: null,
        replyCount: 0,
        lastRepliers: [],
      },
      reacts: {},
    },
    essay: {
      'kind-data': {
        heap: 'House rendering',
      },
      content: [
        {
          inline: [
            'https://finned-palmer.s3.filebase.com/finned-palmer/2022.3.31..15.13.50-rendering1.png',
          ],
        },
      ],
      author: '~finned-palmer',
      sent: unixTime,
    },
  },
  '170141184505776467152677676749638598657': {
    seal: {
      id: '170141184505776467152677676749638598657',
      replies: [],
      meta: {
        lastReply: null,
        replyCount: 0,
        lastRepliers: [],
      },
      reacts: {},
    },
    essay: {
      'kind-data': {
        heap: 'Description of a Martini',
      },
      content: [
        {
          inline: [
            'The martini is a cocktail made with gin and vermouth, and garnished with an olive or a lemon twist.',
          ],
        },
      ],
      author: '~finned-palmer',
      sent: unixTime,
    },
  },
  '170141184505776467152677676749638598658': {
    seal: {
      id: '170141184505776467152677676749638598658',
      replies: [],
      meta: {
        lastReply: null,
        replyCount: 0,
        lastRepliers: [],
      },
      reacts: {},
    },
    essay: {
      'kind-data': {
        heap: 'House rendering',
      },
      content: [
        {
          inline: [
            'https://finned-palmer.s3.filebase.com/finned-palmer/2022.3.31..15.13.50-rendering1.png',
          ],
        },
      ],
      author: '~finned-palmer',
      sent: unixTime,
    },
  },
  '170141184505776467152677676749638598659': {
    seal: {
      id: '170141184505776467152677676749638598659',
      replies: [],
      meta: {
        lastReply: null,
        replyCount: 0,
        lastRepliers: [],
      },
      reacts: {},
    },
    essay: {
      'kind-data': {
        heap: '',
      },
      content: [
        {
          inline: [
            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/15-09-26-RalfR-WLC-0084.jpg/1920px-15-09-26-RalfR-WLC-0084.jpg',
          ],
        },
      ],
      author: '~finned-palmer',
      sent: unixTime,
    },
  },
  '170141184505776467152677676749638598660': {
    seal: {
      id: '170141184505776467152677676749638598660',
      replies: [],
      meta: {
        lastReply: null,
        replyCount: 0,
        lastRepliers: [],
      },
      reacts: {},
    },
    essay: {
      'kind-data': {
        heap: 'One Thing About Me',
      },
      content: [
        {
          inline: [
            'https://twitter.com/noagencynewyork/status/1540353656326946817?s=20&t=OSmaPCFVGbJmjvs1VtJtkg',
          ],
        },
      ],
      author: '~finned-palmer',
      sent: unixTime,
    },
  },
};

export const heapUnreadsSub: SubscriptionHandler = {
  action: 'subscribe',
  app: 'heap',
  path: '/unreads',
};

export const heapStashScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/stash',
  func: () => mockStash,
};

export const heapUnreadsScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/unreads',
  func: () => ({
    '~zod/testHeap': {
      last: unixTime,
      count: 1,
      'unread-id': null,
    },
  }),
};

export const heapPermsScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/heap/~zod/testHeap/perm',
  func: () => ({
    perms: {
      writers: ['~zod', '~finned-palmer'],
    },
  }),
};

export const heapCuriosScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/heap/~zod/testHeap/curios/newest/100',
  func: () => mockCurios,
};

export const heapCuriosSubscribe: SubscriptionHandler = {
  action: 'subscribe',
  app: 'heap',
  path: '/heap/~zod/testHeap/ui/curios',
};

const heapHandlers: Handler[] = [
  heapUnreadsSub,
  heapStashScry,
  heapUnreadsScry,
  heapPermsScry,
  heapCuriosScry,
  heapCuriosSubscribe,
];

export default heapHandlers;
