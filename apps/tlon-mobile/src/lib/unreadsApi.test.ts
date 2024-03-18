import type { ClientTypes as Client } from '@tloncorp/shared';
import type * as ubChan from '@tloncorp/shared/dist/urbit/channel';
import type * as ubDM from '@tloncorp/shared/dist/urbit/dms';
import { expect, test } from 'vitest';

import { toClientUnread, toClientUnreads } from './unreadsApi';

const inputUnread: [string, ubChan.Unread, Client.UnreadType] = [
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
  totalCount: 0,
};

test('converts a channel unread from server to client format', () => {
  expect(toClientUnread(...inputUnread)).toStrictEqual(expectedChannelUnread);
});

test('converts an array of contacts from server to client format', () => {
  expect(
    toClientUnreads({ [inputUnread[0]]: inputUnread[1] }, inputUnread[2])
  ).toStrictEqual([expectedChannelUnread]);
});

const inputDMUnread: [string, ubDM.DMUnread, Client.UnreadType] = [
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
  totalCount: 0,
};

test('converts a channel unread from server to client format', () => {
  expect(toClientUnread(...inputDMUnread)).toStrictEqual(expectedDMUnread);
});

test('converts an array of channels from server to client format', () => {
  expect(
    toClientUnreads({ [inputDMUnread[0]]: inputDMUnread[1] }, inputDMUnread[2])
  ).toStrictEqual([expectedDMUnread]);
});
