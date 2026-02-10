import { beforeAll, describe, expect, test } from 'vitest';

import { toInitData } from '../client/initApi';
import { configureClient } from '../client/urbit';
import rawGroupsInit6 from './fixtures/groupsInit5.json';
import type * as ub from '../urbit';

const groupsInit6 = rawGroupsInit6 as unknown as ub.GroupsInit6;

describe('toInitData contract', () => {
  beforeAll(() => {
    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });
  });

  test('returns fully shaped init data', () => {
    const result = toInitData(groupsInit6);

    expect(result).toBeDefined();
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.unjoinedGroups.length).toBeGreaterThan(0);
    expect(result.channelPerms.length).toBeGreaterThan(0);
    expect(Array.isArray(result.hiddenPostIds)).toBe(true);
    expect(Array.isArray(result.blockedUsers)).toBe(true);
  });

  test('maps member and non-member groups as expected', () => {
    const result = toInitData(groupsInit6);

    expect(result.groups[0]).toHaveProperty('currentUserIsMember', true);
    expect(result.unjoinedGroups[0]).toHaveProperty('currentUserIsMember', false);
    expect(result.unjoinedGroups[0]).toHaveProperty('haveInvite', true);
  });
});
