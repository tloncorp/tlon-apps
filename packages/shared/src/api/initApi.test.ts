import { describe, expect, test } from 'vitest';

import rawGroupsInit6 from '../test/groupsInit5.json';
import type * as ub from '../urbit';
import { toInitData } from './initApi';

const groupsInit6 = rawGroupsInit6 as unknown as ub.GroupsInit6;

describe('toInitData', () => {
  describe('v6 format support', () => {
    test('processes v6 init with foreigns', () => {
      const result = toInitData(groupsInit6);

      expect(result).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.unjoinedGroups).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.pins).toBeDefined();
    });

    test('converts v7 groups correctly', () => {
      const result = toInitData(groupsInit6);

      const groups = result.groups;
      expect(groups.length).toBeGreaterThan(0);

      // v7 groups should be converted properly
      const firstGroup = groups[0];
      expect(firstGroup).toHaveProperty('id');
      expect(firstGroup).toHaveProperty('privacy');
      expect(firstGroup).toHaveProperty('currentUserIsMember', true);
      expect(firstGroup).toHaveProperty('roles');

      // Roles should be converted
      expect(firstGroup.roles).toBeDefined();
      expect(firstGroup.roles!.length).toBeGreaterThan(0);
    });

    test('converts foreigns to unjoined groups', () => {
      const result = toInitData(groupsInit6);

      expect(result.unjoinedGroups).toBeDefined();
      expect(result.unjoinedGroups.length).toBeGreaterThan(0);

      const foreignGroup = result.unjoinedGroups[0];
      expect(foreignGroup).toHaveProperty('id');
      expect(foreignGroup).toHaveProperty('privacy');
      expect(foreignGroup).toHaveProperty('currentUserIsMember', false);
      expect(foreignGroup).toHaveProperty('haveInvite');
    });

    test('extracts channel readers from v7 groups', () => {
      const result = toInitData(groupsInit6);

      expect(result.channelPerms).toBeDefined();
      expect(result.channelPerms.length).toBeGreaterThan(0);

      // Channel should have been processed
      const channel = result.channelPerms[0];
      expect(channel).toHaveProperty('channelId');
    });

    test('filters valid invites from foreigns', () => {
      const result = toInitData(groupsInit6);

      const foreignGroup = result.unjoinedGroups[0];
      // Should have invite because valid=true in fixture
      expect(foreignGroup.haveInvite).toBe(true);
    });
  });
});
