import { expect, test } from 'vitest';

import { v0PeersToClientProfiles } from '../api';
import { toClientGroups } from '../api/groupsApi';
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
import type * as ub from '../urbit/groups';
import * as queries from './queries';
import { Post, PostWindow } from './types';

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

const windowA = {
  channelId: 'tst',
  oldestPostId: '010',
  newestPostId: '100',
  newer: '101',
  older: '009',
};

const windowB = {
  channelId: 'tst',
  oldestPostId: '200',
  newestPostId: '300',
  newer: '301',
  older: '199',
};

const windowImmediatelyBeforeA = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '009',
  newer: '010',
  older: undefined,
};

const windowBefore = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '005',
  newer: '006',
  older: undefined,
};

const windowIntersectingA = {
  channelId: 'tst',
  oldestPostId: '005',
  newestPostId: '050',
  newer: '051',
  older: '004',
};

const windowFillingGap = {
  channelId: 'tst',
  oldestPostId: '095',
  newestPostId: '205',
  newer: '206',
  older: '094',
};

const windowIntersectingB = {
  channelId: 'tst',
  oldestPostId: '250',
  newestPostId: '350',
  newer: '351',
  older: '249',
};

const windowCoveringAll = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '400',
  newer: '401',
  older: undefined,
};

const testCases: {
  label: string;
  window: PostWindow;
  expected: PostWindow[];
}[] = [
  {
    label: 'two identical windows',
    window: windowA,
    expected: [windowA, windowB],
  },
  {
    label: 'before A',
    window: windowBefore,
    expected: [windowBefore, windowA, windowB],
  },
  {
    label: 'contiguous with A',
    window: windowImmediatelyBeforeA,
    expected: [
      {
        channelId: 'tst',
        oldestPostId: windowImmediatelyBeforeA.oldestPostId,
        newestPostId: windowA.newestPostId,
      },
      windowB,
    ],
  },
  {
    label: 'intersecting A (before)',
    window: windowIntersectingA,
    expected: [
      {
        channelId: 'tst',
        oldestPostId: windowIntersectingA.oldestPostId,
        newestPostId: windowA.newestPostId,
      },
      windowB,
    ],
  },
  {
    label: 'fill gap between A and B',
    window: windowFillingGap,
    expected: [
      {
        channelId: 'tst',
        oldestPostId: windowA.oldestPostId,
        newestPostId: windowB.newestPostId,
      },
    ],
  },
  {
    label: 'intersecting B (after)',
    window: windowIntersectingB,
    expected: [
      windowA,
      {
        channelId: 'tst',
        oldestPostId: windowB.oldestPostId,
        newestPostId: windowIntersectingB.newestPostId,
      },
    ],
  },
  {
    label: 'covering all',
    window: windowCoveringAll,
    expected: [windowCoveringAll],
  },
];

let sentTime = Date.now();

function insertPostsForWindow(
  window: PostWindow & { older?: string; newer?: string }
) {
  console.log(`Inserting posts for window: ${JSON.stringify(window)}`);
  return queries.insertChannelPosts({
    channelId: window.channelId,
    older: window.older,
    newer: window.newer,
    posts: [
      {
        id: window.oldestPostId,
        type: 'chat',
        channelId: window.channelId,
        authorId: 'test',
        receivedAt: 0,
        sentAt: sentTime++,
        syncedAt: 0,
      },
      {
        id: window.newestPostId,
        type: 'chat',
        channelId: window.channelId,
        authorId: 'test',
        receivedAt: 0,
        sentAt: sentTime++,
        syncedAt: 0,
      },
    ],
  });
}

function getPostWindows({ channelId }: { channelId: string }) {
  return getClient()?.query.postWindows.findMany({
    where: (table, { eq }) =>
      channelId ? eq(schema.postWindows.channelId, channelId) : undefined,
    orderBy: (table, { asc }) => asc(schema.postWindows.oldestPostId),
  });
}

