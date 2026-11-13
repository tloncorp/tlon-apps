import { expect, test, vi } from 'vitest';
import {
  DurableClient,
  configureDurableClient,
  durablePostId,
} from '@tloncorp/api/client/durable';
import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import { startDurableSync, acquireDurableConversation } from './durableSync';
import { getSession } from './session';
import { getConversationPresence } from './presence';

vi.mock('@tloncorp/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  configureClient: vi.fn(async () => {}),
}));
setupDatabaseTestSuite();

test('computing presence follows inbox changes without a message cursor change and clears on stop', async () => {
  const f = fixture(2);
  const inbox = await f.client.inbox();
  inbox.rooms[0].computing = true;
  f.inbox.mockResolvedValue(inbox);
  const channel = f.client.bootstrap.rooms[0].channelId;
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    expect(getConversationPresence(channel)).toMatchObject([
      {
        key: { ship: '~ten', topic: 'computing' },
        display: { text: 'Thinking...' },
      },
    ]);
    expect(
      getConversationPresence(f.client.bootstrap.rooms[1].channelId)
    ).toEqual([]);
    const events = f.streams.find((stream) => stream.room === '*')!;
    f.inbox.mockResolvedValue({
      ...inbox,
      rooms: inbox.rooms.map((room) => ({ ...room, computing: false })),
    });
    events.onmessage?.();
    await vi.waitFor(() =>
      expect(getConversationPresence(channel)).toEqual([])
    );
    f.inbox.mockResolvedValue(inbox);
    events.onmessage?.();
    await vi.waitFor(() =>
      expect(getConversationPresence(channel)).toHaveLength(1)
    );
  } finally {
    stop();
  }
  expect(getConversationPresence(channel)).toEqual([]);
});

test('computing presence ignores rooms outside the current user scope and left channels', async () => {
  const f = fixture(2);
  f.client.bootstrap.rooms[1].left = ['brian'];
  const inbox = await f.client.inbox();
  inbox.rooms.forEach((room) => (room.computing = true));
  inbox.rooms.push({ ...inbox.rooms[0], roomId: 'private-to-someone-else' });
  f.inbox.mockResolvedValue(inbox);
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    expect(
      getConversationPresence(f.client.bootstrap.rooms[0].channelId)
    ).toHaveLength(1);
    expect(
      getConversationPresence(f.client.bootstrap.rooms[1].channelId)
    ).toEqual([]);
    expect(getConversationPresence('private-to-someone-else')).toEqual([]);
  } finally {
    stop();
  }
});

