import { poke } from '@tloncorp/api';
import * as $ from 'drizzle-orm';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import * as schema from '../db/schema';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import { markChannelRead } from './channelActions';

setupDatabaseTestSuite();

const groupId = '~zod/stale-notify';
const channelId = 'chat/~zod/stale-notify/general';

async function insertGroupAndChannel({
  id = channelId,
  group = groupId,
}: {
  id?: string;
  group?: string;
} = {}) {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await client
    .insert(schema.groups)
    .values({
      id: group,
      currentUserIsMember: true,
      currentUserIsHost: false,
      hostUserId: '~zod',
    })
    .onConflictDoNothing();
  await client.insert(schema.channels).values({
    id,
    type: 'chat',
    groupId: group,
  });
}

function makeChannelUnread(
  overrides: Partial<db.ChannelUnread> = {}
): db.ChannelUnread {
  return {
    channelId,
    type: 'channel',
    count: 0,
    countWithoutThreads: 0,
    notify: true,
    updatedAt: 100,
    firstUnreadPostId: null,
    firstUnreadPostReceivedAt: null,
    ...overrides,
  };
}

function makeGroupUnread(
  overrides: Partial<db.GroupUnread> = {}
): db.GroupUnread {
  return {
    groupId,
    count: 0,
    notify: true,
    notifyCount: 1,
    updatedAt: 100,
    ...overrides,
  };
}

function makeThreadUnread(
  overrides: Partial<db.ThreadUnreadState> = {}
): db.ThreadUnreadState {
  return {
    channelId,
    threadId: 'thread-notify',
    count: 0,
    notify: true,
    updatedAt: 100,
    firstUnreadPostId: null,
    firstUnreadPostReceivedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(poke).mockClear();
});

test('markChannelRead clears stale notification-only group unread after channel notification is read', async () => {
  await insertGroupAndChannel();
  await db.insertGroupUnreads([makeGroupUnread()]);
  await db.insertChannelUnreads([makeChannelUnread()]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getChannelUnread({ channelId })).toMatchObject({
    count: 0,
    notify: false,
  });
  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: false,
    notifyCount: 0,
  });
});

test('markChannelRead preserves notification-only group unread when it does not match the channel notification', async () => {
  await insertGroupAndChannel();
  await db.insertGroupUnreads([makeGroupUnread({ updatedAt: 200 })]);
  await db.insertChannelUnreads([makeChannelUnread()]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getChannelUnread({ channelId })).toMatchObject({
    count: 0,
    notify: false,
  });
  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: true,
    notifyCount: 1,
  });
});

test('markChannelRead clears final notifying message group unread', async () => {
  await insertGroupAndChannel();
  await db.insertGroupUnreads([makeGroupUnread({ count: 1, notifyCount: 1 })]);
  await db.insertChannelUnreads([
    makeChannelUnread({ count: 1, countWithoutThreads: 1 }),
  ]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: false,
    notifyCount: 0,
  });
});

test('markChannelRead decrements notification-only group unread when it has multiple notifying channels', async () => {
  const otherChannelId = 'chat/~zod/stale-notify/random';

  await insertGroupAndChannel();
  await insertGroupAndChannel({ id: otherChannelId });
  await db.insertGroupUnreads([
    makeGroupUnread({ notifyCount: 2, updatedAt: 200 }),
  ]);
  await db.insertChannelUnreads([
    makeChannelUnread({ updatedAt: 200 }),
    makeChannelUnread({ channelId: otherChannelId, updatedAt: 100 }),
  ]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getChannelUnread({ channelId })).toMatchObject({
    count: 0,
    notify: false,
  });
  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: true,
    notifyCount: 1,
    updatedAt: 100,
  });

  await markChannelRead({ id: otherChannelId, groupId });

  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: false,
    notifyCount: 0,
  });
});

test('markChannelRead includes threads when clearing channel notify', async () => {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await insertGroupAndChannel();
  await db.insertChannelUnreads([
    makeChannelUnread({
      count: 1,
      countWithoutThreads: 0,
      threadUnreads: [makeThreadUnread({ count: 1 })],
    }),
  ]);

  await markChannelRead({ id: channelId, includeThreads: true });

  expect(await db.getChannelUnread({ channelId })).toMatchObject({
    count: 0,
    notify: false,
  });
  const threadUnread = await client.query.threadUnreads.findFirst({
    where: $.eq(schema.threadUnreads.channelId, channelId),
  });
  expect(threadUnread).toMatchObject({
    count: 0,
    notify: false,
  });
});

test('markChannelRead decrements group count and notify count for notifying message unreads', async () => {
  const otherChannelId = 'chat/~zod/stale-notify/random';

  await insertGroupAndChannel();
  await insertGroupAndChannel({ id: otherChannelId });
  await db.insertGroupUnreads([
    makeGroupUnread({ count: 2, notifyCount: 2, updatedAt: 200 }),
  ]);
  await db.insertChannelUnreads([
    makeChannelUnread({
      count: 1,
      countWithoutThreads: 1,
      updatedAt: 200,
    }),
    makeChannelUnread({
      channelId: otherChannelId,
      count: 1,
      countWithoutThreads: 1,
      updatedAt: 100,
    }),
  ]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 1,
    notify: true,
    notifyCount: 1,
    updatedAt: 100,
  });
});
