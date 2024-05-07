import { beforeAll, beforeEach, expect, test } from 'vitest';

import { toClientGroups } from '../api/groupsApi';
import {
  syncContacts,
  syncDms,
  syncGroups,
  syncPinnedItems,
  syncUnreads,
} from '../store/sync';
import channelUnreadsResponse from '../test/channelUnreads.json';
import clubsResponse from '../test/clubs.json';
import contactsResponse from '../test/contacts.json';
import dmUnreadsResponse from '../test/dmUnreads.json';
import dmsResponse from '../test/dms.json';
import groupsResponse from '../test/groups.json';
import { resetDb, setScryOutputs, setupDb } from '../test/helpers';
import pinsResponse from '../test/pins.json';
import type * as ub from '../urbit/groups';
import * as queries from './queries';
import { Post, PostWindow } from './types';

const groupsData = toClientGroups(
  groupsResponse as unknown as Record<string, ub.Group>,
  true
);

beforeAll(() => {
  setupDb();
});

beforeEach(async () => {
  resetDb();
});

test('inserts a group', async () => {
  const groupData = groupsData[3];
  await queries.insertGroups([groupData]);
  const roles = await queries.getGroupRoles();
  expect(roles.length).toEqual(groupData.roles?.length);
  const result = await queries.getGroup({ id: groupData.id });
  expect(result?.id).toBe(groupData.id);
  await queries.insertGroups([groupData]);
});

test('inserts all groups', async () => {
  await queries.insertGroups(groupsData);
  const groups = await queries.getGroups({});
  expect(groups.length).toEqual(groupsData.length);
});

test('gets chat list', async () => {
  setScryOutputs([
    groupsResponse,
    dmsResponse,
    clubsResponse,
    pinsResponse,
    contactsResponse,
    channelUnreadsResponse,
    dmUnreadsResponse,
  ]);

  await syncGroups();
  await syncDms();
  await syncPinnedItems();
  await syncContacts();
  await syncUnreads();

  const result = await queries.getChats();
  expect(result.map((r) => r.id).slice(0, 8)).toEqual([
    'heap/~dabben-larbet/interface-1720',
    'chat/~solfer-magfed/another',
    'diary/~nocsyx-lassul/feedback-and-questions-2368',
    '0v4.00000.qd4mk.d4htu.er4b8.eao21',
    '~finned-palmer',
    'chat/~dopzod/urbit-help',
    'chat/~hiddev-dannut/hooniverse-chat--ask---learn-881',
    '~rilfun-lidlen',
  ]);
});

const refDate = Date.now();

const windowA = {
  channelId: 'tst',
  oldestPostId: '010',
  newestPostId: '100',
  newerCursor: '101',
  olderCursor: '009',
};

const windowB = {
  channelId: 'tst',
  oldestPostId: '200',
  newestPostId: '300',
  newerCursor: '301',
  olderCursor: '199',
};

const windowImmediatelyBeforeA = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '009',
  newerCursor: '010',
  olderCursor: undefined,
};

const windowBefore = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '005',
  newerCursor: '006',
  olderCursor: undefined,
};

const windowIntersectingA = {
  channelId: 'tst',
  oldestPostId: '005',
  newestPostId: '050',
  newerCursor: '051',
  olderCursor: '004',
};

const windowFillingGap = {
  channelId: 'tst',
  oldestPostId: '095',
  newestPostId: '205',
  newerCursor: '206',
  olderCursor: '094',
};

const windowIntersectingB = {
  channelId: 'tst',
  oldestPostId: '250',
  newestPostId: '350',
  newerCursor: '351',
  olderCursor: '249',
};

const windowCoveringAll = {
  channelId: 'tst',
  oldestPostId: '000',
  newestPostId: '400',
  newerCursor: '401',
  olderCursor: undefined,
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

function insertPostsForWindow(
  window: PostWindow & { olderCursor?: string; newerCursor?: string }
) {
  return queries.insertChannelPosts({
    channelId: window.channelId,
    olderCursor: window.olderCursor,
    newerCursor: window.newerCursor,
    posts: [
      {
        id: window.oldestPostId,
        type: 'chat',
        channelId: window.channelId,
        authorId: 'test',
        receivedAt: 0,
        sentAt: 0,
      },
      {
        id: window.newestPostId,
        type: 'chat',
        channelId: window.channelId,
        authorId: 'test',
        receivedAt: 0,
        sentAt: 0,
      },
    ],
  });
}

test.each(testCases)('insert window: $label', async ({ window, expected }) => {
  await setupWindows();
  await insertPostsForWindow(window);
  const windows = await queries.getPostWindows({ orderBy: 'windowStart' });
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
    newer: 0,
    older: 0,
  },
  {
    label: 'within first window',
    startPostId: '0010',
    count: 5,
    newer: 5,
    older: 0,
  },
  {
    label: 'to exact end of first window',
    startPostId: '0014',
    count: 5,
    newer: 5,
    older: 4,
  },
  {
    label: 'past end of first window',
    startPostId: '0017',
    count: 5,
    newer: 2,
    older: 5,
  },
  {
    label: 'into second window',
    startPostId: '0021',
    count: 5,
    newer: 0,
    older: 0,
  },
  {
    label: 'within second window',
    startPostId: '0025',
    count: 5,
    newer: 5,
    older: 0,
  },
  {
    label: 'outside of any window',
    startPostId: '0040',
    count: 5,
    newer: 0,
    older: 0,
  },
  {
    label: 'before first window, into first window',
    startPostId: '0005',
    count: 5,
    newer: 0,
    older: 0,
  },
];

test.each(filterTestCases)('filter posts: $label', async (testCase) => {
  const channelId = 'tst';
  const firstRange = getRangedPosts(channelId, 10, 20);
  const secondRange = getRangedPosts(channelId, 25, 35);
  await queries.insertChannelPosts({
    channelId,
    posts: firstRange,
    newerCursor: null,
    olderCursor: null,
  });
  await queries.insertChannelPosts({
    channelId,
    posts: secondRange,
    newerCursor: null,
    olderCursor: null,
  });

  const newestPosts = await queries.getChannelPosts({
    channelId,
    count: 5,
    mode: 'newest',
  });
  expect(newestPosts.length).toEqual(5);

  for (const mode of ['newer', 'older'] as const) {
    const posts = await queries.getChannelPosts({
      channelId,
      count: testCase.count,
      cursor: testCase.startPostId,
      mode,
    });
    expect(posts.length).toEqual(testCase[mode]);
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
    });
  }
  return posts;
}
