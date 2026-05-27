import { poke } from '@tloncorp/api';
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

test('markChannelRead preserves notification-only group unread when another group notification is present', async () => {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await insertGroupAndChannel();
  await client.insert(schema.groupJoinRequests).values({
    groupId,
    contactId: '~nec',
    requestedAt: 100,
  });
  await db.insertGroupUnreads([makeGroupUnread()]);
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

test('markChannelRead preserves notification-only group unread when another channel still notifies', async () => {
  const otherChannelId = 'chat/~zod/stale-notify/random';

  await insertGroupAndChannel();
  await insertGroupAndChannel({ id: otherChannelId });
  await db.insertGroupUnreads([makeGroupUnread({ notifyCount: 2 })]);
  await db.insertChannelUnreads([
    makeChannelUnread(),
    makeChannelUnread({ channelId: otherChannelId }),
  ]);

  await markChannelRead({ id: channelId, groupId });

  expect(await db.getChannelUnread({ channelId })).toMatchObject({
    count: 0,
    notify: false,
  });
  expect(await db.getGroupUnread({ groupId })).toMatchObject({
    count: 0,
    notify: true,
    notifyCount: 2,
  });
});