test.each(testCases)('insert window: $label', async ({ window, expected }) => {
  await setupWindows();
  await insertPostsForWindow(window);
  const windows = await getPostWindows({ channelId: window.channelId });
  expect(windows).toEqual(
    expected.map((w) => ({
      channelId: w.channelId,
      oldestPostId: w.oldestPostId,
      newestPostId: w.newestPostId,
    }))
  );
});

const filterTestCases = [
  {
    label: 'before first window',
    startPostId: '0005',
    count: 5,
    newer: [],
    older: [],
  },
  {
    label: 'within first window',
    startPostId: '0010',
    count: 5,
    newer: ['0015', '0014', '0013', '0012', '0011'],
    older: [],
  },
  {
    label: 'to exact end of first window',
    startPostId: '0014',
    count: 5,
    newer: ['0019', '0018', '0017', '0016', '0015'],
    older: ['0013', '0012', '0011', '0010'],
  },
  {
    label: 'past end of first window',
    startPostId: '0017',
    count: 5,
    newer: ['0019', '0018'],
    older: ['0016', '0015', '0014', '0013', '0012'],
  },
  {
    label: 'into second window',
    startPostId: '0021',
    count: 5,
    newer: [],
    older: [],
  },
  {
    label: 'within second window',
    startPostId: '0025',
    count: 5,
    newer: ['0030', '0029', '0028', '0027', '0026'],
    older: [],
  },
  {
    label: 'outside of any window',
    startPostId: '0040',
    count: 5,
    newer: [],
    older: [],
  },
  {
    label: 'before first window, into first window',
    startPostId: '0005',
    count: 5,
    newer: [],
    older: [],
  },
];

test.each(filterTestCases)('filter posts: $label', async (testCase) => {
  const channelId = 'tst';
  await queries.insertChannels([{ id: channelId, type: 'chat' }]);
  const firstRange = getRangedPosts(channelId, 10, 20);
  const secondRange = getRangedPosts(channelId, 25, 35);
  await queries.insertChannelPosts({
    channelId,
    posts: firstRange,
    newer: null,
    older: null,
  });
  await queries.insertChannelPosts({
    channelId,
    posts: secondRange,
    newer: null,
    older: null,
  });

  const newestPosts = await queries.getChannelPosts({
    channelId,
    count: 5,
    mode: 'newest',
  });
  expect(newestPosts.length).toEqual(5);

  const postsAround = await queries.getChannelPosts({
    channelId,
    count: 5,
    cursor: '0015',
    mode: 'around',
  });
  expect(postsAround.map((p) => p.id)).toEqual([
    '0017',
    '0016',
    '0015',
    '0014',
    '0013',
  ]);

  for (const mode of ['newer', 'older'] as const) {
    const posts = await queries.getChannelPosts({
      channelId,
      count: testCase.count,
      cursor: testCase.startPostId,
      mode,
    });
    expect(
      posts.map((p) => p.id),
      mode
    ).toEqual(testCase[mode]);
  }
});

async function setupWindows() {
  await Promise.all([
    queries.insertChannels([{ id: 'tst', type: 'chat' }]),
    insertPostsForWindow(windowA),
    insertPostsForWindow(windowB),
  ]);
}

function getRangedPosts(channelId: string, start: number, end: number): Post[] {
  const posts: Post[] = [];
  for (let i = start; i < end; i++) {
    posts.push({
      id: i.toString().padStart(4, '0'),
      type: 'chat',
      channelId,
      receivedAt: refDate + i,
      sentAt: refDate + i,
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

  // Test the mention candidates query
  const candidates = await queries.getMentionCandidates({ chatId, query });
  console.log('candidates', candidates);

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

  const candidates = await queries.getMentionCandidates({ chatId, query });

  console.log('candidates', candidates);

  // Should not return more than 6 results
  expect(candidates.length).toBeLessThanOrEqual(6);
});
