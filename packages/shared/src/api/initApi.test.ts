import { describe, expect, test } from 'vitest';

import rawGroupsInit5 from '../test/groupsInit5.json';
import rawGroupsInit4 from '../test/groupsInit.json';
import type * as ub from '../urbit';
import { toInitData } from './initApi';

const groupsInit4 = rawGroupsInit4 as unknown as ub.GroupsInit4;
const groupsInit5 = rawGroupsInit5 as unknown as ub.GroupsInit5;

describe('toInitData', () => {
  describe('v4 format support', () => {
    test('processes v4 init with gangs', () => {
      const result = toInitData(groupsInit4);

      expect(result).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.unjoinedGroups).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.pins).toBeDefined();
    });

    test('converts v2 groups correctly', () => {
      const result = toInitData(groupsInit4);

      const groups = result.groups;
      expect(groups.length).toBeGreaterThan(0);

      // v2 groups should be converted properly
      const firstGroup = groups[0];
      expect(firstGroup).toHaveProperty('id');
      expect(firstGroup).toHaveProperty('privacy');
      expect(firstGroup).toHaveProperty('currentUserIsMember');
    });

    test('converts gangs to unjoined groups', () => {
      const result = toInitData(groupsInit4);

      expect(result.unjoinedGroups).toBeDefined();
      expect(Array.isArray(result.unjoinedGroups)).toBe(true);
    });
  });

  describe('v5 format support', () => {
    test('processes v5 init with foreigns', () => {
      const result = toInitData(groupsInit5);

      expect(result).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.unjoinedGroups).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.pins).toBeDefined();
    });

    test('converts v7 groups correctly', () => {
      const result = toInitData(groupsInit5);

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
      const result = toInitData(groupsInit5);

      expect(result.unjoinedGroups).toBeDefined();
      expect(result.unjoinedGroups.length).toBeGreaterThan(0);

      const foreignGroup = result.unjoinedGroups[0];
      expect(foreignGroup).toHaveProperty('id');
      expect(foreignGroup).toHaveProperty('privacy');
      expect(foreignGroup).toHaveProperty('currentUserIsMember', false);
      expect(foreignGroup).toHaveProperty('haveInvite');
    });

    test('extracts channel readers from v7 groups', () => {
      const result = toInitData(groupsInit5);

      expect(result.channelPerms).toBeDefined();
      expect(result.channelPerms.length).toBeGreaterThan(0);

      // Channel should have been processed
      const channel = result.channelPerms[0];
      expect(channel).toHaveProperty('channelId');
    });

    test('filters valid invites from foreigns', () => {
      const result = toInitData(groupsInit5);

      const foreignGroup = result.unjoinedGroups[0];
      // Should have invite because valid=true in fixture
      expect(foreignGroup.haveInvite).toBe(true);
    });
  });

  describe('version detection', () => {
    test('detects v4 format (has gangs, no foreigns)', () => {
      const result = toInitData(groupsInit4);
      // Should work without errors
      expect(result.groups).toBeDefined();
    });

    test('detects v5 format (has foreigns, no gangs)', () => {
      const result = toInitData(groupsInit5);
      // Should work without errors
      expect(result.groups).toBeDefined();
    });
  });

  describe('backward compatibility', () => {
    test('v4 and v5 produce compatible output structure', () => {
      const result4 = toInitData(groupsInit4);
      const result5 = toInitData(groupsInit5);

      // Both should have same structure
      expect(result4).toHaveProperty('groups');
      expect(result4).toHaveProperty('unjoinedGroups');
      expect(result4).toHaveProperty('channels');
      expect(result4).toHaveProperty('pins');
      expect(result4).toHaveProperty('unreads');

      expect(result5).toHaveProperty('groups');
      expect(result5).toHaveProperty('unjoinedGroups');
      expect(result5).toHaveProperty('channels');
      expect(result5).toHaveProperty('pins');
      expect(result5).toHaveProperty('unreads');
    });
  });
});
