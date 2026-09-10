import {
  StructuredChannelDescriptionPayload,
  scry,
  subscribe,
  toClientGroup,
} from '@tloncorp/api';
import '@tloncorp/api';
import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/api';
import {
  CombinedHeads,
  GroupsInit10,
  PagedPosts,
  PostDataResponse,
} from '@tloncorp/api/urbit';
import {
  ContactBookScryResult1,
  ContactsDirectoryScryResult1,
} from '@tloncorp/api/urbit/contact';
import { GroupV11 as UrbitGroup } from '@tloncorp/api/urbit/groups';
import * as $ from 'drizzle-orm';
import { pick } from 'lodash';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { MockInstance } from 'vitest';

import rawChannelPostWithRepliesData from '../../../../api/src/__tests__/fixtures/channelPostWithReplies.json';
import rawChannelPostsData from '../../../../api/src/__tests__/fixtures/channelPosts.json';
import * as db from '../../db';
import { MIN_GROUPS_VERSION } from '../../logic';
import rawNewestPostData from '../../test/channelNewestPost.json';
import rawAfterNewestPostData from '../../test/channelPostsAfterNewest.json';
import rawContactsData from '../../test/contactsDirectory.json';
import rawGroupsData from '../../test/groups.json';
import rawGroupsInitData from '../../test/groupsInit.json';
import rawHeadsData from '../../test/heads.json';
import {
  getClient,
  setScryOutput,
  setScryOutputs,
  setupDatabaseTestSuite,
} from '../../test/helpers';
import rawGroupsInit2 from '../../test/init.json';
import {
  DeskCompatibility,
  getSession,
  subscribeToSession,
  updateInitializedClient,
  updateSession,
} from '../session';
import { syncQueue } from '../syncQueue';
import {
  clearSyncStartLock,
  ensureDmInviteChannel,
  handleDiscontinuity,
  retryDeskCompatibility,
  syncChannelWithBackoff,
  syncDms,
  syncGroups,
  syncInitData,
  syncInitialPosts,
  syncLatestPosts,
  syncPinnedItems,
  syncPosts,
  syncStart,
  syncThreadPosts,
  syncUpdatedPosts,
} from './sync';
import { syncContacts } from './syncContacts';

const rawContactsData2 = {};
const rawContactSuggestionsData: string[] = [];

const channelPostWithRepliesData =
  rawChannelPostWithRepliesData as unknown as PostDataResponse;
const contactsData = rawContactsData as unknown as ContactsDirectoryScryResult1;
const contactBookData = rawContactsData2 as unknown as ContactBookScryResult1;
const suggestionsData = rawContactSuggestionsData as unknown as string[];
const groupsData = rawGroupsData as unknown as Record<string, UrbitGroup>;
const groupsInitData = rawGroupsInitData as unknown as GroupsInit10;
const groupsInitData2 = rawGroupsInit2 as unknown as GroupsInit10;
const headsData = rawHeadsData as unknown as CombinedHeads;

setupDatabaseTestSuite();

const inputData = [
  '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  '~solfer-magfed',
  '~nibset-napwyn/tlon',
];

vi.mock('../lure', () => ({
  useLureState: {
    getState: () => ({
      start: () => ({}),
    }),
  },
}));

const DEFAULT_USER_ID = '~solfer-magfed';
// Mutable so a test can switch ships mid-flight; hoisted because vi.mock's
// factory runs before the module body.
const urbitMockState = vi.hoisted(() => ({ currentUserId: '~solfer-magfed' }));

// Extends the shared mock in test/setup.ts: the sync start lifecycle tests
// below need to see whether subscriptions were established.
vi.mock('../../../../api/src/client/urbit', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;

  return {
    ...mod,
    scry: vi.fn(),
    poke: vi.fn(),
    trackedPoke: vi.fn(),
    subscribe: vi.fn(),
    subscribeOnce: vi.fn(),
    getCurrentUserId: () => urbitMockState.currentUserId,
  };
});

const outputData = [
  {
    type: 'groupDm',
    index: 0,
    itemId: inputData[0],
  },
  {
    type: 'dm',
    index: 1,
    itemId: inputData[1],
  },
  {
    type: 'group',
    index: 2,
    itemId: inputData[2],
  },
];

const dmChannel = (id: string, isDmInvite: boolean): db.Channel => ({
  id,
  type: 'dm',
  title: '',
  description: '',
  isDmInvite,
  contactId: id,
  members: [{ chatId: id, contactId: id, membershipType: 'channel' }],
});

test('syncs pins', async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = (await db.getPinnedItems()).sort(
    (a, b) => a.index - b.index
  );
  expect(savedItems).toEqual(outputData);
});

