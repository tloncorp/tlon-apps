import { beforeAll, describe, expect, test } from 'vitest';

import { toInitData } from '../client/initApi';
import { internalConfigureClient } from '../client/urbit';
import type * as ub from '../urbit';
import rawGroupsInit6 from './fixtures/groupsInit5.json';

const groupsInit6 = rawGroupsInit6 as unknown as ub.GroupsInit6;

describe('toInitData', () => {
  beforeAll(() => {
    internalConfigureClient({
      shipName: 'solfer-magfed',
      shipUrl: 'http://localhost',
    });
  });

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

    test('extracts joined notes channels from active group channels', () => {
      const response = structuredClone(groupsInit6);
      const group = response.groups['~test-ship/test-group'];
      group['active-channels'] = [
        ...(group['active-channels'] ?? []),
        'notes/~test-ship/native-notes',
      ];

      const result = toInitData(response);

      expect(result.joinedGroupChannels).toContain(
        'notes/~test-ship/native-notes'
      );
    });

    test('treats auto-joined notes listings as joined for old backends', () => {
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

      const result = toInitData(response);

      expect(result.joinedGroupChannels).toContain(
        'notes/~test-ship/native-notes'
      );
    });

    test('does not treat non-notes listings as joined without active channel state', () => {
      const response = structuredClone(groupsInit6);
      const group = response.groups['~test-ship/test-group'];
      group['active-channels'] = [];
      group.channels['heap/~test-ship/announcements'] = {
        added: 1692473215572,
        meta: {
          image: '',
          title: 'Announcements',
          cover: '',
          description: '',
        },
        section: 'default',
        readers: [],
        join: true,
      };

      const result = toInitData(response);

      expect(result.joinedGroupChannels).not.toContain(
        'heap/~test-ship/announcements'
      );
    });

    test('does not treat unreadable notes listings as joined', () => {
      const response = structuredClone(groupsInit6);
      const group = response.groups['~test-ship/test-group'];
      group['active-channels'] = [];
      group.channels['notes/~test-ship/private-notes'] = {
        added: 1692473215572,
        meta: {
          image: '',
          title: 'Private notes',
          cover: '',
          description: '',
        },
        section: 'default',
        readers: ['not-my-role'],
        join: true,
      };

      const result = toInitData(response);

      expect(result.joinedGroupChannels).not.toContain(
        'notes/~test-ship/private-notes'
      );
    });

    test('filters valid invites from foreigns', () => {
      const result = toInitData(groupsInit6);

      const foreignGroup = result.unjoinedGroups[0];
      // Should have invite because valid=true in fixture
      expect(foreignGroup.haveInvite).toBe(true);
    });
  });
});
