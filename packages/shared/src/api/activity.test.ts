import { expect, test } from 'vitest';

import * as db from '../db';
import type * as ub from '../urbit';
import {
  fromFeedToActivityEvents,
  fromInitFeedToBucketedActivityEvents,
} from './activityApi';

const dmFeed: ub.ActivityFeed = [
  {
    source: {
      dm: {
        ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
      },
    },
    events: [
      {
        event: {
          notified: true,
          'dm-post': {
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.323.576.871.214.428.711.452.409',
              time: '170.141.184.506.853.323.579.606.989.072.752.443.392',
            },
            whom: {
              ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
            },
            content: [
              {
                inline: [
                  'how are you?',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
        },
        time: '170.141.184.506.853.323.579.606.989.072.752.443.392',
      },
    ],
    'source-key':
      'ship/~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
    latest: '170.141.184.506.853.323.579.606.989.072.752.443.392',
  },
];

const expectedDmEvent: db.ActivityEvent = {
  id: '170.141.184.506.853.323.579.606.989.072.752.443.392',
  sourceId: 'ship/~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  channelId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.853.323.576.871.214.428.711.452.409',
  shouldNotify: true,
  type: 'post',
  bucketId: 'all',
  timestamp: 1718523089789,
  content: [
    {
      inline: [
        'how are you?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a DM activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(dmFeed, 'all');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedDmEvent);
});

const channelPostFeed: ub.ActivityFeed = [
  {
    source: {
      channel: {
        nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
        group:
          '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
      },
    },
    events: [
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.155.647.879.036.981.225.717.760',
              time: '170.141.184.506.853.155.647.879.036.981.225.717.760',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  'sorry, i was trying it out',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.853.155.647.879.036.981.225.717.760',
      },
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.945.128.471.446.410.112.270.336',
              time: '170.141.184.506.852.945.128.471.446.410.112.270.336',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  {
                    code: '|= a=@ud\n/= var (mul a .8)\nvar',
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.945.128.471.446.410.112.270.336',
      },
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.941.140.267.419.570.593.071.104',
              time: '170.141.184.506.852.941.140.267.419.570.593.071.104',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  'but i do like these ones',
                  {
                    break: null,
                  },
                ],
              },
              {
                block: {
                  cite: {
                    chan: {
                      nest: 'heap/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/new-books',
                      where: '/curio/170141184506852940559878402492195667968',
                    },
                  },
                },
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.941.140.267.419.570.593.071.104',
      },
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.613.519.639.575.172.887.871.488',
              time: '170.141.184.506.852.613.519.639.575.172.887.871.488',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                block: {
                  cite: {
                    chan: {
                      nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
                      where: '/msg/170141184506852608649148293184143491072',
                    },
                  },
                },
              },
              {
                inline: [
                  {
                    ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
                  },
                  ': wait these are actually sold out',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.613.519.639.575.172.887.871.488',
      },
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.612.609.375.677.663.460.458.496',
              time: '170.141.184.506.852.612.609.375.677.663.460.458.496',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  'For sure. The current ones are looking pretty beat up. Maybe something more modern?',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.612.609.375.677.663.460.458.496',
      },
      {
        event: {
          post: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.608.649.148.293.184.143.491.072',
              time: '170.141.184.506.852.608.649.148.293.184.143.491.072',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  'Yeah, let’s shift them closer to the walls to free up some space in the middle',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.608.649.148.293.184.143.491.072',
      },
    ],
    'source-key':
      'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
    latest: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  },
];

const expectedPostEvent: db.ActivityEvent = {
  id: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  sourceId:
    'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  groupId:
    '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  shouldNotify: true,
  type: 'post',
  bucketId: 'all',
  timestamp: 1718513986192,
  content: [
    {
      inline: [
        'sorry, i was trying it out',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a post activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(channelPostFeed, 'all');
  expect(events.length).toBe(6);
  expect(events[0]).toStrictEqual(expectedPostEvent);
});

const replyPostFeed: ub.ActivityFeed = [
  {
    source: {
      thread: {
        channel:
          'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
        key: {
          id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
          time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
        },
        group:
          '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
      },
    },
    events: [
      {
        event: {
          reply: {
            channel:
              'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
            key: {
              id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.591.480.642.042.887.720.140.800',
              time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
            },
            parent: {
              id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
              time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
            },
            group:
              '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
            content: [
              {
                inline: [
                  'definitely needs an upgrade. Maybe some floor lamps with warmer light?',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
      },
    ],
    'source-key':
      'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056',
    latest: '170.141.184.506.852.591.480.642.042.887.720.140.800',
  },
];

const expectedReplyEvent: db.ActivityEvent = {
  id: '170.141.184.506.852.591.480.642.042.887.720.140.800',
  sourceId:
    'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056',
  groupId:
    '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  authorId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  isMention: false,
  postId: '170.141.184.506.852.591.480.642.042.887.720.140.800',
  parentId: '170.141.184.506.852.591.089.314.701.116.289.581.056',
  parentAuthorId: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
  shouldNotify: true,
  type: 'reply',
  bucketId: 'replies',
  timestamp: 1718483402625,
  content: [
    {
      inline: [
        'definitely needs an upgrade. Maybe some floor lamps with warmer light?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a reply activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(replyPostFeed, 'replies');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedReplyEvent);
});

const dmReplyFeed: ub.ActivityFeed = [
  {
    source: {
      'dm-thread': {
        key: {
          id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
          time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
        },
        whom: {
          ship: '~pondus-watbel',
        },
      },
    },
    events: [
      {
        event: {
          'dm-reply': {
            key: {
              id: '~pondus-watbel/170.141.184.506.854.078.980.633.339.753.179.094.450',
              time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
            },
            parent: {
              id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
              time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
            },
            whom: {
              ship: '~pondus-watbel',
            },
            content: [
              {
                inline: [
                  'how are you today?',
                  {
                    break: null,
                  },
                ],
              },
            ],
            mention: false,
          },
          notified: true,
        },
        time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
      },
    ],
    'source-key':
      'dm-thread/~pondus-watbel/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
    latest: '170.141.184.506.854.078.982.999.616.565.792.473.088',
  },
];

const expectedDmReplyEvent: db.ActivityEvent = {
  id: '170.141.184.506.854.078.982.999.616.565.792.473.088',
  sourceId:
    'dm-thread/~pondus-watbel/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
  channelId: '~pondus-watbel',
  authorId: '~pondus-watbel',
  isMention: false,
  postId: '170.141.184.506.854.078.980.633.339.753.179.094.450',
  parentId: '170.141.184.506.854.078.840.401.191.304.839.083.065',
  parentAuthorId: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
  shouldNotify: true,
  type: 'reply',
  bucketId: 'replies',
  timestamp: 1718564040289,
  content: [
    {
      inline: [
        'how are you today?',
        {
          break: null,
        },
      ],
    },
  ],
};

test('converts a dm reply activity event feed from server to client format', () => {
  const events = fromFeedToActivityEvents(dmReplyFeed, 'replies');
  expect(events.length).toBe(1);
  expect(events[0]).toStrictEqual(expectedDmReplyEvent);
});

const initActivityFeeds: ub.InitActivityFeeds = {
  all: [
    {
      source: {
        'dm-thread': {
          key: {
            id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
            time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
          },
          whom: {
            ship: '~pondus-watbel',
          },
        },
      },
      events: [
        {
          event: {
            'dm-reply': {
              key: {
                id: '~pondus-watbel/170.141.184.506.854.078.980.633.339.753.179.094.450',
                time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
              },
              parent: {
                id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
                time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
              },
              whom: {
                ship: '~pondus-watbel',
              },
              content: [
                {
                  inline: [
                    'how are you today?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
        },
      ],
      'source-key':
        'dm-thread/~pondus-watbel/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
      latest: '170.141.184.506.854.078.982.999.616.565.792.473.088',
    },
    {
      source: {
        dm: {
          ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
        },
      },
      events: [
        {
          event: {
            notified: true,
            'dm-post': {
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.323.576.871.214.428.711.452.409',
                time: '170.141.184.506.853.323.579.606.989.072.752.443.392',
              },
              whom: {
                ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
              },
              content: [
                {
                  inline: [
                    'how are you?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
          },
          time: '170.141.184.506.853.323.579.606.989.072.752.443.392',
        },
      ],
      'source-key':
        'ship/~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
      latest: '170.141.184.506.853.323.579.606.989.072.752.443.392',
    },
    {
      source: {
        channel: {
          nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.155.647.879.036.981.225.717.760',
                time: '170.141.184.506.853.155.647.879.036.981.225.717.760',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'sorry, i was trying it out',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.853.155.647.879.036.981.225.717.760',
        },
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.945.128.471.446.410.112.270.336',
                time: '170.141.184.506.852.945.128.471.446.410.112.270.336',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    {
                      code: '|= a=@ud\n/= var (mul a .8)\nvar',
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.945.128.471.446.410.112.270.336',
        },
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.941.140.267.419.570.593.071.104',
                time: '170.141.184.506.852.941.140.267.419.570.593.071.104',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'but i do like these ones',
                    {
                      break: null,
                    },
                  ],
                },
                {
                  block: {
                    cite: {
                      chan: {
                        nest: 'heap/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/new-books',
                        where: '/curio/170141184506852940559878402492195667968',
                      },
                    },
                  },
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.941.140.267.419.570.593.071.104',
        },
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.613.519.639.575.172.887.871.488',
                time: '170.141.184.506.852.613.519.639.575.172.887.871.488',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  block: {
                    cite: {
                      chan: {
                        nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
                        where: '/msg/170141184506852608649148293184143491072',
                      },
                    },
                  },
                },
                {
                  inline: [
                    {
                      ship: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
                    },
                    ': wait these are actually sold out',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.613.519.639.575.172.887.871.488',
        },
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.612.609.375.677.663.460.458.496',
                time: '170.141.184.506.852.612.609.375.677.663.460.458.496',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'For sure. The current ones are looking pretty beat up. Maybe something more modern?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.612.609.375.677.663.460.458.496',
        },
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.608.649.148.293.184.143.491.072',
                time: '170.141.184.506.852.608.649.148.293.184.143.491.072',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'Yeah, let’s shift them closer to the walls to free up some space in the middle',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.608.649.148.293.184.143.491.072',
        },
      ],
      'source-key':
        'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
      latest: '170.141.184.506.853.155.647.879.036.981.225.717.760',
    },
    {
      source: {
        channel: {
          nest: 'heap/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/new-books',
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            post: {
              channel:
                'heap/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/new-books',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.940.559.878.402.492.195.667.968',
                time: '170.141.184.506.852.940.559.878.402.492.195.667.968',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [],
                },
                {
                  block: {
                    image: {
                      width: 1920,
                      alt: 'heap image',
                      src: 'https://d2w9rnfcy7mm78.cloudfront.net/20267744/original_ecfe2ab996d1bdd627a0b42775abf5f6.png?1675794935?bc=0',
                      height: 915,
                    },
                  },
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.940.559.878.402.492.195.667.968',
        },
      ],
      'source-key':
        'channel/heap/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/new-books',
      latest: '170.141.184.506.852.940.559.878.402.492.195.667.968',
    },
    {
      source: {
        channel: {
          nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.609.708.106.976.640.509.149.184',
                time: '170.141.184.506.852.609.708.106.976.640.509.149.184',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    {
                      ship: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
                    },
                    "  i'm thinking of adding some colorful rugs and a little reading corner with cushions.",
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: true,
            },
            notified: true,
          },
          time: '170.141.184.506.852.609.708.106.976.640.509.149.184',
        },
      ],
      'source-key':
        'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
      latest: '170.141.184.506.852.609.708.106.976.640.509.149.184',
    },
    {
      source: {
        thread: {
          channel:
            'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          key: {
            id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.590.556.405.446.059.399.053.312',
            time: '170.141.184.506.852.590.556.405.446.059.399.053.312',
          },
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            reply: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.600.083.881.921.852.460.761.088',
                time: '170.141.184.506.852.600.083.881.921.852.460.761.088',
              },
              parent: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.590.556.405.446.059.399.053.312',
                time: '170.141.184.506.852.590.556.405.446.059.399.053.312',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'nice',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.600.083.881.921.852.460.761.088',
        },
      ],
      'source-key':
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.590.556.405.446.059.399.053.312',
      latest: '170.141.184.506.852.600.083.881.921.852.460.761.088',
    },
    {
      source: {
        thread: {
          channel:
            'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          key: {
            id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
            time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
          },
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            reply: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.591.480.642.042.887.720.140.800',
                time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
              },
              parent: {
                id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
                time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'definitely needs an upgrade. Maybe some floor lamps with warmer light?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
        },
      ],
      'source-key':
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056',
      latest: '170.141.184.506.852.591.480.642.042.887.720.140.800',
    },
  ],
  mentions: [
    {
      source: {
        channel: {
          nest: 'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            post: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.609.708.106.976.640.509.149.184',
                time: '170.141.184.506.852.609.708.106.976.640.509.149.184',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    {
                      ship: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod',
                    },
                    "  i'm thinking of adding some colorful rugs and a little reading corner with cushions.",
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: true,
            },
            notified: true,
          },
          time: '170.141.184.506.852.609.708.106.976.640.509.149.184',
        },
      ],
      'source-key':
        'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
      latest: '170.141.184.506.852.609.708.106.976.640.509.149.184',
    },
  ],
  replies: [
    {
      source: {
        'dm-thread': {
          key: {
            id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
            time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
          },
          whom: {
            ship: '~pondus-watbel',
          },
        },
      },
      events: [
        {
          event: {
            'dm-reply': {
              key: {
                id: '~pondus-watbel/170.141.184.506.854.078.980.633.339.753.179.094.450',
                time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
              },
              parent: {
                id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
                time: '170.141.184.506.854.078.840.636.891.694.937.145.344',
              },
              whom: {
                ship: '~pondus-watbel',
              },
              content: [
                {
                  inline: [
                    'how are you today?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.854.078.982.999.616.565.792.473.088',
        },
      ],
      'source-key':
        'dm-thread/~pondus-watbel/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.854.078.840.401.191.304.839.083.065',
      latest: '170.141.184.506.854.078.982.999.616.565.792.473.088',
    },
    {
      source: {
        thread: {
          channel:
            'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          key: {
            id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.590.556.405.446.059.399.053.312',
            time: '170.141.184.506.852.590.556.405.446.059.399.053.312',
          },
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            reply: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.600.083.881.921.852.460.761.088',
                time: '170.141.184.506.852.600.083.881.921.852.460.761.088',
              },
              parent: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.590.556.405.446.059.399.053.312',
                time: '170.141.184.506.852.590.556.405.446.059.399.053.312',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'nice',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.600.083.881.921.852.460.761.088',
        },
      ],
      'source-key':
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.590.556.405.446.059.399.053.312',
      latest: '170.141.184.506.852.600.083.881.921.852.460.761.088',
    },
    {
      source: {
        thread: {
          channel:
            'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
          key: {
            id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
            time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
          },
          group:
            '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
        },
      },
      events: [
        {
          event: {
            reply: {
              channel:
                'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
              key: {
                id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.852.591.480.642.042.887.720.140.800',
                time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
              },
              parent: {
                id: '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/170.141.184.506.852.591.089.314.701.116.289.581.056',
                time: '170.141.184.506.852.591.089.314.701.116.289.581.056',
              },
              group:
                '~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/little-library',
              content: [
                {
                  inline: [
                    'definitely needs an upgrade. Maybe some floor lamps with warmer light?',
                    {
                      break: null,
                    },
                  ],
                },
              ],
              mention: false,
            },
            notified: true,
          },
          time: '170.141.184.506.852.591.480.642.042.887.720.140.800',
        },
      ],
      'source-key':
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056',
      latest: '170.141.184.506.852.591.480.642.042.887.720.140.800',
    },
  ],
};

test('converts activity init feeds from server to client format', () => {
  const events = fromInitFeedToBucketedActivityEvents(initActivityFeeds);
  const numAllEvents = 12;
  const numMentionEvents = 1;
  const numReplyEvents = 3;
  const numAllSources = 6;

  expect(events.filter((event) => event.bucketId === 'all').length).toBe(
    numAllEvents
  );
  expect(events.filter((event) => event.bucketId === 'mentions').length).toBe(
    numMentionEvents
  );
  expect(events.filter((event) => event.bucketId === 'replies').length).toBe(
    numReplyEvents
  );

  const sourceSet = new Set<string>();
  events
    .filter((event) => event.bucketId === 'all')
    .forEach((event) => sourceSet.add(event.sourceId));
  expect(sourceSet.size).toBe(numAllSources);
});
