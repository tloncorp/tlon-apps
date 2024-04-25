import { expect, test } from 'vitest';

import type * as client from '../client';
import type * as ub from '../urbit';
import { toClientUnread, toClientUnreads } from './unreadsApi';

const inputUnread: [string, ub.Unread, client.UnreadType] = [
  'chat/~nibset-napwyn/commons',
  {
    unread: null,
    count: 0,
    recency: 1684342021902,
    threads: {},
  },
  'channel',
];

const expectedChannelUnread = {
  channelId: 'chat/~nibset-napwyn/commons',
  type: 'channel',
  count: 0,
  updatedAt: 1684342021902,
  countWithoutThreads: 0,
  firstUnreadPostId: null,
  firstUnreadPostReceivedAt: null,
  threadUnreads: [],
};

test('converts a channel unread from server to client format', () => {
  expect(toClientUnread(...inputUnread)).toStrictEqual(expectedChannelUnread);
});

test('converts an array of contacts from server to client format', () => {
  expect(
    toClientUnreads({ [inputUnread[0]]: inputUnread[1] }, inputUnread[2])
  ).toStrictEqual([expectedChannelUnread]);
});

const inputDMUnread: [string, ub.DMUnread, client.UnreadType] = [
  'dm/~pondus-latter',
  {
    unread: null,
    count: 0,
    recency: 1684342021902,
    threads: {},
  },
  'dm',
];

const expectedDMUnread = {
  channelId: 'dm/~pondus-latter',
  type: 'dm',
  count: 0,
  updatedAt: 1684342021902,
  countWithoutThreads: 0,
  firstUnreadPostId: null,
  firstUnreadPostReceivedAt: null,
  threadUnreads: [],
};

test('converts a channel unread from server to client format', () => {
  expect(toClientUnread(...inputDMUnread)).toStrictEqual(expectedDMUnread);
});

test('converts an array of channels from server to client format', () => {
  expect(
    toClientUnreads({ [inputDMUnread[0]]: inputDMUnread[1] }, inputDMUnread[2])
  ).toStrictEqual([expectedDMUnread]);
});
