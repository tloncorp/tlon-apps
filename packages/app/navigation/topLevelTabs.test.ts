import { getStateFromPath } from '@react-navigation/core';
import { describe, expect, test, vi } from 'vitest';

import { getMobileLinkingConfig } from './linking';
import { getTopLevelTabRoute } from './topLevelTabs';

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NavigationTabSelected: 'Navigation Tab Selected' },
  trackEvent: vi.fn(),
}));

describe('getTopLevelTabRoute', () => {
  test('targets a tab through the shared MainTabs route', () => {
    expect(getTopLevelTabRoute('Settings')).toEqual({
      name: 'MainTabs',
      params: { screen: 'Settings' },
    });
  });

  test('preserves tab params', () => {
    expect(
      getTopLevelTabRoute('ChatList', {
        previewGroupId: '~sample-group',
        previewGroupFromInviteNotification: true,
      })
    ).toEqual({
      name: 'MainTabs',
      params: {
        screen: 'ChatList',
        params: {
          previewGroupId: '~sample-group',
          previewGroupFromInviteNotification: true,
        },
      },
    });
  });
});

describe('mobile top-level tab links', () => {
  test.each([
    ['/apps/groups/home-group', 'HomeGroup'],
    ['/apps/groups/ChatList', 'ChatList'],
    ['/apps/groups/settings', 'Settings'],
  ])('nests %s under MainTabs', (path, screen) => {
    const state = getStateFromPath(path, getMobileLinkingConfig('').config!);

    expect(state?.routes[0]).toMatchObject({
      name: 'Root',
      state: {
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [{ name: screen }],
            },
          },
        ],
      },
    });
  });

  // Activity and Contacts left the tab bar; they are now root stack screens.
  test.each([
    ['/apps/groups/activity', 'Activity'],
    ['/apps/groups/contacts', 'Contacts'],
  ])('routes %s to the root stack', (path, screen) => {
    const state = getStateFromPath(path, getMobileLinkingConfig('').config!);

    expect(state?.routes[0]).toMatchObject({
      name: 'Root',
      state: {
        routes: [{ name: screen }],
      },
    });
  });
});