function fixture(count = 5) {
  const client = new DurableClient('brian');
  client.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [
      { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
      { id: 'galen', contactId: '~nec', name: 'Galen' },
    ],
    bot: { contactId: '~ten', name: 'Pi' },
    revision: 0,
    groups: [
      {
        id: '~sampel-palnet/durable',
        title: 'Workspace',
        owner: 'brian',
        members: ['brian', 'galen'],
        invited: [],
        privacy: 'secret',
      },
    ],
    rooms: Array.from({ length: count }, (_, i) => ({
      id: `room-${i}`,
      channelId: `chat/~sampel-palnet/room-${i}`,
      title: `Room ${i}`,
      groupId: '~sampel-palnet/durable',
      kind: 'channel' as const,
      members: ['brian', 'galen'],
    })),
  };
  vi.spyOn(client, 'initialize').mockImplementation(
    async () => client.bootstrap
  );
  const state = {
    revision: 1,
    reads: {},
    pins: ['~sampel-palnet/durable'],
    settings: { theme: 'dark' },
  };
  const message = (i: number, text = 'Hello') => ({
    id: `message-${i}`,
    seq: 10000,
    channelSeq: 10000,
    authorId: '~nec',
    sentAt: 1000,
    text,
    content: [{ inline: [text] }],
    reactions: { '~sampel-palnet': '❤️' },
  });
  const activityEvents: import('@tloncorp/api/client/durableActivity').ActivityPage['events'] =
    [];
  const activity = () => ({
    revision: activityEvents.length,
    notifyCount: count,
    newest: 1000,
    sources: client.bootstrap.rooms.map((room) => ({
      roomId: room.id,
      count: 1,
      notifyCount: 1,
      updatedAt: 1000,
    })),
  });
  vi.spyOn(client, 'request').mockImplementation(async (path) => {
    if (!path.startsWith('/activity?'))
      throw new Error(`Unexpected request ${path}`);
    const bucket = new URLSearchParams(path.split('?')[1]).get('bucket');
    return {
      events: activityEvents.filter(
        (event) =>
          bucket === 'all' ||
          (bucket === 'mentions' && event.isMention) ||
          (bucket === 'replies' && event.type === 'reply')
      ),
      nextCursor: null,
      summary: activity(),
      volumes: [],
      revision: activityEvents.length,
      userRevision: state.revision,
      directoryRevision: client.bootstrap.revision,
    } as any;
  });
  const inbox = vi.spyOn(client, 'inbox').mockImplementation(async () => ({
    state,
    activity: activity(),
    rooms: client.bootstrap.rooms.map((room, i) => ({
      roomId: room.id,
      cursor: 10000,
      newestSequenceNum: 10000,
      rootSequenceNum: 10000,
      lastMessage: message(i),
      unread: {
        count: 1,
        countWithoutThreads: 1,
        firstUnreadId: `message-${i}`,
      },
    })),
  }));
  const window = vi
    .spyOn(client, 'window')
    .mockImplementation(async (channel) => ({
      messages: [
        message(Number(channel.split('-').at(-1)), 'Full conversation message'),
      ],
      cursor: 10000,
      newestSequenceNum: 10000,
      older: 9951,
      newer: null,
    }));
  const changes = vi
    .spyOn(client, 'changes')
    .mockResolvedValue({ messages: [], cursor: 10000, more: false });
  vi.spyOn(client, 'threadUnreads').mockResolvedValue([]);
  const page = vi.spyOn(client, 'page');
  const history = vi.spyOn(client, 'history');
  const streams: Stream[] = [];
  class Stream {
    onmessage: (() => void) | null = null;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    closed = false;
    constructor(readonly room: string) {
      streams.push(this);
    }
    close() {
      this.closed = true;
    }
  }
  vi.spyOn(client, 'events').mockImplementation(
    (room) => new Stream(room) as unknown as EventSource
  );
  configureDurableClient(client);
  return {
    client,
    state,
    activityEvents,
    inbox,
    window,
    changes,
    page,
    history,
    streams,
    message,
  };
}

test('Home reads only metadata with hundreds of conversations', async () => {
  const f = fixture(300);
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    expect(f.window).not.toHaveBeenCalled();
    expect(f.page).not.toHaveBeenCalled();
    expect(f.history).not.toHaveBeenCalled();
    expect(f.streams.map((s) => s.room).sort()).toEqual(['*', 'directory']);
    const channel = f.client.bootstrap.rooms[0].channelId;
    expect((await db.getSettings())?.theme).toBe('dark');
    expect((await db.getPins()).map((pin) => pin.itemId)).toEqual([
      '~sampel-palnet/durable',
    ]);
    expect((await db.getChannelUnread({ channelId: channel }))?.count).toBe(1);
    expect(
      (await db.getPost({ postId: durablePostId(channel, 'message-0') }))
        ?.sequenceNum
    ).toBeNull();
    f.streams.find((s) => s.room === 'directory')!.onopen!();
    expect(getSession()?.channelStatus).toBe('active');
    f.state.revision++;
    f.state.settings.theme = 'light';
    f.state.pins = [];
    f.streams.find((s) => s.room === '*')!.onmessage!();
    await vi.waitFor(async () =>
      expect((await db.getSettings())?.theme).toBe('light')
    );
    expect(await db.getPins()).toEqual([]);
    expect(f.window).not.toHaveBeenCalled();
  } finally {
    stop();
  }
}, 10000);

