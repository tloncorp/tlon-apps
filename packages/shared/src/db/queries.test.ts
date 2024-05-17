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
  await syncDms('~solfer-magfed');
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
