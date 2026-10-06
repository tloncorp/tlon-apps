import { describe, expect, test } from 'vitest';

import { toInitData } from '../client/initApi';
import { setDeskCountsAllSeats } from '../client/urbit';
import type * as ub from '../urbit';
import rawGroupsInit6 from './fixtures/groupsInit5.json';

const groupsInit6 = rawGroupsInit6 as unknown as ub.GroupsInit10;
const currentUserId = '~solfer-magfed';
const toTestInitData = (response: ub.GroupsInit10) =>
  toInitData(response, { currentUserId });

describe('toInitData', () => {
  describe('v6 format support', () => {
    test('processes v6 init with foreigns', () => {
      const result = toTestInitData(groupsInit6);

      expect(result).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.unjoinedGroups).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.pins).toBeDefined();
    });

    test('converts v7 groups correctly', () => {
      const result = toTestInitData(groupsInit6);

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
      const result = toTestInitData(groupsInit6);

      expect(result.unjoinedGroups).toBeDefined();
      expect(result.unjoinedGroups.length).toBeGreaterThan(0);

      const foreignGroup = result.unjoinedGroups[0];
      expect(foreignGroup).toHaveProperty('id');
      expect(foreignGroup).toHaveProperty('privacy');
      expect(foreignGroup).toHaveProperty('currentUserIsMember', false);
      expect(foreignGroup).toHaveProperty('haveInvite');
    });

    test('extracts channel readers from v7 groups', () => {
      const result = toTestInitData(groupsInit6);

      expect(result.channelPerms).toBeDefined();
      expect(result.channelPerms.length).toBeGreaterThan(0);

      // Channel should have been processed
      const channel = result.channelPerms[0];
      expect(channel).toHaveProperty('channelId');
    });

    test('extracts joined notes channels from active group channels', () => {
      const response = structuredClone(groupsInit6);
      const group = response.groups['~test-ship/test-group'];
      group['active-channels'] = [
        ...(group['active-channels'] ?? []),
        'notes/~test-ship/native-notes',
      ];

      const result = toTestInitData(response);

      expect(result.joinedGroupChannels).toContain(
        'notes/~test-ship/native-notes'
      );
    });

    test('does not treat notes listings as joined without active channel state', () => {
      const response = structuredClone(groupsInit6);
      const group = response.groups['~test-ship/test-group'];
      group['active-channels'] = [];
      group.channels['notes/~test-ship/native-notes'] = {
        added: 1692473215572,
        meta: {
          image: '',
          title: 'Native notes',
          cover: '',
          description: '',
        },
        section: 'default',
        readers: [],
        join: true,
      };

      const result = toTestInitData(response);

      expect(result.joinedGroupChannels).not.toContain(
        'notes/~test-ship/native-notes'
      );
    });

    test('filters valid invites from foreigns', () => {
      const result = toTestInitData(groupsInit6);

      const foreignGroup = result.unjoinedGroups[0];
      // Should have invite because valid=true in fixture
      expect(foreignGroup.haveInvite).toBe(true);
    });
  });

  describe('member counts', () => {
    // Through desk 12.3.1, init counts the 15 seats it keeps, not the group.
    const groupWithCount = (count: number) => {
      const response = structuredClone(groupsInit6);
      response.groups['~test-ship/test-group']['member-count'] = count;
      return toTestInitData(response).groups[0];
    };

    test('keeps a count below the truncation cap', () => {
      expect(groupWithCount(9).memberCount).toBe(9);
    });

    test('drops a count that may be the cap', () => {
      expect(groupWithCount(15).memberCount).toBeUndefined();
    });

    test('keeps a count above the cap, which only a fixed desk sends', () => {
      expect(groupWithCount(40).memberCount).toBe(40);
    });

    test('trusts 15 from a desk that counts every seat', () => {
      setDeskCountsAllSeats(true);
      try {
        expect(groupWithCount(15).memberCount).toBe(15);
      } finally {
        setDeskCountsAllSeats(false);
      }
    });
  });
});