test('only focused conversations fetch content, and old inactive caches are pruned', async () => {
  const f = fixture();
  const errors: Error[] = [];
  const stop = await startDurableSync((error) => {
    if (error) errors.push(error);
  });
  try {
    for (const [i, room] of f.client.bootstrap.rooms.entries()) {
      const release = acquireDurableConversation(room.channelId);
      await vi.waitFor(async () =>
        expect(
          (
            await db.getPost({
              postId: durablePostId(room.channelId, `message-${i}`),
            })
          )?.textContent
        ).toBe('Full conversation message')
      );
      expect(f.window).toHaveBeenLastCalledWith(room.channelId, { count: 50 });
      release();
    }
    const first = f.client.bootstrap.rooms[0].channelId;
    await vi.waitFor(async () =>
      expect(
        (await db.getPost({ postId: durablePostId(first, 'message-0') }))
          ?.sequenceNum
      ).toBeNull()
    );
    expect(
      f.streams.filter((s) => s.room.startsWith('room-')).every((s) => s.closed)
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(f.history).not.toHaveBeenCalled();
  } finally {
    stop();
  }
}, 10000);

test('directory changes add metadata without opening a conversation', async () => {
  const f = fixture(1);
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    f.client.bootstrap.rooms.push({
      ...f.client.bootstrap.rooms[0],
      id: 'room-new',
      channelId: 'chat/~sampel-palnet/new',
      title: 'New room',
    });
    const directory = f.streams.find((s) => s.room === 'directory')!;
    directory.onmessage!();
    await vi.waitFor(async () =>
      expect(
        (await db.getChannel({ id: 'chat/~sampel-palnet/new' }))?.title
      ).toBe('New room')
    );
    expect(f.window).not.toHaveBeenCalled();
    f.client.bootstrap.rooms = f.client.bootstrap.rooms.filter(
      (room) => room.id !== 'room-new'
    );
    directory.onmessage!();
    await vi.waitFor(async () =>
      expect(await db.getChannel({ id: 'chat/~sampel-palnet/new' })).toBeNull()
    );
  } finally {
    stop();
  }
}, 10000);