// TLON-5606: after a user clears a failed send, `syncChannelWithBackoff`
// must not treat the deleted optimistic row as a still-pending message.
// The invariant the backoff relies on is
// `getDeliveryPendingPosts(channelId).length` going to zero once the only
// failed row has `isDeleted: true`.
test('syncChannelWithBackoff resolves when the only failed post was locally cleared', async () => {
  const channelId = 'backoff-test-channel';
  await db.insertChannels([{ id: channelId, type: 'chat' }]);

  // Seed a row that would have ghosted the backoff loop before the fix.
  await db.insertChannelPosts({
    posts: [
      {
        id: 'cleared-failed',
        type: 'chat',
        channelId,
        authorId: '~zod',
        sentAt: Date.now(),
        receivedAt: Date.now(),
        sequenceNum: 0,
        content: JSON.stringify([{ inline: ['will be cleared'] }]),
        deliveryStatus: 'failed',
        isDeleted: true,
        syncedAt: Date.now(),
      } as unknown as db.Post,
    ],
  });

  // Delivery polling explicitly excludes `failed` rows (they are handled
  // by the retry/delete flow), so the backoff's `isStillPending` short-
  // circuits on the first tick.
  expect((await db.getDeliveryPendingPosts(channelId)).length).toBe(0);

  // `backOff` uses setTimeout, so fake timers let the test resolve without
  // waiting for the 3s startingDelay.
  vi.useFakeTimers();
  try {
    const promise = syncChannelWithBackoff({ channelId });
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(promise).resolves.toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

// TLON-5606 / post-review 5: a user can delete an optimistic post while its
// original send is still in flight (`enqueued` or `pending`). Those rows
// must stay visible to the delivery-polling path so the server round trip
// still reconciles — otherwise the delete silently strands the in-flight
// message until some unrelated sync repairs it. Under the post-review 8
// contract, they also surface from `getPendingPosts` as a DB-backed
// tombstone source (only `failed + isDeleted` is excluded from the UI).
test('syncChannelWithBackoff keeps polling when a deleted row is still in flight', async () => {
  const channelId = 'backoff-inflight-channel';
  await db.insertChannels([{ id: channelId, type: 'chat' }]);

  await db.insertChannelPosts({
    posts: [
      {
        id: 'deleted-but-still-pending',
        type: 'chat',
        channelId,
        authorId: '~zod',
        sentAt: Date.now(),
        receivedAt: Date.now(),
        sequenceNum: 0,
        content: JSON.stringify([{ inline: ['in flight'] }]),
        deliveryStatus: 'pending',
        // User deleted the optimistic post mid-flight.
        isDeleted: true,
        syncedAt: Date.now(),
      } as unknown as db.Post,
    ],
  });

  // Delivery polling query keeps the row visible — still in flight.
  expect((await db.getDeliveryPendingPosts(channelId)).length).toBe(1);
  // UI query also surfaces it as a tombstone source so remount renders a
  // "Message deleted" row instead of a gap while the send reconciles.
  expect((await db.getPendingPosts(channelId)).length).toBe(1);
});

// TLON-5606 regression guard: deleted rows with the final local-only shape
// (`failed + isDeleted`) must stay out of BOTH the UI pending source AND
// the delivery-polling source — failed sends do not re-poll, and leaving
// them in the UI would re-introduce the original ghost-at-bottom bug.
test('deleted failed rows are excluded from both UI and delivery queries', async () => {
  const channelId = 'backoff-failed-channel';
  await db.insertChannels([{ id: channelId, type: 'chat' }]);

  await db.insertChannelPosts({
    posts: [
      {
        id: 'deleted-failed',
        type: 'chat',
        channelId,
        authorId: '~zod',
        sentAt: Date.now(),
        receivedAt: Date.now(),
        sequenceNum: 0,
        content: JSON.stringify([{ inline: ['failed'] }]),
        deliveryStatus: 'failed',
        isDeleted: true,
        syncedAt: Date.now(),
      } as unknown as db.Post,
    ],
  });

  expect((await db.getPendingPosts(channelId)).length).toBe(0);
  expect((await db.getDeliveryPendingPosts(channelId)).length).toBe(0);
});

// TLON-5606 / post-review 9: after `markPostSent` flips a row to
// `deliveryStatus: 'sent'` the sequenced `addPost` event carries the real
// sequence number. If that follow-up event is delayed or missed, the row
// can strand as `sent + sequenceNum:0`. The delivery loop must keep
// polling across that catch-up window and only settle once the row is
// reconciled with a real `sequenceNum`.
test('syncChannelWithBackoff keeps polling across the markPostSent catch-up window', async () => {
  const channelId = 'backoff-catchup-channel';
  await db.insertChannels([{ id: channelId, type: 'chat' }]);

  const catchUpId = 'sent-catchup';
  await db.insertChannelPosts({
    posts: [
      {
        id: catchUpId,
        type: 'chat',
        channelId,
        authorId: '~zod',
        sentAt: Date.now(),
        receivedAt: Date.now(),
        sequenceNum: 0,
        content: JSON.stringify([{ inline: ['server acked, no seq yet'] }]),
        deliveryStatus: 'sent',
        syncedAt: Date.now(),
      } as unknown as db.Post,
    ],
  });

  // Precondition: the row is still visible to the delivery-polling path.
  expect(
    (await db.getDeliveryPendingPosts(channelId)).map((p) => p.id)
  ).toContain(catchUpId);

  // Simulate the sequenced `addPost` finally arriving: the row is
  // reconciled in place with a real `sequenceNum` and the deliveryStatus
  // transition that normally follows.
  await db.updatePost({
    id: catchUpId,
    sequenceNum: 42,
    deliveryStatus: null,
  });

  // The polling query must now drop the row — nothing left to reconcile.
  expect(
    (await db.getDeliveryPendingPosts(channelId)).map((p) => p.id)
  ).not.toContain(catchUpId);
});

test('syncs contacts', async () => {
  setScryOutputs([contactsData, contactBookData, suggestionsData]);
  await syncContacts();
  const storedContacts = await db.getContacts();
  expect(storedContacts.length).toEqual(Object.keys(contactsData).length);
  storedContacts.forEach((c) => {
    const original = contactsData[c.id];
    expect(original).toBeTruthy();
    expect(original.contact.groups?.value.length ?? 0).toEqual(
      c.pinnedGroups.length
    );
  });
  setScryOutputs([contactsData, contactBookData, suggestionsData]);
  await syncContacts();
});

test('sync groups', async () => {
  setScryOutput(groupsData);
  await syncGroups();
  const pins = Object.keys(groupsData).slice(0, 3);
  setScryOutput(pins);
  await syncPinnedItems();
  const storedGroups = await db.getGroups({});
  expect(storedGroups.length).toEqual(Object.values(groupsData).length);
});

test('syncs dms', async () => {
  const groupDmId = '0v4.00000.qd4p2.it253.qs53q.s53qs';
  setScryOutputs([
    ['~solfer-magfed'],
    {
      [groupDmId]: {
        net: 'done',
        hive: ['~latter-bolden'],
        team: [
          '~nocsyx-lassul',
          '~rilfun-lidlen',
          '~pondus-watbel',
          '~solfer-magfed',
          '~finned-palmer',
          '~palfun-foslup',
        ],
        meta: {
          image: '#f0ebbd',
          title: 'Pensacola 2024-04',
          cover: '',
          description: '',
        },
      },
    },
    ['~sampel-palnet'],
  ]);
  await syncDms();

  const singleChannel = await db.getChannel({
    id: '~solfer-magfed',
    includeMembers: true,
  });
  expect(singleChannel).toEqual(
    db.buildChannel({
      id: '~solfer-magfed',
      type: 'dm',
      contactId: '~solfer-magfed',
      title: '',
      description: '',
      lastPostSequenceNum: null,
      currentUserIsMember: null,
      members: [
        {
          chatId: '~solfer-magfed',
          contactId: '~solfer-magfed',
          contact: null,
          joinedAt: null,
          membershipType: 'channel',
          status: null,
        },
      ],
    })
  );
  const groupDmChannel = await db.getChannel({
    id: groupDmId,
    includeMembers: true,
  });
  expect(groupDmChannel).toEqual(
    db.buildChannel({
      id: '0v4.00000.qd4p2.it253.qs53q.s53qs',
      type: 'groupDm',
      contactId: null,
      iconImageColor: '#f0ebbd',
      title: 'Pensacola 2024-04',
      // nb: we coerce empty description strings to null
      description: null,
      lastPostSequenceNum: null,
      currentUserIsMember: null,
      members: db
        .buildChatMembers({
          chatId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
          membershipType: 'channel',
        })
        .add(
          { contactId: '~nocsyx-lassul', status: 'joined' },
          { contactId: '~rilfun-lidlen', status: 'joined' },
          { contactId: '~pondus-watbel', status: 'joined' },
          { contactId: '~solfer-magfed', status: 'joined' },
          { contactId: '~finned-palmer', status: 'joined' },
          { contactId: '~palfun-foslup', status: 'joined' },
          { contactId: '~latter-bolden', status: 'invited' }
        )
        .build(),
    })
  );

  const inviteChannel = await db.getChannel({
    id: '~sampel-palnet',
    includeMembers: true,
  });
  expect(inviteChannel).toEqual(
    db.buildChannel({
      id: '~sampel-palnet',
      type: 'dm',
      contactId: '~sampel-palnet',
      title: '',
      description: '',
      isDmInvite: true,
      lastPostSequenceNum: null,
      currentUserIsMember: null,
      members: [
        {
          chatId: '~sampel-palnet',
          contactId: '~sampel-palnet',
          contact: null,
          joinedAt: null,
          membershipType: 'channel',
          status: null,
        },
      ],
    })
  );
});

test('syncDms lets regular DMs win when backend invite state overlaps', async () => {
  setScryOutputs([['~sampel-palnet'], {}, ['~sampel-palnet']]);

  await syncDms();

  const channel = await db.getChannel({ id: '~sampel-palnet' });
  expect(channel?.type).toBe('dm');
  expect(channel?.isDmInvite).toBe(false);
});

test('ensureDmInviteChannel inserts a pending single-DM invite from backend invites', async () => {
  setScryOutputs([[], ['~sampel-palnet']]);

  const result = await ensureDmInviteChannel({
    channelId: '~sampel-palnet',
  });

  expect(result).toEqual({ found: true, state: 'pending-invite' });
  const channel = await db.getChannel({ id: '~sampel-palnet' });
  expect(channel?.type).toBe('dm');
  expect(channel?.isDmInvite).toBe(true);
  expect(channel?.contactId).toBe('~sampel-palnet');
});

test('ensureDmInviteChannel refreshes the target as a regular DM from backend DMs', async () => {
  await db.insertChannels([dmChannel('~sampel-palnet', true)]);
  setScryOutputs([['~sampel-palnet'], []]);

  const result = await ensureDmInviteChannel({
    channelId: '~sampel-palnet',
  });

  expect(result).toEqual({ found: true, state: 'regular-dm' });
  const channel = await db.getChannel({ id: '~sampel-palnet' });
  expect(channel?.type).toBe('dm');
  expect(channel?.isDmInvite).toBe(false);
  expect(channel?.contactId).toBe('~sampel-palnet');
});

test('ensureDmInviteChannel deletes the target when a local invite is stale', async () => {
  await db.insertChannels([
    dmChannel('~sampel-palnet', true),
    {
      ...dmChannel('~wicdev-wisryt', true),
      title: 'Unrelated request',
    },
  ]);
  setScryOutputs([[], []]);

  const result = await ensureDmInviteChannel({
    channelId: '~sampel-palnet',
  });

  expect(result).toEqual({ found: false, state: 'missing' });
  expect(await db.getChannel({ id: '~sampel-palnet' })).toBeNull();

  const unrelated = await db.getChannel({ id: '~wicdev-wisryt' });
  expect(unrelated?.isDmInvite).toBe(true);
  expect(unrelated?.title).toBe('Unrelated request');
});

test('ensureDmInviteChannel returns missing without deleting a non-invite local channel', async () => {
  await db.insertChannels([dmChannel('~sampel-palnet', false)]);
  setScryOutputs([[], []]);

  const result = await ensureDmInviteChannel({
    channelId: '~sampel-palnet',
  });

  expect(result).toEqual({ found: false, state: 'missing' });
  const channel = await db.getChannel({ id: '~sampel-palnet' });
  expect(channel?.isDmInvite).toBe(false);
});

const groupId = '~solfer-magfed/test-group';
const channelId = 'chat/~solfer-magfed/test-channel';

const testGroupData: db.Group = {
  ...toClientGroup(
    groupId,
    Object.values(rawGroupsData)[0] as unknown as UrbitGroup,
    true
  ),
  navSections: [
    {
      id: 'abc',
      sectionId: `${groupId}-abc`,
      groupId,
      channels: [{ channelIndex: 0, channelId, groupNavSectionId: 'abc' }],
    },
  ],
  channels: [{ id: channelId, groupId, type: 'chat' }],
};

// test('sync posts', async () => {
//   const channelId = 'chat/~solfer-magfed/test-channel';
//   setScryOutputs([rawNewestPostData, rawAfterNewestPostData]);
//   await db.insertChannels([{ id: channelId, type: 'chat' }]);
//   await syncPosts({
//     channelId,
//     count: 1,
//     cursor: 'x',
//     mode: 'older',
//   });
//   await syncPosts({
//     channelId,
//     count: 1,
//     cursor: 'x',
//     mode: 'older',
//   });
//   const posts = await db.getChannelPosts({
//     channelId,
//     count: 100,
//     mode: 'newest',
//   });
//   expect(posts.length).toEqual(11);
// });

// test('deletes removed posts', async () => {
//   await db.insertGroups({ groups: [testGroupData] });
//   const insertedChannel = await db.getChannel({ id: channelId });
//   expect(insertedChannel).toBeTruthy();
//   const deletedPosts = Object.fromEntries(
//     Object.entries(rawChannelPostsData.posts).map(([id, _post]) => [
//       id,
//       { ..._post, type: 'tombstone' },
//     ])
//   );
//   const deleteResponse = { ...rawChannelPostsData, posts: deletedPosts };
//   setScryOutput(deleteResponse as PagedPosts);
//   await syncPosts({ channelId, mode: 'newest' });
//   const posts = await db.getPosts();
//   expect(posts.length).toEqual(0);
// });

test('syncs init data', async () => {
  setScryOutput(rawGroupsInitData);
  await syncInitData();
  const groups = await db.getGroups({});
  expect(groups.length).toEqual(Object.values(groupsInitData.groups).length);
  const pins = await db.getPinnedItems();
  expect(pins.length).toEqual(groupsInitData.pins.length);
  const dmsAndClubs = await getClient()
    ?.select({ count: $.count() })
    .from(db.schema.channels)
    .where(
      $.or(
        $.eq(db.schema.channels.type, 'dm'),
        $.eq(db.schema.channels.type, 'groupDm')
      )
    );
  expect(dmsAndClubs?.[0].count).toEqual(
    groupsInitData.chat.dms.length +
      Object.keys(groupsInitData.chat.clubs).length
  );
});

test('syncs last posts', async () => {
  setScryOutputs([groupsInitData2, headsData]);
  await syncInitData();
  await syncLatestPosts();
  const chats = await db.getChats();
  const NUM_EMPTY_TEST_GROUPS = 6;
  // now that channels are included by default, we need to account for them
  const NUM_EMPTY_TEST_CHANNELS = 8;
  console.log('unpinned chats', chats.unpinned.length);
  console.log(
    'unpinned chats types',
    chats.unpinned.map((c) => [
      c.type,
      'channel' in c ? c.channel?.type : undefined,
    ])
  );
  const chatsWithLatestPosts = chats.unpinned.filter((c) => {
    const should = c.type === 'channel' ? c.channel.lastPost : c.group.lastPost;
    console.log(Boolean(should), c.id);
    return should;
  });
  expect(chatsWithLatestPosts.length).toEqual(
    chats.unpinned.length - (NUM_EMPTY_TEST_GROUPS + NUM_EMPTY_TEST_CHANNELS)
  );
});

test('init data repairs latest posts that arrived before channel rows', async () => {
  const client = getClient();
  if (!client) throw new Error('test db not initialized');

  await db.headsSyncedAt.resetValue();
  setScryOutputs([headsData, groupsInitData2]);

  await syncLatestPosts();
  await syncInitData();

  const missingAfterInit = await client
    .select({ count: $.countDistinct(db.schema.channels.id) })
    .from(db.schema.channels)
    .innerJoin(
      db.schema.posts,
      $.eq(db.schema.posts.channelId, db.schema.channels.id)
    )
    .where(
      $.and(
        $.isNull(db.schema.channels.lastPostId),
        $.ne(db.schema.posts.type, 'reply'),
        $.or(
          $.isNull(db.schema.posts.isDeleted),
          $.eq(db.schema.posts.isDeleted, false)
        )
      )
    );
  expect(missingAfterInit[0].count).toBe(0);
});

test('syncs thread posts', async () => {
  setScryOutput(channelPostWithRepliesData);
  await db.insertChannels([{ id: channelId, type: 'chat' }]);
  await syncThreadPosts({
    postId: channelPostWithRepliesData.seal.id,
    authorId: channelPostWithRepliesData.essay.author as string,
    channelId,
  });
  const posts = await db.getPosts();
  expect(posts.length).toEqual(
    Object.keys(channelPostWithRepliesData.seal.replies).length + 1
  );
});

test.each([
  ['DM', '~pinser-botter-podfyl-parseb'],
  ['group DM', '0v4.00000.qd4mk.d4htu.er4b8.eao21'],
])('syncUpdatedPosts skips %s before queueing', async (_label, channelId) => {
  const enqueue = vi.spyOn(syncQueue, 'add');
  vi.mocked(scry).mockClear();
  try {
    await expect(
      syncUpdatedPosts(
        {
          channelId,
          startCursor: '1',
          endCursor: '2',
          afterTime: new Date(0),
        },
        { priority: 4 }
      )
    ).resolves.toBeUndefined();

    expect(enqueue).not.toHaveBeenCalled();
    expect(scry).not.toHaveBeenCalled();
    expect(await db.getPosts()).toEqual([]);
  } finally {
    enqueue.mockRestore();
  }
});

test('syncUpdatedPosts fetches and persists changed group-channel posts', async () => {
  await db.insertChannels([{ id: channelId, type: 'chat' }]);
  vi.mocked(scry).mockClear();
  setScryOutput(rawChannelPostsData);

  const response = await syncUpdatedPosts({
    channelId,
    startCursor: '1',
    endCursor: '2',
    afterTime: new Date(0),
  });

  expect(scry).toHaveBeenCalledOnce();
  expect(scry).toHaveBeenCalledWith({
    app: 'channels',
    path: `/v4/${channelId}/posts/changes/1/2/~1970.1.1`,
  });
  expect(response?.posts.length).toBeGreaterThan(0);
  const savedPosts = await db.getPosts();
  expect(savedPosts.map((post) => post.id).sort()).toEqual(
    response?.posts.map((post) => post.id).sort()
  );
  expect(savedPosts.every((post) => post.channelId === channelId)).toBe(true);
});

test('syncs groups, decoding structured description payloads', async () => {
  const groupId = '~fabled-faster/new-york';
  const groupWithScdp = pick(groupsData, groupId);
  const channelId = 'chat/~tormut-bolpub/nyc-housing-7361';
  const channel = groupWithScdp['~fabled-faster/new-york'].channels[channelId];
  const descriptionText = 'cheers';
  const channelContentConfiguration = {
    draftInput: { id: DraftInputId.chat },
    defaultPostContentRenderer: { id: PostContentRendererId.notebook },
    defaultPostCollectionRenderer: { id: CollectionRendererId.gallery },
  };
  channel.meta.description = StructuredChannelDescriptionPayload.encode({
    description: descriptionText,
    channelContentConfiguration,
  })!;
  setScryOutput(groupsData);
  await syncGroups();
  const pins = Object.keys(groupsData).slice(0, 3);
  setScryOutput(pins);
  await syncPinnedItems();
  const channelFromDb = await db.getChannel({ id: channelId });
  expect(channelFromDb).toBeTruthy();
  expect(channelFromDb!.description).toEqual(descriptionText);
  expect(channelFromDb!.contentConfiguration).toMatchObject(
    channelContentConfiguration
  );
});

// Desk compatibility gate: startup probes the ship's %groups version before it
// touches any path an old desk can't serve.
describe('desk compatibility gate', () => {
  // Anything that gets past the gate runs the whole of sync start, including
  // the init-data writes, which take longer than the default per-test budget.
  // The gated cases are fast, but they get the same budget so a regression
  // that lets sync through fails on an assertion rather than on the clock.
  const FULL_SYNC_TIMEOUT = 30_000;
  const PROBE_TIMEOUT = 10 * 1000;
  const pikesData = { groups: { hash: '0v1.abc', sync: { ship: '~zod' } } };

  let reportedDeskVersion: string | null = MIN_GROUPS_VERSION;
  let probeError: Error | null = null;
  let pikesError: Error | null = null;
  let pikesHangs = false;
  let heldProbe: { wait: Promise<void>; release: () => void } | null = null;
  let scryCalls: { app: string; path: string; timeout?: number }[] = [];
  type SetValueSpy<
    T extends { setValue: (...args: never[]) => Promise<void> },
  > = MockInstance<Parameters<T['setValue']>, Promise<void>>;
  let setAppInfo: SetValueSpy<typeof db.appInfo>;
  let setDidSyncInitialPosts: SetValueSpy<typeof db.didSyncInitialPosts>;
  let setUserHasCompletedFirstSync: SetValueSpy<
    typeof db.userHasCompletedFirstSync
  >;

  const scryPaths = () => scryCalls.map(({ app, path }) => `${app}${path}`);
  const didScry = (fragment: string) =>
    scryPaths().some((path) => path.includes(fragment));
  const probeCount = () =>
    scryCalls.filter(({ path }) => path === '/kiln/pikes').length;

  // Lets a test keep the probe in flight while it does something else (log out,
  // let the timeout fire) and then decide what a late answer does.
  const holdProbe = () => {
    let release = () => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = { wait, release };
    heldProbe = gate;
    return () => {
      if (heldProbe === gate) {
        heldProbe = null;
      }
      release();
    };
  };

  // What useHandleLogout does: drops the client, clears the session, releases
  // the sync lock. updateInitializedClient is the lifecycle call underneath
  // clientActions' configureClient/removeClient.
  const logOut = () => {
    updateInitializedClient(false);
    updateSession(null);
    clearSyncStartLock();
  };
  const logIn = (userId = DEFAULT_USER_ID) => {
    urbitMockState.currentUserId = userId;
    updateInitializedClient(true);
  };

  const installScryMock = () => {
    vi.mocked(scry).mockImplementation((async (args: {
      app: string;
      path: string;
      timeout?: number;
    }) => {
      scryCalls.push(args);
      const { app, path } = args;
      const isProbePath =
        (app === 'hood' && path === '/kiln/pikes') ||
        (app === 'docket' && path === '/charges');
      if (isProbePath) {
        // Captured synchronously: a second probe gets its own gate, and this
        // one keeps waiting on the gate it was issued under.
        const gate = heldProbe;
        if (gate) {
          await gate.wait;
        }
        if (probeError) {
          throw probeError;
        }
        if (app === 'hood' && pikesError) {
          throw pikesError;
        }
        if (app === 'hood' && pikesHangs) {
          // Mirrors the client: the timeout it was given is the only thing
          // that ends a hung scry.
          return new Promise((_resolve, reject) => {
            if (args.timeout != null) {
              setTimeout(
                () => reject(new Error('pikes timed out')),
                args.timeout
              );
            }
          });
        }
        if (app === 'hood') {
          return pikesData;
        }
        return {
          initial:
            reportedDeskVersion === null
              ? {}
              : { groups: { version: reportedDeskVersion } },
        };
      }
      if (app === 'groups-ui' && path === '/v10/init') {
        return groupsInitData;
      }
      if (app === 'groups-ui' && path.startsWith('/v4/heads')) {
        return headsData;
      }
      if (app === 'groups-ui' && path.startsWith('/v6/init-posts/')) {
        return { channels: {}, chat: {} };
      }
      // The remaining paths are incidental to the gate, but the ones whose
      // sync contexts set retry: true cost seconds of backoff if they throw,
      // so hand them an empty-but-valid response.
      if (app === 'contacts') {
        return {};
      }
      if (app === 'groups-ui' && path === '/suggested-contacts') {
        return [];
      }
      if (app === 'activity' && path.includes('/feed/init/')) {
        return { all: [], mentions: [], replies: [], summaries: {} };
      }
      return undefined;
    }) as unknown as typeof scry);
  };

  beforeAll(() => {
    // Skips the 1s spacer syncStart leaves for syncSince to queue.
    (globalThis as any).TLON_IS_E2E = true;
  });

  afterAll(() => {
    delete (globalThis as any).TLON_IS_E2E;
    updateSession(null);
    clearSyncStartLock();
  });

  beforeEach(() => {
    reportedDeskVersion = MIN_GROUPS_VERSION;
    probeError = null;
    pikesError = null;
    pikesHangs = false;
    heldProbe = null;
    scryCalls = [];
    updateSession(null);
    clearSyncStartLock();
    // Without a live client the lifetime token never changes, and the guards
    // that depend on it would go untested.
    logIn();
    vi.mocked(subscribe).mockClear();
    // The shared storage mock discards writes, so reads always come back as
    // the default: assert on the writes instead.
    setAppInfo = vi.spyOn(db.appInfo, 'setValue');
    setDidSyncInitialPosts = vi.spyOn(db.didSyncInitialPosts, 'setValue');
    setUserHasCompletedFirstSync = vi.spyOn(
      db.userHasCompletedFirstSync,
      'setValue'
    );
    installScryMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test(
    'gates startup when the ship reports an outdated desk',
    async () => {
      reportedDeskVersion = '12.1.0';

      await syncStart();

      expect(getSession()?.deskCompat).toEqual({
        status: 'incompatible',
        current: '12.1.0',
        minimum: MIN_GROUPS_VERSION,
        subscribed: false,
      });
      // Nothing an old desk would reject was attempted.
      expect(didScry('/v10/init')).toBe(false);
      expect(vi.mocked(subscribe)).not.toHaveBeenCalled();
      expect(setDidSyncInitialPosts).not.toHaveBeenCalled();
      expect(setUserHasCompletedFirstSync).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a failing pikes scry does not fail the gate open',
    async () => {
      // The pike is only diagnostics; the charge carries the version the gate
      // reads, so losing the pike must not discard a definitive verdict.
      reportedDeskVersion = '12.1.0';
      pikesError = new Error('pikes unavailable');

      await syncStart();

      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        current: '12.1.0',
      });
      expect(didScry('/v10/init')).toBe(false);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'gates on the charge even when the pike scry hangs',
    async () => {
      // The pike is bounded well inside the probe's own deadline, so a hung
      // one can't hold the version past the point where startup gives up and
      // fails open.
      reportedDeskVersion = '12.1.0';
      pikesHangs = true;
      vi.useFakeTimers();
      try {
        const started = syncStart();
        let finished = false;
        void started.then(() => {
          finished = true;
        });

        await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT / 2);

        expect(getSession()?.deskCompat).toMatchObject({
          status: 'incompatible',
          current: '12.1.0',
        });
        expect(finished).toBe(true);
        expect(didScry('/v10/init')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'leaves the fetched version driving the activity endpoints',
    async () => {
      // The shared storage mock discards writes, so give this case working
      // storage: what's under test is that the write lands before
      // syncReactionSupport re-derives the same flags from it.
      let persisted: Awaited<ReturnType<typeof db.appInfo.getValue>> = null;
      setAppInfo.mockImplementation(async (value) => {
        // Real storage settles on a later tick; an instant stub would hide
        // whether the write is actually awaited.
        await new Promise((resolve) => setTimeout(resolve, 0));
        persisted = value as typeof persisted;
      });
      vi.spyOn(db.appInfo, 'getValue').mockImplementation(
        async () => persisted
      );

      await syncStart();

      expect(persisted).toMatchObject({ groupsVersion: MIN_GROUPS_VERSION });
      // v5 is the pre-reaction feed: asking for it would mean the capability
      // flags had been re-derived from a value that wasn't written yet.
      expect(didScry('/v5/feed/init/')).toBe(false);
      expect(didScry('/v7/feed/init/')).toBe(true);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'gates on a version it could not persist',
    async () => {
      reportedDeskVersion = '12.1.0';
      setAppInfo.mockRejectedValue(new Error('storage unavailable'));

      await syncStart();

      // The write is best effort; the version it carried still decides.
      expect(setAppInfo).toHaveBeenCalled();
      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        current: '12.1.0',
      });
      expect(didScry('/v10/init')).toBe(false);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'has no verdict before the probe reports, and a clean one after',
    async () => {
      // 'undefined' is "not probed yet", which the shells must not read as
      // compatible: the overlay they mount talks to the desk immediately.
      expect(getSession()?.deskCompat).toBeUndefined();

      const release = holdProbe();
      const started = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(1));
      expect(getSession()?.deskCompat).toEqual({
        status: 'probing',
        current: null,
        minimum: MIN_GROUPS_VERSION,
        subscribed: false,
      });

      release();
      await started;

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry whose probe fails keeps the notice',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      const gated = getSession()?.deskCompat;

      probeError = new Error('network down');
      const onRecovered = vi.fn();
      await retryDeskCompatibility({ onRecovered });

      // Nothing was learned, so the version we did observe still stands —
      // failing open here would swap a useful notice for a broken app.
      expect(getSession()?.deskCompat).toEqual(gated);
      expect(didScry('/v10/init')).toBe(false);
      expect(onRecovered).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry whose probe times out keeps the notice',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      const gated = getSession()?.deskCompat;

      const release = holdProbe();
      vi.useFakeTimers();
      try {
        const onRecovered = vi.fn();
        const retrying = retryDeskCompatibility({ onRecovered });
        let finished = false;
        void retrying.then(() => {
          finished = true;
        });

        await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT + 1);
        for (let i = 0; i < 30 && !finished; i++) {
          await vi.advanceTimersByTimeAsync(1000);
        }
        expect(finished).toBe(true);

        expect(getSession()?.deskCompat).toEqual(gated);
        expect(didScry('/v10/init')).toBe(false);
        expect(onRecovered).not.toHaveBeenCalled();

        release();
        await vi.advanceTimersByTimeAsync(1000);
      } finally {
        vi.useRealTimers();
      }
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'probes with a bounded timeout and no retries',
    async () => {
      reportedDeskVersion = '12.1.0';

      await syncStart();

      const probeCalls = scryCalls.filter(
        ({ app }) => app === 'hood' || app === 'docket'
      );
      expect(probeCalls).toHaveLength(2);
      // The charge carries the version the gate reads, so it gets the whole
      // budget; the pike is diagnostics and gets a much shorter one, so it
      // can't hold the pair past the gate's own deadline.
      const charges = probeCalls.find(({ app }) => app === 'docket');
      const pikes = probeCalls.find(({ app }) => app === 'hood');
      expect(charges?.timeout).toBe(PROBE_TIMEOUT);
      expect(pikes?.timeout).toBeLessThan(PROBE_TIMEOUT);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'releases the sync lock, so a later start probes again',
    async () => {
      reportedDeskVersion = '12.1.0';

      await syncStart();
      expect(probeCount()).toBe(1);

      await syncStart();
      expect(probeCount()).toBe(2);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'concurrent cold starts share one probe',
    async () => {
      reportedDeskVersion = '12.1.0';

      await Promise.all([syncStart(), syncStart()]);

      expect(probeCount()).toBe(1);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'recovers in place once the ship is updated, without a reload',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      expect(getSession()?.deskCompat?.status).toBe('incompatible');

      reportedDeskVersion = MIN_GROUPS_VERSION;
      const onRecovered = vi.fn();
      await retryDeskCompatibility({ onRecovered });

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      expect(didScry('/v10/init')).toBe(true);
      expect(vi.mocked(subscribe)).toHaveBeenCalled();
      expect(getSession()?.phase).toBe('ready');
      // The shells' post-start work ran as a no-op while gated, so the retry has
      // to run it again.
      expect(onRecovered).toHaveBeenCalledTimes(1);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry that stays outdated keeps the notice and skips the follow-up',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      const onRecovered = vi.fn();
      await retryDeskCompatibility({ onRecovered });

      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        current: '12.1.0',
      });
      expect(onRecovered).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry blocked by a sync already in flight restores the notice',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      // Another sync start holds the lock, so the retry's own start bails before
      // it can re-probe. The notice has to come back rather than stay disabled.
      const release = holdProbe();
      const inFlight = syncStart();
      const onRecovered = vi.fn();
      await retryDeskCompatibility({ onRecovered });

      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        current: '12.1.0',
      });
      expect(onRecovered).not.toHaveBeenCalled();

      release();
      await inFlight;
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a gate during recovery retries as a recovery',
    async () => {
      reportedDeskVersion = '12.1.0';

      await syncStart(true);

      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        subscribed: true,
      });

      reportedDeskVersion = MIN_GROUPS_VERSION;
      await retryDeskCompatibility();

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      expect(didScry('/v10/init')).toBe(true);
      // alreadySubscribed was preserved, so the live subscriptions weren't
      // established on top of themselves.
      expect(vi.mocked(subscribe)).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry keeps the version it is showing while it re-probes',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      const release = holdProbe();
      const retrying = retryDeskCompatibility();
      await vi.waitFor(() =>
        expect(getSession()?.deskCompat?.status).toBe('probing')
      );

      // Not reset to a bare cold-start probe: the shell keeps the notice up
      // (its `current` is what tells it apart from a first-run probe).
      expect(getSession()?.deskCompat).toMatchObject({
        status: 'probing',
        current: '12.1.0',
        subscribed: false,
      });

      release();
      await retrying;
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'fails open when the probe itself fails',
    async () => {
      probeError = new Error('network down');

      await syncStart();

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      expect(didScry('/v10/init')).toBe(true);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'fails open when the ship reports no version at all',
    async () => {
      // A missing docket charge is reported as 'n/a' by getAppInfo.
      reportedDeskVersion = null;

      await syncStart();

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      expect(didScry('/v10/init')).toBe(true);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'gives up on a hanging probe and lets a late answer change nothing',
    async () => {
      const release = holdProbe();
      vi.useFakeTimers();
      try {
        const started = syncStart();
        let finished = false;
        void started.then(() => {
          finished = true;
        });

        // The per-scry timeout lives inside the client; this is the ceiling on
        // the whole probe, reauth round trips included.
        await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT + 1);
        expect(getSession()?.deskCompat).toEqual({ status: 'ok' });

        // Let the rest of a failed-open startup run to completion.
        for (let i = 0; i < 30 && !finished; i++) {
          await vi.advanceTimersByTimeAsync(1000);
        }
        expect(finished).toBe(true);
        expect(didScry('/v10/init')).toBe(true);
        expect(setAppInfo).not.toHaveBeenCalled();

        // The ship finally answers, with a version that would have gated. Too
        // late: startup already went ahead without it.
        reportedDeskVersion = '12.1.0';
        release();
        await vi.advanceTimersByTimeAsync(1000);

        expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
        expect(setAppInfo).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'releases the queue thread a hanging probe held, once it settles',
    async () => {
      const release = holdProbe();
      vi.useFakeTimers();
      try {
        const started = syncStart();
        let finished = false;
        void started.then(() => {
          finished = true;
        });

        await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT + 1);
        for (let i = 0; i < 30 && !finished; i++) {
          await vi.advanceTimersByTimeAsync(1000);
        }
        expect(finished).toBe(true);

        // Startup gave up on it, but the probe is still running inside the
        // queue: Promise.race doesn't cancel the loser, so it keeps its worker
        // thread until the request itself settles.
        expect(syncQueue.activeThreads).toBeGreaterThan(0);

        release();
        await vi.advanceTimersByTimeAsync(1000);

        // Settling is what hands the thread back — which is why every scry,
        // including the one a 403 retries, has to be bounded.
        expect(syncQueue.activeThreads).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'drops a probe answer that arrives after logout',
    async () => {
      reportedDeskVersion = '12.1.0';
      const release = holdProbe();
      const started = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(1));

      logOut();
      release();
      await started;

      // Not just "no gate": startup must not resurrect the session it was
      // running for, either.
      expect(getSession()).toBeNull();
      // Suppressed at the same point as the capability flags, inside
      // syncAppInfo.
      expect(setAppInfo).not.toHaveBeenCalled();
      // Startup stopped rather than syncing on behalf of a logged-out session.
      expect(didScry('/v10/init')).toBe(false);
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a probe answering after a re-login to the same ship changes nothing',
    async () => {
      reportedDeskVersion = '12.1.0';
      const releaseFirst = holdProbe();
      const first = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(1));

      // Same ship, same session shape — only the client's lifetime differs.
      logOut();
      logIn();
      const releaseSecond = holdProbe();
      const second = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(2));

      // The previous login's answer lands last, carrying a version that would
      // have gated this one.
      releaseFirst();
      await first;

      expect(setAppInfo).not.toHaveBeenCalled();
      expect(getSession()?.deskCompat).toEqual({
        status: 'probing',
        current: null,
        minimum: MIN_GROUPS_VERSION,
        subscribed: false,
      });

      // The live login's own probe is still the one that decides.
      reportedDeskVersion = MIN_GROUPS_VERSION;
      releaseSecond();
      await second;

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a probe answering after a switch to another ship changes nothing',
    async () => {
      reportedDeskVersion = '12.1.0';
      const releaseFirst = holdProbe();
      const first = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(1));

      logOut();
      logIn('~nibset-napwyn');
      const releaseSecond = holdProbe();
      const second = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(2));

      releaseFirst();
      await first;

      expect(setAppInfo).not.toHaveBeenCalled();
      expect(getSession()?.deskCompat).toEqual({
        status: 'probing',
        current: null,
        minimum: MIN_GROUPS_VERSION,
        subscribed: false,
      });

      reportedDeskVersion = MIN_GROUPS_VERSION;
      releaseSecond();
      await second;

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry interrupted by logout neither restores the notice nor prefetches',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      // The gated start above already persisted the version it read; only the
      // retry's own answer is under test here.
      setAppInfo.mockClear();
      const release = holdProbe();
      const onRecovered = vi.fn();
      const retrying = retryDeskCompatibility({ onRecovered });
      await vi.waitFor(() => expect(probeCount()).toBe(2));

      logOut();
      release();
      await retrying;

      // There is no notice to restore and no one to prefetch for.
      expect(getSession()).toBeNull();
      expect(onRecovered).not.toHaveBeenCalled();
      expect(setAppInfo).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry finishing after a new login leaves that login alone',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      setAppInfo.mockClear();
      const releaseRetry = holdProbe();
      const onRecovered = vi.fn();
      const retrying = retryDeskCompatibility({ onRecovered });
      await vi.waitFor(() => expect(probeCount()).toBe(2));

      // Logged out and back in while Retry was still waiting; the new login is
      // part-way through its own cold probe.
      logOut();
      logIn();
      const releaseNew = holdProbe();
      const newStart = syncStart();
      await vi.waitFor(() => expect(probeCount()).toBe(3));

      releaseRetry();
      await retrying;

      // The new login is still deciding for itself: the old retry must not
      // stamp its verdict, or its version, onto it.
      expect(getSession()?.deskCompat).toEqual({
        status: 'probing',
        current: null,
        minimum: MIN_GROUPS_VERSION,
        subscribed: false,
      });
      expect(onRecovered).not.toHaveBeenCalled();
      expect(setAppInfo).not.toHaveBeenCalled();

      // Nor may it hand the sync lock to a third start while the new login is
      // still using it.
      const probesBefore = probeCount();
      await syncStart();
      expect(probeCount()).toBe(probesBefore);

      reportedDeskVersion = MIN_GROUPS_VERSION;
      releaseNew();
      await newStart;

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a retry that fails after a clean verdict leaves the desk marked ok',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();

      reportedDeskVersion = MIN_GROUPS_VERSION;
      vi.spyOn(db, 'getEnqueuedPosts').mockRejectedValueOnce(
        new Error('db gone')
      );
      const onRecovered = vi.fn();

      await expect(retryDeskCompatibility({ onRecovered })).rejects.toThrow(
        'db gone'
      );

      // The desk turned out to be fine; the failure was somewhere else, so the
      // verdict stands and the notice must not come back and claim otherwise.
      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      expect(onRecovered).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'keeps the gate across a discontinuity',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart(true);

      const seen: (DeskCompatibility | undefined)[] = [];
      const unsubscribe = subscribeToSession((session) =>
        seen.push(session?.deskCompat)
      );
      await handleDiscontinuity({ context: 'test' });
      unsubscribe();

      // The notice must not blink off while the session is reset and re-probed.
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((deskCompat) => deskCompat != null)).toBe(true);
      expect(getSession()?.deskCompat?.status).toBe('incompatible');
      expect(setDidSyncInitialPosts).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'a cold-gated session recovers through a discontinuity as a cold start',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      expect(getSession()?.deskCompat).toMatchObject({
        status: 'incompatible',
        subscribed: false,
      });
      expect(vi.mocked(subscribe)).not.toHaveBeenCalled();

      reportedDeskVersion = MIN_GROUPS_VERSION;
      await handleDiscontinuity({ context: 'test' });

      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      // It never subscribed while gated, so recovery has to do it now.
      expect(vi.mocked(subscribe)).toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'recovers the initial-post prefetch a gate skipped',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      // The shells' post-start call already ran, as a no-op.
      expect(setDidSyncInitialPosts).not.toHaveBeenCalled();

      reportedDeskVersion = MIN_GROUPS_VERSION;
      await handleDiscontinuity({ context: 'test' });

      // Nothing re-invokes the shells here, so the recovery owes them the
      // prefetch they lost.
      expect(getSession()?.deskCompat).toEqual({ status: 'ok' });
      await vi.waitFor(() =>
        expect(setDidSyncInitialPosts).toHaveBeenCalledWith(true)
      );
    },
    FULL_SYNC_TIMEOUT
  );

  test(
    'syncInitialPosts is a no-op while gated',
    async () => {
      reportedDeskVersion = '12.1.0';
      await syncStart();
      const callsBefore = scryCalls.length;

      await syncInitialPosts({ syncSize: 'light' });

      expect(scryCalls.length).toBe(callsBefore);
      expect(setDidSyncInitialPosts).not.toHaveBeenCalled();
    },
    FULL_SYNC_TIMEOUT
  );
});
