import { expect, test } from 'vitest';

import type * as ub from '../urbit';
import {
  toChannelUnread,
  toClientUnreads,
  toGroupUnread,
  toThreadUnread,
} from './activityApi';

const channelUnread: Record<string, ub.ActivitySummary> = {
  'channel/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870':
    {
      unread: {
        count: 4,
        id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.155.647.879.036.981.225.717.760',
        time: '170141184506853155647879036981225717760',
        notify: true,
      },
      count: 5,
      recency: 1718513986192,
      'notify-count': 0,
      reads: {
        floor: 0,
        items: {},
      },
      children: {
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.591.089.314.701.116.289.581.056':
          {
            unread: null,
            count: 1,
            recency: 1718483402625,
            children: null,
            notify: true,
            'notify-count': 0,
            reads: {
              floor: 0,
              items: {},
            },
          },
        'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.590.556.405.446.059.399.053.312':
          {
            unread: null,
            count: 0,
            recency: 1718483869007,
            children: null,
            notify: false,
            'notify-count': 0,
            reads: {
              floor: 0,
              items: {},
            },
          },
      },
      notify: true,
    },
};

const expectedChannelUnread = {
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  type: 'channel',
  updatedAt: 1718513986192,
  count: 5,
  countWithoutThreads: 4,
  notify: true,
  firstUnreadPostId: '170.141.184.506.853.155.647.879.036.981.225.717.760',
  firstUnreadPostReceivedAt: 1718513986192,
};

test('converts a channel unread from server to client format', () => {
  const [sourceId, summary] = Object.entries(channelUnread)[0];
  const [_prefix, ...rest] = sourceId.split('/');
  const channelId = rest.join('/');
  expect(toChannelUnread(channelId, summary, 'channel')).toStrictEqual(
    expectedChannelUnread
  );
});

const threadUnread: Record<string, ub.ActivitySummary> = {
  'thread/chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870/170.141.184.506.852.613.519.639.575.172.887.871.488':
    {
      unread: {
        count: 1,
        id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.162.261.354.291.179.829.592.064',
        time: '170141184506853162261354291179829592064',
        notify: false,
      },
      count: 1,
      recency: 1718514344709,
      children: {},
      notify: false,
      'notify-count': 0,
      reads: {
        floor: 0,
        items: {},
      },
    },
};

const expectedThreadUnread = {
  channelId:
    'chat/~lishul-marbyl-nisdeb-nalhec--motfed-lodmyn-tinfed-binzod/welcome-5870',
  threadId: '170.141.184.506.852.613.519.639.575.172.887.871.488',
  updatedAt: 1718514344709,
  count: 1,
  notify: false,
  firstUnreadPostId: '170.141.184.506.853.162.261.354.291.179.829.592.064',
  firstUnreadPostReceivedAt: 1718514344709,
};

test('converts a thread unread from server to client format', () => {
  const [sourceId, summary] = Object.entries(threadUnread)[0];
  const [_prefix, ...rest] = sourceId.split('/');
  const channelId = rest.slice(0, 3).join('/');
  const threadId = rest[rest.length - 1];
  expect(toThreadUnread(channelId, threadId, summary, 'channel')).toStrictEqual(
    expectedThreadUnread
  );
});

const dmUnread: Record<string, ub.ActivitySummary> = {
  'ship/~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod': {
    unread: {
      count: 4,
      id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.323.576.871.214.428.711.452.409',
      time: '170141184506853323579606989072752443392',
      notify: true,
    },
    count: 6,
    recency: 1718523089789,
    children: {},
    notify: true,
    'notify-count': 0,
    reads: {
      floor: 0,
      items: {},
    },
  },
};

const expectedDMUnread = {
  channelId: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod',
  type: 'dm',
  updatedAt: 1718523089789,
  count: 6,
  countWithoutThreads: 4,
  notify: true,
  firstUnreadPostId: '170.141.184.506.853.323.576.871.214.428.711.452.409',
  firstUnreadPostReceivedAt: 1718523089641,
};

