import { getStateFromPath } from '@react-navigation/core';
import { describe, expect, test, vi } from 'vitest';

import { getMobileLinkingConfig } from './linking';
import {
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isAwaitingRestoredBotTab,
  isTabPressBlockedByOnboardingLock,
} from './topLevelTabs';

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
    ['/apps/groups/bot', 'BotChat'],
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
  // A cold link seats MainTabs beneath them so back and the tab bar work.
  test.each([
    ['/apps/groups/activity', 'Activity'],
    ['/apps/groups/contacts', 'Contacts'],
  ])('routes %s to the root stack over MainTabs', (path, screen) => {
    const state = getStateFromPath(path, getMobileLinkingConfig('').config!);

    expect(state?.routes[0]).toMatchObject({
      name: 'Root',
      state: {
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: screen }],
      },
    });
  });
});

describe('isTabPressBlockedByOnboardingLock', () => {
  test('refuses every tab but Bot while onboarding is locked', () => {
    expect(isTabPressBlockedByOnboardingLock(true, 'ChatList')).toBe(true);
    expect(isTabPressBlockedByOnboardingLock(true, 'Settings')).toBe(true);
    expect(isTabPressBlockedByOnboardingLock(true, 'BotChat')).toBe(false);
  });

  test('lets every tab through once the lock lifts', () => {
    expect(isTabPressBlockedByOnboardingLock(false, 'ChatList')).toBe(false);
    expect(isTabPressBlockedByOnboardingLock(false, 'Settings')).toBe(false);
  });
});

describe('isAtColdStartPosition', () => {
  const tabs = (name: string, params?: object) => ({
    index: 0,
    routes: [{ name, params }],
  });

  test('holds on MainTabs before the tabs render, and on a bare Workspaces tab', () => {
    expect(
      isAtColdStartPosition({ index: 0, routes: [{ name: 'MainTabs' }] })
    ).toBe(true);
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('ChatList') }],
      })
    ).toBe(true);
  });

  test('is over once another root screen or tab is showing', () => {
    expect(
      isAtColdStartPosition({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'Activity' }],
      })
    ).toBe(false);
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('Settings') }],
      })
    ).toBe(false);
    expect(isAtColdStartPosition(undefined)).toBe(false);
  });

  test('yields to a destination Workspaces was sent to', () => {
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: tabs('ChatList', { previewGroupId: '~zod/garden' }),
          },
        ],
      })
    ).toBe(false);
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: {
              screen: 'ChatList',
              params: { previewGroupId: '~zod/garden' },
            },
          },
        ],
      })
    ).toBe(false);
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'ChatList' } }],
      })
    ).toBe(false);
  });
});

describe('isAwaitingRestoredBotTab', () => {
  const tabs = (name: string) => ({ index: 0, routes: [{ name }] });

  test('holds when the restore landed on Workspaces instead of the bot tab', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('ChatList') }],
      })
    ).toBe(true);
  });

  test('holds before the tabs render', () => {
    expect(
      isAwaitingRestoredBotTab({ index: 0, routes: [{ name: 'MainTabs' }] })
    ).toBe(true);
  });

  test('releases once the bot tab is the focused one', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('BotChat') }],
      })
    ).toBe(false);
  });

  test('releases when the user has moved above MainTabs', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 1,
        routes: [
          { name: 'MainTabs', state: tabs('ChatList') },
          { name: 'ChannelRoot' },
        ],
      })
    ).toBe(false);
  });
});
