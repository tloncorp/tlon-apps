import { getStateFromPath } from '@react-navigation/core';
import { StackRouter } from '@react-navigation/routers';
import { describe, expect, test, vi } from 'vitest';

import { getMobileLinkingConfig } from './linking';
import {
  getTopLevelTabRoute,
  isAtColdStartPosition,
  isAwaitingRestoredBotTab,
  getActiveTopLevelTab,
  getTopLevelTabNavigateAction,
  getInitialTopLevelTab,
  getLeftChatTopLevelTab,
  getStandingTopLevelTabRoute,
  isTabPressBlockedByOnboardingLock,
} from './topLevelTabs';
import type { RouteSnapshot } from './topLevelTabs';

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
    ['/apps/groups/activity', 'Activity'],
    ['/apps/groups/settings', 'Settings'],
  ])('nests %s under MainTabs', (path, screen) => {
    const state = getStateFromPath(path, getMobileLinkingConfig('').config!);

    // `Main` is the top-level drawer's one screen, which holds the stack.
    expect(state?.routes[0]).toMatchObject({
      name: 'Root',
      state: {
        routes: [
          {
            name: 'Main',
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
          },
        ],
      },
    });
  });

  // Contacts left the navigation bar; it is a root stack screen. A cold link
  // seats MainTabs beneath it so back works and the drawer marks its section.
  test('routes /apps/groups/contacts to the root stack over MainTabs', () => {
    const state = getStateFromPath(
      '/apps/groups/contacts',
      getMobileLinkingConfig('').config!
    );

    expect(state?.routes[0]).toMatchObject({
      name: 'Root',
      state: {
        routes: [
          {
            name: 'Main',
            state: {
              index: 1,
              routes: [{ name: 'MainTabs' }, { name: 'Contacts' }],
            },
          },
        ],
      },
    });
  });
});

describe('getTopLevelTabNavigateAction', () => {
  const router = StackRouter({});
  const routerOptions = {
    routeNames: ['MainTabs', 'Channel'],
    routeParamList: {},
    routeGetIdList: {},
  };
  const stackWithChannel = () =>
    ({
      stale: false,
      type: 'stack',
      key: 'stack-1',
      index: 1,
      routeNames: ['MainTabs', 'Channel'],
      preloadedRoutes: [],
      routes: [
        { key: 'MainTabs-1', name: 'MainTabs', params: { screen: 'ChatList' } },
        { key: 'Channel-1', name: 'Channel', params: { channelId: 'c1' } },
      ],
    }) as Parameters<ReturnType<typeof StackRouter>['getStateForAction']>[0];

  // A NAVIGATE that does not pop only reuses the *focused* route, so choosing
  // a section from a pushed screen would leave a second MainTabs — and a
  // second copy of every section screen — on the stack.
  test('returns to the MainTabs already on the stack instead of pushing another', () => {
    const next = router.getStateForAction(
      stackWithChannel(),
      getTopLevelTabNavigateAction('Activity'),
      routerOptions
    );

    expect(next?.routes.map((route) => route.name)).toEqual(['MainTabs']);
    expect(next?.index).toBe(0);
    expect(next?.routes[0].key).toBe('MainTabs-1');
    expect(next?.routes[0].params).toMatchObject({ screen: 'Activity' });
  });
});

describe('getActiveTopLevelTab', () => {
  const stack = (routes: RouteSnapshot[], index = 0) => ({ index, routes });
  const mainTabs = (section: string) => ({
    name: 'MainTabs',
    state: { index: 0, routes: [{ name: section }] },
  });

  test('names the section MainTabs is showing', () => {
    expect(getActiveTopLevelTab(stack([mainTabs('Activity')]))).toBe(
      'Activity'
    );
  });

  test('still names it with a screen pushed above, which is a position within it', () => {
    expect(
      getActiveTopLevelTab(
        stack([mainTabs('ChatList'), { name: 'Channel' }], 1)
      )
    ).toBe('ChatList');
  });

  test('names nothing before the stack has built MainTabs', () => {
    expect(getActiveTopLevelTab(undefined)).toBeNull();
    expect(
      getActiveTopLevelTab(stack([{ name: 'OnboardingStartup' }]))
    ).toBeNull();
    expect(getActiveTopLevelTab(stack([{ name: 'MainTabs' }]))).toBeNull();
  });

  test('names nothing for a section this build does not have', () => {
    expect(getActiveTopLevelTab(stack([mainTabs('Retired')]))).toBeNull();
  });
});

describe('getInitialTopLevelTab', () => {
  test('starts on the bot when the account has one, the list otherwise', () => {
    expect(getInitialTopLevelTab(true)).toBe('BotChat');
    expect(getInitialTopLevelTab(false)).toBe('ChatList');
  });
});