test('converts a dm unread from server to client format', () => {
  const [sourceId, summary] = Object.entries(dmUnread)[0];
  const [_prefix, ...rest] = sourceId.split('/');
  const channelId = rest[0];
  expect(toChannelUnread(channelId, summary, 'dm')).toStrictEqual(
    expectedDMUnread
  );
});

const dmThreadUnread: Record<string, ub.ActivitySummary> = {
  'dm-thread/~latter-bolden/~pondus-watbel/170.141.184.506.850.891.890.487.524.537.451.390.435':
    {
      unread: {
        count: 1,
        id: '~latter-bolden/170.141.184.506.853.331.045.293.807.087.055.357.870',
        time: '170141184506853331047376811986706759680',
        notify: true,
      },
      count: 1,
      recency: 1718523494618,
      children: {},
      notify: true,
      'notify-count': 0,
      reads: {
        floor: 0,
        items: {},
      },
    },
};

const expectedDmThreadUnread = {
  channelId: '~latter-bolden',
  threadId: '170.141.184.506.850.891.890.487.524.537.451.390.435',
  updatedAt: 1718523494618,
  count: 1,
  notify: true,
  firstUnreadPostId: '170.141.184.506.853.331.045.293.807.087.055.357.870',
  firstUnreadPostReceivedAt: 1718523494505,
};

test('converts a dm thread unread from server to client format', () => {
  const [sourceId, summary] = Object.entries(dmThreadUnread)[0];
  const [_prefix, ...rest] = sourceId.split('/');
  const channelId = rest[0];
  const threadId = rest[rest.length - 1];
  expect(toThreadUnread(channelId, threadId, summary, 'dm')).toStrictEqual(
    expectedDmThreadUnread
  );
});

const groupUnread: Record<string, ub.ActivitySummary> = {
  'group/~latter-bolden/woodshop': {
    unread: null,
    count: 6,
    recency: 946684800000,
    children: {
      'channel/chat/~latter-bolden/welcome-8186': {
        unread: {
          count: 5,
          notify: true,
          id: '~lisfed-hobtex-tinres-walmyr--donsut-toprep-fanfep-samzod/170.141.184.506.853.155.647.879.036.981.225.717.760',
          time: '170141184506853155647879036981225717760',
        },
        count: 5,
        recency: 946684800000,
        children: null,
        notify: false,
        'notify-count': 0,
        reads: {
          floor: 0,
          items: {},
        },
      },
    },
    notify: true,
    'notify-count': 0,
    reads: {
      floor: 0,
      items: {},
    },
  },
};

const expectedGroupUnread = {
  groupId: '~latter-bolden/woodshop',
  updatedAt: 946684800000,
  count: 6,
  notify: true,
};

test('converts a group unread from server to client format', () => {
  const [sourceId, summary] = Object.entries(groupUnread)[0];
  const [_prefix, ...rest] = sourceId.split('/');
  const groupId = rest.join('/');
  expect(toGroupUnread(groupId, summary)).toStrictEqual(expectedGroupUnread);
});

test('converts a set of unreads from server to client format', () => {
  const unreads: ub.Activity = {
    ...channelUnread,
    ...threadUnread,
    ...dmUnread,
    ...dmThreadUnread,
    ...groupUnread,
  };
  const clientUnreads = toClientUnreads(unreads);

  expect(clientUnreads.channelUnreads.length).toBe(2);
  expect(clientUnreads.threadActivity.length).toBe(2);
  expect(clientUnreads.groupUnreads.length).toBe(1);

  expect(clientUnreads.channelUnreads[0]).toStrictEqual(expectedChannelUnread);
  expect(clientUnreads.channelUnreads[1]).toStrictEqual(expectedDMUnread);
  expect(clientUnreads.threadActivity[0]).toStrictEqual(expectedThreadUnread);
  expect(clientUnreads.threadActivity[1]).toStrictEqual(expectedDmThreadUnread);
  expect(clientUnreads.groupUnreads[0]).toStrictEqual(expectedGroupUnread);
});
