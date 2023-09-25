import {
  Handler,
  ScryHandler,
  SubscriptionHandler,
} from '@tloncorp/mock-http-api';
import { BigIntOrderedMap } from '@urbit/api';
import { subMinutes } from 'date-fns';
import { newQuipMap, Notes, Perm, Shelf } from '@/types/channel';

const unixTime = subMinutes(new Date(), 1).getTime();

const mockPerms: Perm = {
  writers: ['~zod', '~finned-palmer'],
  group: '~zod/test',
};

const mockStash: Shelf = {
  'heap/~zod/testHeap': {
    perms: mockPerms,
    view: 'grid',
    order: [],
    sort: 'time',
    saga: null,
  },
};

const mockCurios: Notes = {
  '170141184505776467152677676749638598656': {
    seal: {
      id: '170141184505776467152677676749638598656',
      quips: newQuipMap(),
      meta: {
        lastQuip: null,
        quipCount: 0,
        lastQuippers: [],
      },
      feels: {},
    },
    essay: {
      'han-data': {
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
      quips: newQuipMap(),
      meta: {
        lastQuip: null,
        quipCount: 0,
        lastQuippers: [],
      },
      feels: {},
    },
    essay: {
      'han-data': {
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
      quips: newQuipMap(),
      meta: {
        lastQuip: null,
        quipCount: 0,
        lastQuippers: [],
      },
      feels: {},
    },
    essay: {
      'han-data': {
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
      quips: newQuipMap(),
      meta: {
        lastQuip: null,
        quipCount: 0,
        lastQuippers: [],
      },
      feels: {},
    },
    essay: {
      'han-data': {
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
      quips: newQuipMap(),
      meta: {
        lastQuip: null,
        quipCount: 0,
        lastQuippers: [],
      },
      feels: {},
    },
    essay: {
      'han-data': {
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

export const heapBriefsSub: SubscriptionHandler = {
  action: 'subscribe',
  app: 'heap',
  path: '/briefs',
};

export const heapStashScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/stash',
  func: () => mockStash,
};

export const heapBriefsScry: ScryHandler = {
  action: 'scry',
  app: 'heap',
  path: '/briefs',
  func: () => ({
    '~zod/testHeap': {
      last: unixTime,
      count: 1,
      'read-id': null,
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
  heapBriefsSub,
  heapStashScry,
  heapBriefsScry,
  heapPermsScry,
  heapCuriosScry,
  heapCuriosSubscribe,
];

export default heapHandlers;