describe('getLeftChatTopLevelTab', () => {
  test('goes to the bot when the account has one, Activity otherwise', () => {
    expect(getLeftChatTopLevelTab(true)).toBe('BotChat');
    expect(getLeftChatTopLevelTab(false)).toBe('Activity');
  });
});

describe('isTabPressBlockedByOnboardingLock', () => {
  test('refuses every tab but Bot while onboarding is locked', () => {
    expect(isTabPressBlockedByOnboardingLock(true, 'ChatList')).toBe(true);
    expect(isTabPressBlockedByOnboardingLock(true, 'Activity')).toBe(true);
    expect(isTabPressBlockedByOnboardingLock(true, 'Settings')).toBe(true);
    expect(isTabPressBlockedByOnboardingLock(true, 'BotChat')).toBe(false);
  });

  test('lets every tab through once the lock lifts', () => {
    expect(isTabPressBlockedByOnboardingLock(false, 'ChatList')).toBe(false);
    expect(isTabPressBlockedByOnboardingLock(false, 'Activity')).toBe(false);
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
        routes: [{ name: 'MainTabs' }, { name: 'Contacts' }],
      })
    ).toBe(false);
    expect(
      isAtColdStartPosition({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('Activity') }],
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

  test('holds when the position itself named the bot tab', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: { screen: 'BotChat' },
            state: tabs('ChatList'),
          },
        ],
      })
    ).toBe(true);
  });

  test('releases to a deep link that landed after the restore', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              index: 0,
              routes: [
                { name: 'ChatList', params: { previewGroupId: '~zod/garden' } },
              ],
            },
          },
        ],
      })
    ).toBe(false);
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            params: { screen: 'ChatList' },
            state: tabs('ChatList'),
          },
        ],
      })
    ).toBe(false);
  });

  test('releases on a tab that is neither the bot tab nor the fallback', () => {
    expect(
      isAwaitingRestoredBotTab({
        index: 0,
        routes: [{ name: 'MainTabs', state: tabs('Settings') }],
      })
    ).toBe(false);
  });
});

describe('getStandingTopLevelTabRoute', () => {
  const stack = (focused: string) => ({
    index: 1,
    routes: [
      {
        name: 'MainTabs',
        key: 'MainTabs-abc',
        state: {
          index: ['BotChat', 'ChatList', 'Activity', 'Settings'].indexOf(
            focused
          ),
          routes: [
            { name: 'BotChat', key: 'BotChat-1' },
            { name: 'ChatList', key: 'ChatList-1' },
            { name: 'Activity', key: 'Activity-1' },
            { name: 'Settings', key: 'Settings-1' },
          ],
          history: [{ type: 'route' as const, key: `${focused}-1` }],
        },
      },
      { name: 'DM', key: 'DM-1' },
    ],
  });

  // The whole point: a chat opened from the drawer must not drag the sections
  // to Workspaces behind it.
  test('hands back the sections untouched, whichever one is showing', () => {
    for (const section of ['BotChat', 'ChatList', 'Activity', 'Settings']) {
      const route = getStandingTopLevelTabRoute(stack(section), 'ChatList');
      expect(route.name).toBe('MainTabs');
      expect(route.key).toBe('MainTabs-abc');
      expect(route.state?.routes?.[route.state.index ?? 0]?.name).toBe(section);
    }
  });

  test('keeps the route identical, so nothing below it remounts', () => {
    const state = stack('Activity');
    const mainTabs = state.routes[0];
    expect(getStandingTopLevelTabRoute(state, 'ChatList')).toBe(mainTabs);
  });

  test('falls back to a fresh route only when the stack has no MainTabs', () => {
    expect(getStandingTopLevelTabRoute(undefined, 'ChatList')).toEqual({
      name: 'MainTabs',
      params: { screen: 'ChatList' },
    });
    expect(
      getStandingTopLevelTabRoute(
        { index: 0, routes: [{ name: 'OnboardingStartup' }] },
        'BotChat'
      )
    ).toEqual({ name: 'MainTabs', params: { screen: 'BotChat' } });
  });

  // A MainTabs the navigator has not reported state for yet cannot be reused
  // as-is: it carries no sections to preserve.
  test('falls back when MainTabs is there but has not built its sections', () => {
    expect(
      getStandingTopLevelTabRoute(
        { index: 0, routes: [{ name: 'MainTabs', key: 'MainTabs-abc' }] },
        'ChatList'
      )
    ).toEqual({ name: 'MainTabs', params: { screen: 'ChatList' } });
  });
});
