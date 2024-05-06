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

const windowA = {
  channelId: 'tst',
  oldestPostAt: 10,
  newestPostAt: 100,
};

const windowB = {
  channelId: 'tst',
  oldestPostAt: 200,
  newestPostAt: 300,
};

const windowBefore = {
  channelId: 'tst',
  oldestPostAt: 0,
  newestPostAt: 5,
};

const windowIntersectingA = {
  channelId: 'tst',
  oldestPostAt: 5,
  newestPostAt: 50,
};

const windowFillingGap = {
  channelId: 'tst',
  oldestPostAt: 95,
  newestPostAt: 205,
};

const windowIntersectingB = {
  channelId: 'tst',
  oldestPostAt: 250,
  newestPostAt: 350,
};

const windowCoveringAll = {
  channelId: 'tst',
  oldestPostAt: 0,
  newestPostAt: 400,
};

const testCases = [
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
    label: 'intersecting A (before)',
    window: windowIntersectingA,
    expected: [
      {
        channelId: 'tst',
        oldestPostAt: windowIntersectingA.oldestPostAt,
        newestPostAt: windowA.newestPostAt,
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
        oldestPostAt: windowA.oldestPostAt,
        newestPostAt: windowB.newestPostAt,
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
        oldestPostAt: windowB.oldestPostAt,
        newestPostAt: windowIntersectingB.newestPostAt,
      },
    ],
  },
  {
    label: 'covering all',
    window: windowCoveringAll,
    expected: [windowCoveringAll],
  },
];

test.each(testCases)('insert window: $label', async ({ window, expected }) => {
  await setupWindows();
  await queries.insertPostWindow(window);
  const windows = await queries.getPostWindows({ orderBy: 'windowStart' });
  expect(windows).toEqual(expected);
});

async function setupWindows() {
  await Promise.all([
    queries.insertChannels([{ id: 'tst', type: 'chat' }]),
    queries.insertPostWindow(windowA),
    queries.insertPostWindow(windowB),
  ]);
}
