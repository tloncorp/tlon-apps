import * as api from '@tloncorp/api';
import { poke } from '@tloncorp/api';
import * as $ from 'drizzle-orm';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import * as schema from '../db/schema';
import { getClient, setupDatabaseTestSuite } from '../test/helpers';
import {
  createChannel,
  joinGroupChannel,
  leaveGroupChannel,
  markChannelRead,
} from './channelActions';

setupDatabaseTestSuite();

const groupId = '~zod/stale-notify';
const channelId = 'chat/~zod/stale-notify/general';

async function insertGroupAndChannel({
  id = channelId,
  group = groupId,
  type = 'chat',
}: {
  id?: string;
  group?: string;
  type?: db.ChannelType;
} = {}) {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await insertGroup(group);
  await client.insert(schema.channels).values({
    id,
    type,
    groupId: group,
  });
}

async function insertGroup(id = groupId) {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await client
    .insert(schema.groups)
    .values({
      id,
      currentUserIsMember: true,
      currentUserIsHost: false,
      hostUserId: '~zod',
    })
    .onConflictDoNothing();
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

function mockCreateNotesNotebook() {
  return vi.spyOn(api.notesV1, 'createGroupNotebook').mockResolvedValue({
    host: '~solfer-magfed',
    flagName: 'native-notes',
    notebook: { id: 1, title: 'Native notes' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(poke).mockClear();
});

test('createChannel creates a notes channel via the %notes HTTP API, forwarding readers', async () => {
  await insertGroup();

  const createGroupNotebook = mockCreateNotesNotebook();
  const addChannelListingToGroup = vi
    .spyOn(api, 'addChannelListingToGroup')
    .mockResolvedValue(1);

  const channel = await createChannel({
    groupId,
    title: 'Native notes',
    channelType: 'notes',
    readers: ['admin'],
  });

  expect(createGroupNotebook).toHaveBeenCalledWith({
    title: 'Native notes',
    group: { host: '~zod', flagName: 'stale-notify' },
    readers: ['admin'],
  });
  expect(addChannelListingToGroup).toHaveBeenCalledWith({
    channelId: 'notes/~solfer-magfed/native-notes',
    groupId,
    sectionId: 'default',
    meta: {
      title: 'Native notes',
      description: '',
      image: '',
      cover: '',
    },
    readers: ['admin'],
    join: true,
  });
  expect(channel.id).toBe('notes/~solfer-magfed/native-notes');
  await expect(db.getChannel({ id: channel.id })).resolves.toMatchObject({
    type: 'notes',
    groupId,
  });
});

test('createChannel does not insert a notes channel when the HTTP create fails', async () => {
  await insertGroup();

  vi.spyOn(api.notesV1, 'createGroupNotebook').mockRejectedValue(
    new Error('create failed')
  );

  await expect(
    createChannel({
      groupId,
      title: 'Native notes',
      channelType: 'notes',
    })
  ).rejects.toThrow('Failed to add notes channel to group');

  await expect(
    db.getChannel({ id: 'notes/~solfer-magfed/native-notes' })
  ).resolves.toBeNull();
});

test('createChannel rolls back a notes notebook when local channel insert fails', async () => {
  await insertGroup();

  mockCreateNotesNotebook();
  const deleteNotesNotebookStrict = vi
    .spyOn(api, 'deleteNotesNotebookStrict')
    .mockResolvedValue(1);
  vi.spyOn(db, 'insertChannels').mockRejectedValue(new Error('db failed'));

  await expect(
    createChannel({
      groupId,
      title: 'Native notes',
      channelType: 'notes',
    })
  ).rejects.toThrow('Failed to add notes channel to group');

  expect(deleteNotesNotebookStrict).toHaveBeenCalledWith({
    host: '~solfer-magfed',
    name: 'native-notes',
  });
});

test('createChannel rolls back a notes notebook when group listing fails', async () => {
  await insertGroup();

  mockCreateNotesNotebook();
  vi.spyOn(api, 'addChannelListingToGroup').mockRejectedValue(
    new Error('listing failed')
  );
  const deleteNotesNotebookStrict = vi
    .spyOn(api, 'deleteNotesNotebookStrict')
    .mockResolvedValue(1);

  await expect(
    createChannel({
      groupId,
      title: 'Native notes',
      channelType: 'notes',
    })
  ).rejects.toThrow('Failed to add notes channel to group');

  await expect(
    db.getChannel({ id: 'notes/~solfer-magfed/native-notes' })
  ).resolves.toBeNull();
  expect(deleteNotesNotebookStrict).toHaveBeenCalledWith({
    host: '~solfer-magfed',
    name: 'native-notes',
  });
});

test('joinGroupChannel routes notes channels through the notes API', async () => {
  const notesChannelId = 'notes/~zod/native-notes';
  await insertGroupAndChannel({ id: notesChannelId, type: 'notes' });
  const joinNotesChannel = vi
    .spyOn(api, 'joinNotesChannel')
    .mockResolvedValue(undefined);
  const joinChannel = vi.spyOn(api, 'joinChannel').mockResolvedValue(undefined);

  await joinGroupChannel({ channelId: notesChannelId, groupId });

  expect(joinNotesChannel).toHaveBeenCalledWith(notesChannelId);
  expect(joinChannel).not.toHaveBeenCalled();
  await expect(db.getChannel({ id: notesChannelId })).resolves.toMatchObject({
    currentUserIsMember: true,
  });
});

test('leaveGroupChannel routes notes channels through the notes API', async () => {
  const notesChannelId = 'notes/~zod/native-notes';
  await insertGroupAndChannel({ id: notesChannelId, type: 'notes' });
  const leaveNotesChannel = vi
    .spyOn(api, 'leaveNotesChannel')
    .mockResolvedValue(undefined);
  const leaveChannel = vi
    .spyOn(api, 'leaveChannel')
    .mockResolvedValue(undefined);

  await leaveGroupChannel(notesChannelId);

  expect(leaveNotesChannel).toHaveBeenCalledWith(notesChannelId);
  expect(leaveChannel).not.toHaveBeenCalled();
  await expect(db.getChannel({ id: notesChannelId })).resolves.toMatchObject({
    currentUserIsMember: false,
  });
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
