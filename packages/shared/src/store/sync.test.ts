import * as $ from 'drizzle-orm';
import { pick } from 'lodash';
import { expect, test, vi } from 'vitest';

import { StructuredChannelDescriptionPayload, toClientGroup } from '../api';
import '../api/channelContentConfig';
import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '../api/channelContentConfig';
import * as db from '../db';
import rawNewestPostData from '../test/channelNewestPost.json';
import rawChannelPostWithRepliesData from '../test/channelPostWithReplies.json';
import rawChannelPostsData from '../test/channelPosts.json';
import rawAfterNewestPostData from '../test/channelPostsAfterNewest.json';
import rawContactsData from '../test/contacts.json';
import rawGroupsData from '../test/groups.json';
import rawGroupsInitData from '../test/groupsInit.json';
import rawHeadsData from '../test/heads.json';
import {
  getClient,
  setScryOutput,
  setScryOutputs,
  setupDatabaseTestSuite,
} from '../test/helpers';
import rawGroupsInit2 from '../test/init.json';
import {
  CombinedHeads,
  GroupsInit,
  PagedPosts,
  PostDataResponse,
} from '../urbit';
import { Contact as UrbitContact } from '../urbit/contact';
import { Group as UrbitGroup } from '../urbit/groups';
import {
  syncContacts,
  syncDms,
  syncGroups,
  syncInitData,
  syncLatestPosts,
  syncPinnedItems,
  syncPosts,
  syncThreadPosts,
} from './sync';

const channelPostWithRepliesData =
  rawChannelPostWithRepliesData as unknown as PostDataResponse;
const contactsData = rawContactsData as unknown as Record<string, UrbitContact>;
const groupsData = rawGroupsData as unknown as Record<string, UrbitGroup>;
const groupsInitData = rawGroupsInitData as unknown as GroupsInit;
const groupsInitData2 = rawGroupsInit2 as unknown as GroupsInit;
const headsData = rawHeadsData as unknown as CombinedHeads;

setupDatabaseTestSuite();

const inputData = [
  '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  '~solfer-magfed',
  '~nibset-napwyn/tlon',
];

vi.mock('./lure', () => ({
  useLureState: {
    getState: () => ({
      start: () => ({}),
    }),
  },
}));

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

test('syncs pins', async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = (await db.getPinnedItems()).sort(
    (a, b) => a.index - b.index
  );
  expect(savedItems).toEqual(outputData);
});

test('syncs contacts', async () => {
  setScryOutput(contactsData);
  await syncContacts();
  const storedContacts = await db.getContacts();
  expect(storedContacts.length).toEqual(
    Object.values(contactsData).filter((n) => !!n).length
  );
  storedContacts.forEach((c) => {
    const original = contactsData[c.id];
    expect(original).toBeTruthy();
    expect(original.groups?.length ?? 0).toEqual(c.pinnedGroups.length);
  });
  setScryOutput(contactsData);
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
      members: db
        .buildChatMembers({
          chatId: '0v4.00000.qd4p2.it253.qs53q.s53qs',
          membershipType: 'channel',
        })
        .add(
          { contactId: '~finned-palmer', status: 'joined' },
          { contactId: '~latter-bolden', status: 'invited' },
          { contactId: '~nocsyx-lassul', status: 'joined' },
          { contactId: '~palfun-foslup', status: 'joined' },
          { contactId: '~pondus-watbel', status: 'joined' },
          { contactId: '~rilfun-lidlen', status: 'joined' },
          { contactId: '~solfer-magfed', status: 'joined' }
        )
        .build(),
    })
  );
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

test('sync posts', async () => {
  const channelId = 'chat/~solfer-magfed/test-channel';
  setScryOutputs([rawNewestPostData, rawAfterNewestPostData]);
  await syncPosts({
    channelId,
    count: 1,
    cursor: 'x',
    mode: 'older',
  });
  await syncPosts({
    channelId,
    count: 1,
    cursor: 'x',
    mode: 'older',
  });
  const posts = await db.getChannelPosts({
    channelId,
    count: 100,
    mode: 'newest',
  });
  expect(posts.length).toEqual(11);
});

test('deletes removed posts', async () => {
  await db.insertGroups({ groups: [testGroupData] });
  const insertedChannel = await db.getChannel({ id: channelId });
  expect(insertedChannel).toBeTruthy();
  const deletedPosts = Object.fromEntries(
    Object.entries(rawChannelPostsData.posts).map(([id, _post]) => [id, null])
  );
  const deleteResponse = { ...rawChannelPostsData, posts: deletedPosts };
  setScryOutput(deleteResponse as PagedPosts);
  await syncPosts({ channelId, mode: 'newest' });
  const posts = await db.getPosts();
  expect(posts.length).toEqual(0);
});

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
  const chatsWithLatestPosts = chats.filter((c) => c.lastPost);
  expect(chatsWithLatestPosts.length).toEqual(
    chats.length - NUM_EMPTY_TEST_GROUPS
  );
});

test('syncs thread posts', async () => {
  setScryOutput(channelPostWithRepliesData);
  await syncThreadPosts({
    postId: channelPostWithRepliesData.seal.id,
    authorId: channelPostWithRepliesData.essay.author,
    channelId,
  });
  const posts = await db.getPosts();
  expect(posts.length).toEqual(
    Object.keys(channelPostWithRepliesData.seal.replies).length + 1
  );
});

test('syncs groups, decoding structured description payloads', async () => {
  const groupId = '~fabled-faster/new-york';
  const groupWithScdp = pick(groupsData, groupId);
  const channelId = 'chat/~tormut-bolpub/nyc-housing-7361';
  const channel = groupWithScdp['~fabled-faster/new-york'].channels[channelId];
  const descriptionText = 'cheers';
  const channelContentConfiguration = {
    draftInput: DraftInputId.chat,
    defaultPostContentRenderer: PostContentRendererId.notebook,
    defaultPostCollectionRenderer: CollectionRendererId.gallery,
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
