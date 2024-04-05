import { beforeAll, beforeEach, expect, test } from 'vitest';

import { toClientGroups } from '../api/groupsApi';
import groupsResponse from '../test/groups.json';
import { resetDb, setupDb } from '../test/helpers';
import type * as ub from '../urbit/groups';
import type * as db from './index';
import * as queries from './queries';

const emptyUnread: db.Unread = {
  channelId: '',
  type: 'channel',
  totalCount: 1,
  updatedAt: new Date().getSeconds(),
};

const groupsResponseData = groupsResponse as unknown as Record<
  string,
  ub.Group
>;

const unreadsData: db.Unread[] = Object.values(groupsResponseData)
  .map((group) => {
    const unreads = group.channels
      ? Object.keys(group.channels).map((channelId) => {
          return {
            ...emptyUnread,
            channelId: channelId,
          };
        })
      : [];
    return unreads;
  })
  .flat();

const groupsData = toClientGroups(
  groupsResponse as unknown as Record<string, ub.Group>,
  unreadsData,
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
  const roles = await queries.getGroupRoles(groupData.id);
  expect(roles.length).toEqual(groupData.roles?.length);
  const result = await queries.getGroup(groupData.id);
  expect(result?.id).toBe(groupData.id);
  await queries.insertGroups([groupData]);
});

test('inserts all groups', async () => {
  await queries.insertGroups(groupsData);
  const groups = await queries.getGroups();
  expect(groups.length).toEqual(groupsData.length);
});
