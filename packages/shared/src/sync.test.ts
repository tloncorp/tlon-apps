import {
  MockedFunction,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { toClientGroup, toPagedPostsData } from './api';
import { scry } from './api/urbit';
import * as db from './db';
import { syncChannel, syncContacts, syncGroups, syncPinnedItems } from './sync';
import rawChannelPostsData from './test/channelPosts.json';
import rawContactsData from './test/contacts.json';
import rawGroupsData from './test/groups.json';
import { resetDb, setupDb } from './test/helpers';
import { PagedPosts } from './urbit';
import { Contact as UrbitContact } from './urbit/contact';
import { Group as UrbitGroup } from './urbit/groups';

const contactsData = rawContactsData as unknown as Record<string, UrbitContact>;
const groupsData = rawGroupsData as unknown as Record<string, UrbitGroup>;

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

const inputData = [
  '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  '~solfer-magfed',
  '~nibset-napwyn/tlon',
];

const outputData = [
  {
    type: 'club',
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

vi.mock('./api/urbit', async () => {
  return {
    scry: vi.fn(),
  };
});

function setScryOutput<T>(output: T) {
  (scry as MockedFunction<() => Promise<T>>).mockImplementationOnce(
    async () => output
  );
}

test('syncs pins', async () => {
  setScryOutput(inputData);
  await syncPinnedItems();
  const savedItems = await db.getPinnedItems({
    orderBy: 'type',
    direction: 'asc',
  });
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
  const storedGroups = await db.getGroups({ sort: 'pinIndex' });
  expect(storedGroups.length).toEqual(Object.values(groupsData).length);
  expect(storedGroups[0].pinIndex).toEqual(0);
  expect(storedGroups[1].pinIndex).toEqual(1);
  expect(storedGroups[2].pinIndex).toEqual(2);
});

test('sync posts', async () => {
  const groupId = 'test-group';
  const channelId = 'test-channel';
  const groupData = toClientGroup(
    groupId,
    Object.values(rawGroupsData)[0] as unknown as UrbitGroup,
    true
  );
  const unreadTime = 1712091148002;
  groupData.channels = [{ id: channelId, groupId }];
  await db.insertGroups([groupData]);
  console.log('inserted group');
  const insertedChannel = await db.getChannel(channelId);
  expect(insertedChannel).toBeTruthy();

  setScryOutput(rawChannelPostsData);
  await syncChannel(channelId, unreadTime);

  const convertedPosts = toPagedPostsData(
    channelId,
    rawChannelPostsData as unknown as PagedPosts
  );
  const lastPost = convertedPosts.posts[convertedPosts.posts.length - 1]!;
  const channel = await db.getChannel(channelId);
  expect(channel?.remoteUpdatedAt).toEqual(unreadTime);
  expect(channel?.lastPostAt).toEqual(lastPost.receivedAt);
  expect(channel?.lastPostId).toEqual(lastPost.id);

  const posts = await db.getPosts();
  expect(posts.length).toEqual(convertedPosts.posts.length);

  const groups = await db.getGroups();
  expect(groups[0].id).toEqual(groupId);
  expect(groups[0].lastPostAt).toEqual(lastPost.receivedAt);
  expect(groups[0].lastPostId).toEqual(lastPost.id);
  expect(groups[0].lastPost?.id).toEqual(groups[0].lastPostId);
  expect(groups[0].lastPost?.textContent).toEqual(lastPost.textContent);
});
