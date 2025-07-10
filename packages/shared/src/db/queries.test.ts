import { expect, test } from 'vitest';

import { v0PeersToClientProfiles } from '../api';
import { toClientGroups } from '../api/groupsApi';
import * as schema from '../db/schema';
import { syncInitData } from '../store/sync';
import contactsResponse from '../test/contacts.json';
import groupsResponse from '../test/groups.json';
import {
  getClient,
  setScryOutputs,
  setupDatabaseTestSuite,
} from '../test/helpers';
import initResponse from '../test/init.json';
import type * as ub from '../urbit/groups';
import * as queries from './queries';
import { Post } from './types';

const groupsData = toClientGroups(
  groupsResponse as unknown as Record<string, ub.Group>,
  true
);

setupDatabaseTestSuite();

test('inserts a group', async () => {
  const groupData = groupsData[3];
  await queries.insertGroups({ groups: [groupData] });
  const roles = await queries.getAllGroupRoles();
  expect(roles.length).toEqual(groupData.roles?.length);
  const result = await queries.getGroup({ id: groupData.id });
  expect(result?.id).toBe(groupData.id);
  await queries.insertGroups({ groups: [groupData] });
});

test('inserts all groups', async () => {
  await queries.insertGroups({ groups: groupsData });
  const groups = await queries.getGroups({});
  expect(groups.length).toEqual(groupsData.length);
});

test('uses init data to get chat list', async () => {
  setScryOutputs([initResponse]);
  await syncInitData();

  const result = await queries.getChats();

  expect(result.pinned.map((r) => r.id)).toEqual([
    '0v4.00000.qd6oi.a3f6t.5sd9v.fjmp2',
  ]);

  const ids = result.unpinned.map((r) => r.id).slice(0, 7);
  expect(ids).toEqual([
    'chat/~nibset-napwyn/commons',
    '~nibset-napwyn/tlon',
    '~nocsyx-lassul',
    'chat/~pondus-watbel/new-channel',
    '~pondus-watbel/testing-facility',
    'chat/~nibset-napwyn/intros',
    '~ravseg-nosduc',
  ]);

  expect(result.pending.map((r) => r.id)).toEqual([
    '~fabled-faster/new-york',
    '~barmyl-sigted/network-being',
    '~salfer-biswed/gamers',
  ]);
});

test('update channel: new writer roles with existing writer roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();

  const channelId = 'diary/~nibset-napwyn/getting-started';
  const existingChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });

  expect(existingChannel?.writerRoles.map((r) => r.roleId)).toEqual(['admin']);
  await queries.updateChannel({
    id: channelId,
    writerRoles: [
      {
        channelId,
        roleId: 'admin',
      },
      { channelId, roleId: 'writer' },
    ],
    readerRoles: [],
  });

  const updatedChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });
  expect(updatedChannel?.writerRoles.map((r) => r.roleId)).toEqual([
    'admin',
    'writer',
  ]);
});

test('update channel: new writer roles with no existing writer roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();

  const channelId = 'chat/~nibset-napwyn/intros';
  const existingChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });

  expect(existingChannel?.writerRoles).toEqual([]);
  await queries.updateChannel({
    id: channelId,
    writerRoles: [{ channelId, roleId: 'writer' }],
    readerRoles: [],
  });

  const updatedChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });
  expect(updatedChannel?.writerRoles.map((r) => r.roleId)).toEqual(['writer']);
});

test('update channel: cleared out writer roles with existing roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();
  const channelId = 'diary/~nibset-napwyn/getting-started';
  const existingChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });
  expect(existingChannel?.writerRoles.map((r) => r.roleId)).toEqual(['admin']);
  await queries.updateChannel({
    id: channelId,
    writerRoles: [],
    readerRoles: [],
  });
  const updatedChannel = await queries.getChannel({
    id: channelId,
    includeWriters: true,
  });
  expect(updatedChannel?.writerRoles).toEqual([]);
});

test('update channel: new reader roles with existing reader roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();
  const channelId = 'heap/~nibset-napwyn/bulletin-board-53';
  const group = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });

  if (!group) {
    throw new Error('Group not found');
  }
  console.log(
    'group channels',
    group.channels.map((c) => c.id)
  );
  const existingChannel = group.channels.find((c) => c.id === channelId);
  if (!existingChannel) {
    throw new Error('Channel not found');
  }
  expect(existingChannel.readerRoles.map((r) => r.roleId)).toEqual(['admin']);

  await queries.updateChannel({
    id: channelId,
    readerRoles: [
      {
        channelId,
        roleId: 'admin',
      },
      { channelId, roleId: 'reader' },
    ],
    writerRoles: [],
  });

  const updatedGroup = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });
  if (!updatedGroup) {
    throw new Error('Group not found after update');
  }
  const updatedChannel = updatedGroup.channels.find((c) => c.id === channelId);
  if (!updatedChannel) {
    throw new Error('Channel not found after update');
  }
  expect(updatedChannel.readerRoles.map((r) => r.roleId)).toEqual([
    'admin',
    'reader',
  ]);
});

test('update channel: new reader roles with no existing reader roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();
  const channelId = 'chat/~nibset-napwyn/intros';
  const group = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });
  if (!group) {
    throw new Error('Group not found');
  }
  const existingChannel = group.channels.find((c) => c.id === channelId);
  if (!existingChannel) {
    throw new Error('Channel not found');
  }
  expect(existingChannel.readerRoles).toEqual([]);
  await queries.updateChannel({
    id: channelId,
    readerRoles: [{ channelId, roleId: 'reader' }],
    writerRoles: [],
  });
  const updatedGroup = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });
  if (!updatedGroup) {
    throw new Error('Group not found after update');
  }
  const updatedChannel = updatedGroup.channels.find((c) => c.id === channelId);
  if (!updatedChannel) {
    throw new Error('Channel not found after update');
  }
  expect(updatedChannel.readerRoles.map((r) => r.roleId)).toEqual(['reader']);
});

