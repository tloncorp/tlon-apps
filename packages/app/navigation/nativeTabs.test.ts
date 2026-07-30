import { describe, expect, test } from 'vitest';

import { resolveNativeTabRedirectState } from './nativeTabs';

describe('resolveNativeTabRedirectState', () => {
  test('replaces the adapter while preserving its params and focused destination', () => {
    const channelRoute = { key: 'channel', name: 'Channel' };

    expect(
      resolveNativeTabRedirectState({
        state: {
          index: 1,
          routes: [
            {
              key: 'adapter',
              name: 'ChatList',
              params: {
                previewGroupId: '~sample-group',
                previewGroupFromInviteNotification: true,
              },
            },
            channelRoute,
          ],
        },
        route: {
          key: 'adapter',
          name: 'ChatList',
          params: {
            previewGroupId: '~sample-group',
            previewGroupFromInviteNotification: true,
          },
        },
      })
    ).toEqual({
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          params: {
            screen: 'ChatList',
            params: {
              previewGroupId: '~sample-group',
              previewGroupFromInviteNotification: true,
            },
          },
        },
        channelRoute,
      ],
    });
  });

  test('retargets an existing tab shell and removes the focused adapter', () => {
    expect(
      resolveNativeTabRedirectState({
        state: {
          index: 1,
          routes: [
            {
              key: 'tabs',
              name: 'MainTabs',
              params: { screen: 'ChatList' },
            },
            { key: 'adapter', name: 'Activity' },
            { key: 'settings', name: 'Settings' },
          ],
        },
        route: {
          key: 'adapter',
          name: 'Activity',
          params: undefined,
        },
      })
    ).toEqual({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          params: { screen: 'Activity', params: undefined },
        },
        { key: 'settings', name: 'Settings' },
      ],
    });
  });

  test('does nothing when the adapter is no longer in state', () => {
    expect(
      resolveNativeTabRedirectState({
        state: {
          index: 0,
          routes: [{ key: 'tabs', name: 'MainTabs' }],
        },
        route: {
          key: 'adapter',
          name: 'Contacts',
          params: undefined,
        },
      })
    ).toBeNull();
  });
});