test('Activity sync persists mentions without waking rooms and seen state leaves chat unread', async () => {
  const f = fixture(1);
  const event = {
    id: 1,
    timestamp: 1000,
    roomId: 'room-0',
    messageId: 'message-0',
    messageSeq: 10000,
    authorId: '~nec',
    type: 'post' as const,
    content: [{ inline: ['Hello Brian'] }],
    isMention: true,
    isRead: false,
  };
  f.activityEvents.push(event);
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    const mentions = await db.getBucketedActivityPage({
      bucket: 'mentions',
      existingSourceIds: [],
    });
    expect(mentions).toHaveLength(1);
    expect(mentions[0].newest).toMatchObject({
      postId: durablePostId(f.client.bootstrap.rooms[0].channelId, 'message-0'),
      isMention: true,
    });
    expect(
      await db.getUnreadUnseenActivityEvents({ seenMarker: 0 })
    ).not.toHaveLength(0);
    (f.state.settings as Record<string, unknown>).activitySeenTimestamp = 1000;
    f.state.revision++;
    f.streams.find((stream) => stream.room === '*')!.onmessage!();
    await vi.waitFor(async () =>
      expect((await db.getSettings())?.activitySeenTimestamp).toBe(1000)
    );
    expect(
      (
        await db.getChannelUnread({
          channelId: f.client.bootstrap.rooms[0].channelId,
        })
      )?.count
    ).toBe(1);
    expect(
      await db.getUnreadUnseenActivityEvents({ seenMarker: 1000 })
    ).toHaveLength(0);
    f.activityEvents[0].isRead = true;
    f.state.revision++;
    f.streams.find((stream) => stream.room === '*')!.onmessage!();
    await vi.waitFor(async () =>
      expect(
        await db.getUnreadUnseenActivityEvents({ seenMarker: 0 })
      ).toHaveLength(0)
    );
    expect(
      await db.getBucketedActivityPage({
        bucket: 'mentions',
        existingSourceIds: [],
      })
    ).toHaveLength(1);
    expect(f.window).not.toHaveBeenCalled();
    expect(f.page).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

test('directory snapshots replace roles, bans, requests and sections, including removals', async () => {
  const f = fixture(1),
    group = f.client.bootstrap.groups[0],
    channelId = f.client.bootstrap.rooms[0].channelId;
  group.roles = [{ id: 'reviewer', title: 'Reviewer' }];
  group.memberRoles = { galen: ['admin', 'reviewer'] };
  group.banned = ['galen'];
  group.requests = ['galen'];
  group.sections = [{ id: 'news', title: 'News', channels: [channelId] }];
  f.client.bootstrap.rooms[0].writers = ['reviewer'];
  const errors: Error[] = [];
  const stop = await startDurableSync((error) => {
    if (error) errors.push(error);
  });
  try {
    const before = await db.getGroup({ id: group.id });
    expect(
      before?.members
        .find((member) => member.contactId === '~nec')
        ?.roles.map((role) => role.roleId)
        .sort()
    ).toEqual(['admin', 'reviewer']);
    expect(before?.bannedMembers).toHaveLength(1);
    expect(before?.joinRequests).toHaveLength(1);
    expect(before?.navSections[0]?.title).toBe('News');
    expect(
      (
        await db.getChannel({ id: channelId, includeWriters: true })
      )?.writerRoles?.map((role) => role.roleId)
    ).toEqual(['admin', 'reviewer']);
    group.roles = [];
    group.memberRoles = {};
    group.banned = [];
    group.requests = [];
    group.sections = [
      { id: 'channels', title: 'Channels', channels: [channelId] },
    ];
    f.client.bootstrap.rooms[0].writers = [];
    f.client.bootstrap.revision++;
    f.streams.find((stream) => stream.room === 'directory')!.onmessage!();
    await vi.waitFor(async () => {
      const after = await db.getGroup({ id: group.id });
      expect(
        after?.members.find((member) => member.contactId === '~nec')?.roles
      ).toEqual([]);
      expect(after?.roles.map((role) => role.id)).toEqual(['admin']);
      expect(after?.bannedMembers).toEqual([]);
      expect(after?.joinRequests).toEqual([]);
      expect(after?.navSections.map((section) => section.title)).toEqual([
        'Channels',
      ]);
      expect(
        (await db.getChannel({ id: channelId, includeWriters: true }))
          ?.writerRoles
      ).toEqual([]);
    });
    expect(errors).toEqual([]);
  } finally {
    stop();
  }
});

test('leaving a channel closes its sync and exposes it as available until rejoined', async () => {
  const f = fixture(1),
    room = f.client.bootstrap.rooms[0];
  const errors: Error[] = [];
  const stop = await startDurableSync((error) => {
    if (error) errors.push(error);
  });
  try {
    const release = acquireDurableConversation(room.channelId);
    await vi.waitFor(() => expect(f.window).toHaveBeenCalledOnce());
    room.left = ['brian'];
    f.client.bootstrap.revision++;
    f.streams.find((stream) => stream.room === 'directory')!.onmessage!();
    await vi.waitFor(async () =>
      expect(
        (await db.getChannel({ id: room.channelId }))?.currentUserIsMember
      ).toBe(false)
    );
    expect(f.streams.find((stream) => stream.room === room.id)?.closed).toBe(
      true
    );
    acquireDurableConversation(room.channelId)();
    expect(f.window).toHaveBeenCalledOnce();
    release();
    room.left = [];
    f.client.bootstrap.revision++;
    f.streams.find((stream) => stream.room === 'directory')!.onmessage!();
    await vi.waitFor(async () =>
      expect(
        (await db.getChannel({ id: room.channelId }))?.currentUserIsMember
      ).toBe(true)
    );
    const releaseAgain = acquireDurableConversation(room.channelId);
    await vi.waitFor(() => expect(f.window).toHaveBeenCalledTimes(2));
    releaseAgain();
    expect(errors).toEqual([]);
  } finally {
    stop();
  }
});

test('revoking channel access drops its active reader and cached message bodies', async () => {
  const f = fixture(1),
    room = f.client.bootstrap.rooms[0];
  f.state.pins = [room.channelId];
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    const release = acquireDurableConversation(room.channelId);
    const postId = durablePostId(room.channelId, 'message-0');
    await vi.waitFor(async () =>
      expect((await db.getPost({ postId }))?.textContent).toBe(
        'Full conversation message'
      )
    );
    f.client.bootstrap.rooms = [];
    f.client.bootstrap.revision++;
    f.streams.find((stream) => stream.room === 'directory')!.onmessage!();
    await vi.waitFor(async () => {
      expect(await db.getChannel({ id: room.channelId })).toBeNull();
      expect(await db.getPost({ postId })).toBeNull();
      expect(await db.getPins()).toEqual([]);
    });
    expect(f.streams.find((stream) => stream.room === room.id)?.closed).toBe(
      true
    );
    expect(() => acquireDurableConversation(room.channelId)()).not.toThrow();
    release();
  } finally {
    stop();
  }
});

test('gallery sync retains its renderer, image metadata and comment summaries', async () => {
  const f = fixture(1),
    room = f.client.bootstrap.rooms[0];
  room.channelId = 'heap/~sampel-palnet/gallery';
  f.window.mockImplementation(async () => ({
    messages: [
      {
        ...f.message(0, 'Gallery caption'),
        metadata: { title: 'Gallery title' },
        content: [{ inline: ['Gallery caption'] }],
        replyCount: 2,
      },
    ],
    cursor: 10000,
    newestSequenceNum: 10000,
    older: null,
    newer: null,
  }));
  f.state.pins = [room.channelId];
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    const release = acquireDurableConversation(room.channelId);
    await vi.waitFor(async () =>
      expect(
        await db.getPost({ postId: durablePostId(room.channelId, 'message-0') })
      ).toMatchObject({ type: 'block', title: 'Gallery title', replyCount: 2 })
    );
    expect(await db.getChannel({ id: room.channelId })).toMatchObject({
      type: 'gallery',
      contentConfiguration: {
        draftInput: 'tlon.r0.input.gallery',
        defaultPostCollectionRenderer: 'tlon.r0.collection.gallery',
      },
    });
    expect((await db.getPins())[0]).toMatchObject({
      itemId: room.channelId,
      type: 'channel',
    });
    release();
  } finally {
    stop();
  }
});

test('simultaneous personal agents keep separate native thinking indicators', async () => {
  const f = fixture(1);
  const inbox = await f.client.inbox();
  inbox.rooms[0].computing = true;
  inbox.rooms[0].computingAgents = ['~dur', '~pen'];
  f.inbox.mockResolvedValue(inbox);
  const channel = f.client.bootstrap.rooms[0].channelId;
  const stop = await startDurableSync((error) => {
    if (error) throw error;
  });
  try {
    expect(
      getConversationPresence(channel)
        .map((status) => status.key.ship)
        .sort()
    ).toEqual(['~dur', '~pen'].sort());
    f.inbox.mockResolvedValue({
      ...inbox,
      rooms: inbox.rooms.map((room) => ({
        ...room,
        computingAgents: ['~pen'],
      })),
    });
    f.streams.find((stream) => stream.room === '*')!.onmessage?.();
    await vi.waitFor(() =>
      expect(
        getConversationPresence(channel).map((status) => status.key.ship)
      ).toEqual(['~pen'])
    );
  } finally {
    stop();
  }
});
