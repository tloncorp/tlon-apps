import { v0PeersToClientProfiles } from '@tloncorp/api';
import { toClientGroupsV7 } from '@tloncorp/api';
import type * as ub from '@tloncorp/api/urbit/groups';
import { describe, expect, test } from 'vitest';

import * as schema from '../db/schema';
import { syncContacts, syncInitData } from '../store/sync';
import contactBookResponse from '../test/contactBook.json';
import contactsResponse from '../test/contacts.json';
import groupsResponse from '../test/groups.json';
import {
  getClient,
  setScryOutputs,
  setupDatabaseTestSuite,
} from '../test/helpers';
import initResponse from '../test/init.json';
import suggestedContactsResponse from '../test/suggestedContacts.json';
import * as queries from './queries';
import { Post } from './types';

const groupsData = toClientGroupsV7(
  groupsResponse as unknown as Record<string, ub.GroupV7>,
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
  expect(newestPosts[0].sequenceNum).toEqual(12);
  expect(newestPosts[6].sequenceNum).toEqual(6);
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
  expect(newestPosts[0].sequenceNum).toEqual(11);
  expect(newestPosts[9].sequenceNum).toEqual(2);
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
  expect(newestPosts[0].sequenceNum).toEqual(19);
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

test('getMentionCandidates: returns candidates in priority order', async () => {
  // Setup
  setScryOutputs([initResponse]);
  await syncInitData();
  setScryOutputs([
    contactsResponse,
    contactBookResponse,
    suggestedContactsResponse,
  ]);
  await syncContacts();

  // Get a group with members
  const chatId = '~nibset-napwyn/tlon';
  const query = 'no';

  await queries.addChatMembers({
    chatId,
    contactIds: ['~notestor'],
    joinStatus: 'joined',
    type: 'group',
  });

  // Test the mention candidates query
  const candidates = await queries.getMentionCandidates({ chatId, query });

  // Shouldn't contain duplicates
  expect(new Set(candidates.map((c) => c.id)).size).toBe(candidates.length);

  // Should return results matching the query
  expect(candidates.length).toBeGreaterThan(0);

  // Check that results contain the search term
  const hasMatchingResults = candidates.every(
    (candidate) =>
      candidate.id.toLowerCase().includes(query.toLowerCase()) ||
      candidate.nickname?.toLowerCase().includes(query.toLowerCase())
  );
  expect(hasMatchingResults).toBe(true);

  // Check priority ordering: group members (1) should come before others (2,3)
  let lastPriority = 0;
  for (const candidate of candidates) {
    expect(candidate.priority).toBeGreaterThanOrEqual(lastPriority);
    lastPriority = candidate.priority;
  }

  // Test empty query returns empty array
  const emptyResults = await queries.getMentionCandidates({
    chatId,
    query: '',
  });
  expect(emptyResults).toEqual([]);

  // Test whitespace-only query returns empty array
  const whitespaceResults = await queries.getMentionCandidates({
    chatId,
    query: '   ',
  });
  expect(whitespaceResults).toEqual([]);
});

test('getMentionCandidates: limits results to 6', async () => {
  // Setup
  setScryOutputs([initResponse]);
  await syncInitData();
  setScryOutputs([
    contactsResponse,
    contactBookResponse,
    suggestedContactsResponse,
  ]);
  await syncContacts();

  const chatId = '~nibset-napwyn/tlon';
  const query = 'a'; // Broad query that might match many results

  const candidates = await queries.getMentionCandidates({
    chatId,
    query,
    limit: 6,
  });

  // Should not return more than 6 results
  expect(candidates.length).toBeLessThanOrEqual(6);
});

test('insertPosts: removes cached posts when real posts arrive', async () => {
  const channelId = 'test-channel';
  const authorId = '~zod';
  const sentAt = Date.now();

  // Setup channel
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);

  // Insert a cached post (sequenceNum: 0 indicates cached/optimistic post)
  const cachedPost: Post = {
    id: 'cached-post-id',
    type: 'chat',
    channelId,
    authorId,
    sentAt,
    receivedAt: sentAt,
    sequenceNum: 0, // This marks it as a cached post
    content: JSON.stringify([{ inline: ['Cached message'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({ posts: [cachedPost] });

  // Verify cached post exists
  const postsBeforeReal = await queries.getChanPosts({ channelId });
  expect(postsBeforeReal.length).toBe(1);
  expect(postsBeforeReal[0].id).toBe('cached-post-id');
  expect(postsBeforeReal[0].sequenceNum).toBe(0);

  // Insert a real post from server with same channel, author, and sentAt
  const realPost: Post = {
    id: 'real-post-id',
    type: 'chat',
    channelId,
    authorId,
    sentAt, // Same sentAt as cached post
    receivedAt: sentAt,
    sequenceNum: 5, // Real sequence number from server
    content: JSON.stringify([{ inline: ['Real message'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({ posts: [realPost] });

  // Verify cached post is removed and only real post remains
  const postsAfterReal = await queries.getChanPosts({ channelId });
  expect(postsAfterReal.length).toBe(1);
  expect(postsAfterReal[0].id).toBe('real-post-id');
  expect(postsAfterReal[0].sequenceNum).toBe(5);
});

test('insertPosts: keeps cached posts when no matching real post arrives', async () => {
  const channelId = 'test-channel-2';
  const authorId = '~zod';

  // Setup channel
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);

  // Insert cached posts with different sentAt times
  const cachedPost1: Post = {
    id: 'cached-post-1',
    type: 'chat',
    channelId,
    authorId,
    sentAt: 1000,
    receivedAt: 1000,
    sequenceNum: 0,
    content: JSON.stringify([{ inline: ['Cached message 1'] }]),
    syncedAt: Date.now(),
  };

  const cachedPost2: Post = {
    id: 'cached-post-2',
    type: 'chat',
    channelId,
    authorId,
    sentAt: 2000,
    receivedAt: 2000,
    sequenceNum: 0,
    content: JSON.stringify([{ inline: ['Cached message 2'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({ posts: [cachedPost1, cachedPost2] });

  // Insert a real post that doesn't match either cached post
  const realPost: Post = {
    id: 'real-post-different',
    type: 'chat',
    channelId,
    authorId,
    sentAt: 3000, // Different sentAt
    receivedAt: 3000,
    sequenceNum: 10,
    content: JSON.stringify([{ inline: ['Real message'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({ posts: [realPost] });

  // Verify all posts remain (cached posts not removed since no match)
  const posts = await queries.getChanPosts({ channelId });
  expect(posts.length).toBe(3);

  const cachedPosts = posts.filter((p) => p.sequenceNum === 0);
  const realPosts = posts.filter((p) => p.sequenceNum !== 0);

  expect(cachedPosts.length).toBe(2);
  expect(realPosts.length).toBe(1);
  expect(realPosts[0].id).toBe('real-post-different');
});

test('insertPosts: removes only matching cached posts', async () => {
  const channelId = 'test-channel-3';
  const authorId = '~zod';
  const otherAuthorId = '~bus';
  const sentAt = 5000;

  // Setup channel
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);

  // Insert cached posts - one that will match, one that won't
  const cachedPostMatching: Post = {
    id: 'cached-matching',
    type: 'chat',
    channelId,
    authorId,
    sentAt,
    receivedAt: sentAt,
    sequenceNum: 0,
    content: JSON.stringify([{ inline: ['Cached matching'] }]),
    syncedAt: Date.now(),
  };

  const cachedPostNonMatching: Post = {
    id: 'cached-non-matching',
    type: 'chat',
    channelId,
    authorId: otherAuthorId, // Different author
    sentAt,
    receivedAt: sentAt,
    sequenceNum: 0,
    content: JSON.stringify([{ inline: ['Cached non-matching'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({
    posts: [cachedPostMatching, cachedPostNonMatching],
  });

  // Insert real post that matches only the first cached post
  const realPost: Post = {
    id: 'real-post-matching',
    type: 'chat',
    channelId,
    authorId, // Matches first cached post
    sentAt, // Matches first cached post
    receivedAt: sentAt,
    sequenceNum: 15,
    content: JSON.stringify([{ inline: ['Real matching'] }]),
    syncedAt: Date.now(),
  };

  await queries.insertChannelPosts({ posts: [realPost] });

  // Verify only the matching cached post was removed
  const posts = await queries.getChanPosts({ channelId });
  expect(posts.length).toBe(2);

  const cachedPosts = posts.filter((p) => p.sequenceNum === 0);
  const realPosts = posts.filter((p) => p.sequenceNum !== 0);

  expect(cachedPosts.length).toBe(1);
  expect(cachedPosts[0].id).toBe('cached-non-matching');
  expect(cachedPosts[0].authorId).toBe(otherAuthorId);

  expect(realPosts.length).toBe(1);
  expect(realPosts[0].id).toBe('real-post-matching');
});

test('setJoinedGroupChannels: does not reset membership for channels not in the list', async () => {
  // Setup: load init data which populates groups with channels
  setScryOutputs([initResponse]);
  await syncInitData();

  const groupId = '~nibset-napwyn/tlon';

  // Get all channels for the group (including unjoined) to see initial state
  const groupBefore = await queries.getGroup({
    id: groupId,
    includeUnjoinedChannels: true,
  });
  expect(groupBefore).not.toBeNull();

  // Find channels that are currently marked as joined
  const joinedChannels = groupBefore!.channels.filter(
    (c) => c.currentUserIsMember === true
  );
  expect(joinedChannels.length).toBeGreaterThan(1);

  // Simulate syncUnreads: call setJoinedGroupChannels with only ONE of the
  // joined channel IDs (as if only that channel had unreads)
  const channelWithUnreads = joinedChannels[0].id;
  const channelsWithoutUnreads = joinedChannels.slice(1).map((c) => c.id);

  await queries.setJoinedGroupChannels({
    channelIds: [channelWithUnreads],
  });

  // Verify: channels that were NOT in the unreads list should still be joined
  const groupAfter = await queries.getGroup({
    id: groupId,
    includeUnjoinedChannels: true,
  });

  // The channel that was in the unreads list should also still be joined
  const keptChannel = groupAfter!.channels.find(
    (c) => c.id === channelWithUnreads
  );
  expect(keptChannel?.currentUserIsMember).toBe(true);

  // Channels that were NOT in the unreads list should still be joined
  for (const channelId of channelsWithoutUnreads) {
    const channel = groupAfter!.channels.find((c) => c.id === channelId);
    expect(
      channel?.currentUserIsMember,
      `channel ${channelId} should still be joined`
    ).toBe(true);
  }
});

describe('undoOptimisticReplyBump', () => {
  const channelId = 'undo-reply-bump-channel';
  const parentId = 'undo-reply-bump-parent';

  async function seedParent(overrides: Partial<Post>) {
    await queries.insertChannelPosts({
      posts: [
        {
          id: parentId,
          type: 'chat',
          channelId,
          authorId: '~parent',
          sentAt: 1000,
          receivedAt: 1000,
          sequenceNum: 1,
          content: JSON.stringify([{ inline: ['parent'] }]),
          syncedAt: Date.now(),
          ...overrides,
        } as unknown as Post,
      ],
    });
  }

  async function seedReply(
    authorId: string,
    sentAt: number,
    overrides: Partial<Post> = {}
  ) {
    await queries.insertChannelPosts({
      posts: [
        {
          id: `${authorId}-${sentAt}`,
          type: 'reply',
          parentId,
          channelId,
          authorId,
          sentAt,
          receivedAt: sentAt,
          sequenceNum: 0,
          content: JSON.stringify([{ inline: [`reply at ${sentAt}`] }]),
          syncedAt: Date.now(),
          isDeleted: false,
          ...overrides,
        } as unknown as Post,
      ],
    });
  }

  test('complete local cache: A -> B -> A after deleting the last A recomputes to ["A", "B"] recency (most-recent last)', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedParent({
      replyCount: 3,
      replyTime: 1300,
      replyContactIds: ['~bravo', '~alfa'],
      optimisticReplyBumpCount: 1,
    });
    await seedReply('~alfa', 1100);
    await seedReply('~bravo', 1200);

    await queries.undoOptimisticReplyBump({ parentId });

    const parent = await queries.getPost({ postId: parentId });
    expect(parent!.replyCount).toBe(2);
    expect(parent!.replyTime).toBe(1200);
    expect(parent!.replyContactIds).toEqual(['~alfa', '~bravo']);
    expect(parent!.optimisticReplyBumpCount).toBe(0);
  });

  test('partial local cache: preserves server-sourced replyTime / replyContactIds, decrements replyCount', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    const serverContactIds = ['~remote-1', '~remote-2', '~remote-3'];
    await seedParent({
      replyCount: 8,
      replyTime: 9999,
      replyContactIds: serverContactIds,
      optimisticReplyBumpCount: 1,
    });

    await queries.undoOptimisticReplyBump({ parentId });

    const parent = await queries.getPost({ postId: parentId });
    expect(parent!.replyCount).toBe(7);
    expect(parent!.replyTime).toBe(9999);
    expect(parent!.replyContactIds).toEqual(serverContactIds);
    expect(parent!.optimisticReplyBumpCount).toBe(0);
  });

  test('partial local cache with alive local replies: still preserves server fields', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedParent({
      replyCount: 5,
      replyTime: 9999,
      replyContactIds: ['~remote-1', '~remote-2'],
      optimisticReplyBumpCount: 1,
    });
    await seedReply('~alfa', 1100);
    await seedReply('~bravo', 1200);

    await queries.undoOptimisticReplyBump({ parentId });

    const parent = await queries.getPost({ postId: parentId });
    expect(parent!.replyCount).toBe(4);
    expect(parent!.replyTime).toBe(9999);
    expect(parent!.replyContactIds).toEqual(['~remote-1', '~remote-2']);
    expect(parent!.optimisticReplyBumpCount).toBe(0);
  });

  test('replyCount never goes below 0', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedParent({ replyCount: 0, optimisticReplyBumpCount: 1 });

    await queries.undoOptimisticReplyBump({ parentId });

    const parent = await queries.getPost({ postId: parentId });
    expect(parent!.replyCount).toBe(0);
    expect(parent!.optimisticReplyBumpCount).toBe(0);
  });

  test('server-authoritative replyMeta override clears optimistic bump tracking, so undo is a no-op', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedParent({
      replyCount: 4,
      replyTime: 9999,
      replyContactIds: ['~remote-1', '~remote-2', '~remote-3'],
      optimisticReplyBumpCount: 0,
    });
    await seedReply('~alfa', 1100, { sequenceNum: 101 });
    await seedReply('~bravo', 1200, { sequenceNum: 102 });
    await seedReply('~charlie', 1300, { sequenceNum: 103 });

    await queries.undoOptimisticReplyBump({ parentId });

    const parent = await queries.getPost({ postId: parentId });
    expect(parent!.replyCount).toBe(4);
    expect(parent!.replyTime).toBe(9999);
    expect(parent!.replyContactIds).toEqual([
      '~remote-1',
      '~remote-2',
      '~remote-3',
    ]);
    expect(parent!.optimisticReplyBumpCount).toBe(0);
  });
});

describe('recomputeChannelLastPost', () => {
  const channelId = 'preview-test-channel';

  async function seedTopLevel(
    id: string,
    receivedAt: number,
    overrides: Partial<Post> = {}
  ) {
    await queries.insertChannelPosts({
      posts: [
        {
          id,
          type: 'chat',
          channelId,
          authorId: '~zod',
          sentAt: receivedAt,
          receivedAt,
          sequenceNum: receivedAt,
          content: JSON.stringify([{ inline: [`post ${receivedAt}`] }]),
          syncedAt: Date.now(),
          ...overrides,
        } as unknown as Post,
      ],
    });
  }

  test('repoints to the newest remaining non-deleted top-level post', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedTopLevel('post-old', 1000);
    await seedTopLevel('post-new', 2000);
    await queries.updateChannel({
      id: channelId,
      lastPostId: 'post-new',
      lastPostAt: 2000,
    });

    await queries.deletePost('post-new');
    await queries.recomputeChannelLastPost({ channelId });

    const channel = await queries.getChannel({ id: channelId });
    expect(channel!.lastPostId).toBe('post-old');
    expect(channel!.lastPostAt).toBe(1000);
  });

  test('clears lastPostId / lastPostAt when no previewable posts remain', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedTopLevel('only-post', 1500);
    await queries.updateChannel({
      id: channelId,
      lastPostId: 'only-post',
      lastPostAt: 1500,
    });

    await queries.deletePost('only-post');
    await queries.recomputeChannelLastPost({ channelId });

    const channel = await queries.getChannel({ id: channelId });
    expect(channel!.lastPostId).toBeNull();
    expect(channel!.lastPostAt).toBeNull();
  });

  test('skips deleted and reply rows when choosing the channel head', async () => {
    await queries.insertChannels([{ id: channelId, type: 'chat' }]);
    await seedTopLevel('top-old', 1000);
    await seedTopLevel('top-new-deleted', 2000, { isDeleted: true });
    await queries.insertChannelPosts({
      posts: [
        {
          id: 'reply-newest',
          type: 'reply',
          parentId: 'top-old',
          channelId,
          authorId: '~zod',
          sentAt: 3000,
          receivedAt: 3000,
          sequenceNum: 99,
          content: JSON.stringify([{ inline: ['reply'] }]),
          syncedAt: Date.now(),
        } as unknown as Post,
      ],
    });

    await queries.recomputeChannelLastPost({ channelId });

    const channel = await queries.getChannel({ id: channelId });
    expect(channel!.lastPostId).toBe('top-old');
    expect(channel!.lastPostAt).toBe(1000);
  });

  test('also repairs parent group lastPostId / lastPostAt when the channel belongs to a group', async () => {
    const groupId = '~zod/group-with-preview';
    await queries.insertGroups({
      groups: [
        {
          id: groupId,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
          lastPostId: 'to-be-replaced',
          lastPostAt: 2000,
        } as unknown as Parameters<
          typeof queries.insertGroups
        >[0]['groups'][number],
      ],
    });
    await queries.insertChannels([{ id: channelId, type: 'chat', groupId }]);
    await seedTopLevel('group-old', 1000);
    await seedTopLevel('group-new', 2000);
    await queries.updateChannel({
      id: channelId,
      lastPostId: 'group-new',
      lastPostAt: 2000,
    });

    await queries.deletePost('group-new');
    await queries.recomputeChannelLastPost({ channelId });

    const channel = await queries.getChannel({ id: channelId });
    expect(channel!.lastPostId).toBe('group-old');
    expect(channel!.lastPostAt).toBe(1000);

    const group = await queries.getGroup({ id: groupId });
    expect(group!.lastPostId).toBe('group-old');
    expect(group!.lastPostAt).toBe(1000);
  });

  test('clears parent group lastPostId / lastPostAt when no channel in the group has any previewable post', async () => {
    const groupId = '~zod/empty-group';
    await queries.insertGroups({
      groups: [
        {
          id: groupId,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
          lastPostId: 'stale',
          lastPostAt: 5000,
        } as unknown as Parameters<
          typeof queries.insertGroups
        >[0]['groups'][number],
      ],
    });
    await queries.insertChannels([{ id: channelId, type: 'chat', groupId }]);
    await seedTopLevel('only-post', 3000);
    await queries.updateChannel({
      id: channelId,
      lastPostId: 'only-post',
      lastPostAt: 3000,
    });

    await queries.deletePost('only-post');
    await queries.recomputeChannelLastPost({ channelId });

    const group = await queries.getGroup({ id: groupId });
    expect(group!.lastPostId).toBeNull();
    expect(group!.lastPostAt).toBeNull();
  });

  test('group-head recomputation skips sibling channels with lastPostId = null even when their stale lastPostAt is newest', async () => {
    const groupId = '~zod/group-sibling-repair';
    const validSiblingId = 'chat/~zod/group-sibling-valid';
    const nulledSiblingId = 'chat/~zod/group-sibling-nulled';
    await queries.insertGroups({
      groups: [
        {
          id: groupId,
          currentUserIsMember: true,
          currentUserIsHost: false,
          hostUserId: '~zod',
        } as unknown as Parameters<
          typeof queries.insertGroups
        >[0]['groups'][number],
      ],
    });
    await queries.insertChannels([
      { id: channelId, type: 'chat', groupId },
      { id: validSiblingId, type: 'chat', groupId },
      { id: nulledSiblingId, type: 'chat', groupId },
    ]);

    await seedTopLevel('channel-head', 1000);
    await queries.updateChannel({
      id: channelId,
      lastPostId: 'channel-head',
      lastPostAt: 1000,
    });
    await queries.insertChannelPosts({
      posts: [
        {
          id: 'valid-sibling-head',
          type: 'chat',
          channelId: validSiblingId,
          authorId: '~zod',
          sentAt: 2000,
          receivedAt: 2000,
          sequenceNum: 2,
          content: JSON.stringify([{ inline: ['still valid'] }]),
          syncedAt: Date.now(),
        } as unknown as Post,
      ],
    });
    await queries.updateChannel({
      id: validSiblingId,
      lastPostId: 'valid-sibling-head',
      lastPostAt: 2000,
    });
    await queries.updateChannel({
      id: nulledSiblingId,
      lastPostId: null,
      lastPostAt: 9999,
    });

    await queries.deletePost('channel-head');
    await queries.recomputeChannelLastPost({ channelId });

    const group = await queries.getGroup({ id: groupId });
    expect(group!.lastPostId).toBe('valid-sibling-head');
    expect(group!.lastPostAt).toBe(2000);
  });
});