test('update channel: cleared out reader roles with existing roles', async () => {
  //setup
  setScryOutputs([initResponse]);
  await syncInitData();
  const channelId = 'heap/~nibset-napwyn/bulletin-board-53';
  const group = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });
  if (!group) {
    throw new Error('Group not found');
  }
  const existingChannel = group.channels.find((c) => c.id === channelId);
  if (!existingChannel) {
    throw new Error('Channel not found');
  }
  expect(existingChannel.readerRoles.map((r) => r.roleId)).toEqual(['admin']);
  await queries.updateChannel({
    id: channelId,
    readerRoles: [],
    writerRoles: [],
  });
  const updatedGroup = await queries.getGroup({
    id: '~nibset-napwyn/tlon',
    includeUnjoinedChannels: true,
  });
  if (!updatedGroup) {
    throw new Error('Group not found after update');
  }
  const updatedChannel = updatedGroup.channels.find((c) => c.id === channelId);
  if (!updatedChannel) {
    throw new Error('Channel not found after update');
  }
  expect(updatedChannel.readerRoles).toEqual([]);
});

test('inserts contacts without overriding block data', async () => {
  // setup
  setScryOutputs([initResponse]);
  await syncInitData();

  const blocks = [
    '~nocsyx-lassul',
    '~ravmel-ropdyl',
    '~fonrym-radfur-nocsyx-lassul',
  ];
  const blockedUsers = await queries.getBlockedUsers();
  expect(blockedUsers.map((b) => b.id)).toEqual(blocks);

  const contacts = v0PeersToClientProfiles(contactsResponse);
  // nocsyx and ravmel are in contacts, but blocked
  expect(
    contacts.filter(
      (c) => c.id === '~nocsyx-lassul' || c.id === '~ravmel-ropdyl'
    )
  ).toBeTruthy();
  // fonrym is blocked, but not in contacts
  expect(
    contacts.find((c) => c.id === '~fonrym-radfur-nocsyx-lassul')
  ).toBeFalsy();
  // insert contacts
  await queries.insertContacts(contacts);
  const newBlockedUsers = await queries.getBlockedUsers();
  expect(newBlockedUsers.map((b) => b.id)).toEqual(blocks);
});

const refDate = Date.now();

test('sequenced posts: gets newest posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 10, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'newest',
    channelId,
    count: 5,
  });
  expect(newestPosts.length).toEqual(5);
  expect(newestPosts[0].sequenceNum).toEqual(19);
  expect(newestPosts[4].sequenceNum).toEqual(15);
});

test('sequenced posts: gets newer posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 1, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'newer',
    channelId,
    cursorSequenceNum: 5,
    count: 7,
  });
  expect(newestPosts.length).toEqual(7);
  expect(newestPosts[0].sequenceNum).toEqual(6);
  expect(newestPosts[6].sequenceNum).toEqual(12);
});

test('sequenced posts: gets older posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 1, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'older',
    channelId,
    cursorSequenceNum: 12,
    count: 10,
  });
  expect(newestPosts.length).toEqual(10);
  expect(newestPosts[0].sequenceNum).toEqual(2);
  expect(newestPosts[9].sequenceNum).toEqual(11);
});

test('sequenced posts: gets older posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 1, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'around',
    channelId,
    cursorSequenceNum: 8,
    count: 10,
  });
  expect(newestPosts.length).toEqual(10);
  expect(newestPosts[0].sequenceNum).toEqual(13);
  expect(newestPosts[9].sequenceNum).toEqual(4);
});

test('sequenced posts: does not find newer out of bounds posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 1, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'newer',
    channelId,
    cursorSequenceNum: 28,
    count: 10,
  });
  expect(newestPosts.length).toEqual(0);
});

test('sequenced posts: does not find older out of bounds posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 10, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'older',
    channelId,
    cursorSequenceNum: 5,
    count: 10,
  });
  expect(newestPosts.length).toEqual(0);
});

test('sequenced posts: does not find out of bounds around posts', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const window1 = getRangedPosts(channelId, 1, 10);
  const window2 = getRangedPosts(channelId, 20, 30);
  await queries.insertChannelPosts({ posts: [...window1, ...window2] });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'around',
    channelId,
    cursorSequenceNum: 15,
    count: 10,
  });
  expect(newestPosts.length).toEqual(0);
});

test('sequenced posts: respects contiguous boundary in newer mode', async () => {
  const channelId = 'test';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const posts = getRangedPosts(channelId, 1, 20);
  await queries.insertChannelPosts({ posts });
  const newestPosts = await queries.getSequencedChannelPosts({
    mode: 'newer',
    channelId,
    cursorSequenceNum: 15,
    count: 10,
  });
  expect(newestPosts.length).toEqual(4);
  expect(newestPosts[3].sequenceNum).toEqual(19);
});

function getRangedPosts(channelId: string, start: number, end: number): Post[] {
  const posts: Post[] = [];
  for (let i = start; i < end; i++) {
    posts.push({
      id: i.toString().padStart(4, '0'),
      type: 'chat',
      channelId,
      receivedAt: refDate + i,
      sentAt: refDate + i,
      sequenceNum: i,
      authorId: 'test',
      syncedAt: 0,
    });
  }
  return posts;
}
