import { describe, expect, test, vi } from 'vitest';

import {
  type LayoutPosition,
  getLayoutPosition,
  getLayoutState,
  isSamePlace,
  isSplitLayoutWidth,
} from './splitLayoutState';

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NavigationTabSelected: 'Navigation Tab Selected' },
  trackEvent: vi.fn(),
}));

const channelId = 'chat/~zod/general';
const groupId = '~zod/group';
const dmId = '~bus';

function phoneStack(...routes: { name: string; params?: object }[]) {
  return { type: 'stack', index: routes.length - 1, routes };
}

// Mounted split-tree state for a channel opened from the Home sidebar.
function splitChannelState(nested: { name: string; params?: object }[]) {
  return {
    type: 'drawer',
    index: 0,
    routes: [
      {
        name: 'Home',
        state: {
          type: 'drawer',
          index: 2,
          routes: [
            { name: 'ChatList' },
            { name: 'GroupChannels' },
            {
              name: 'Channel',
              params: { channelId, groupId },
              state: {
                type: 'stack',
                index: nested.length - 1,
                routes: nested,
              },
            },
          ],
        },
      },
      { name: 'Messages' },
      { name: 'Activity' },
      { name: 'Contacts' },
      { name: 'Settings' },
    ],
  };
}

describe('isSplitLayoutWidth', () => {
  test('matches the web breakpoint', () => {
    expect(isSplitLayoutWidth(767)).toBe(false);
    expect(isSplitLayoutWidth(768)).toBe(true);
  });
});

describe('getLayoutPosition', () => {
  test('reads a channel pushed over the phone tabs', () => {
    expect(
      getLayoutPosition(
        phoneStack(
          { name: 'MainTabs' },
          { name: 'Channel', params: { channelId, groupId } }
        )
      )
    ).toEqual({ kind: 'channel', channelId, groupId });
  });

  test('falls back to the channel beneath a screen it does not map', () => {
    expect(
      getLayoutPosition(
        phoneStack(
          { name: 'MainTabs' },
          { name: 'DM', params: { channelId: dmId } },
          { name: 'ChannelMembers', params: { channelId: dmId } }
        )
      )
    ).toEqual({ kind: 'channel', channelId: dmId, groupId: undefined });
  });

  test('reads the focused phone tab, including the bot chat', () => {
    expect(
      getLayoutPosition(
        phoneStack({
          name: 'MainTabs',
          state: {
            type: 'tab',
            index: 1,
            routes: [
              { name: 'BotChat', params: { channelId: dmId } },
              { name: 'Activity' },
            ],
          },
        } as never)
      )
    ).toEqual({ kind: 'activity' });
    expect(
      getLayoutPosition(
        phoneStack({
          name: 'MainTabs',
          state: {
            type: 'tab',
            index: 0,
            routes: [{ name: 'BotChat', params: { channelId: dmId } }],
          },
        } as never)
      )
    ).toEqual({ kind: 'channel', channelId: dmId, groupId: undefined });
  });

  test('reads a thread in the split tree', () => {
    expect(
      getLayoutPosition(
        splitChannelState([
          { name: 'ChannelRoot', params: { channelId, groupId } },
          {
            name: 'Post',
            params: { postId: '1', authorId: '~zod', channelId, groupId },
          },
        ])
      )
    ).toEqual({
      kind: 'post',
      channelId,
      groupId,
      postId: '1',
      authorId: '~zod',
    });
  });

  test('reads a route that is still only a navigate payload', () => {
    expect(
      getLayoutPosition({
        type: 'drawer',
        index: 0,
        routes: [
          {
            name: 'Home',
            params: {
              screen: 'Channel',
              params: {
                channelId,
                groupId,
                screen: 'ChannelRoot',
                params: { channelId, groupId },
              },
            },
          },
        ],
      })
    ).toEqual({ kind: 'channel', channelId, groupId });
  });

  test('reads a conversation opened under Messages in the split tree', () => {
    expect(
      getLayoutPosition({
        type: 'drawer',
        index: 1,
        routes: [
          { name: 'Home' },
          {
            name: 'Messages',
            state: {
              type: 'drawer',
              index: 1,
              routes: [
                { name: 'ChatList' },
                {
                  name: 'DM',
                  params: { channelId: dmId },
                  state: {
                    type: 'stack',
                    index: 0,
                    routes: [
                      { name: 'ChannelRoot', params: { channelId: dmId } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      })
    ).toEqual({ kind: 'channel', channelId: dmId, section: 'Messages' });
  });

  test('keeps group channels under Home even when the phone tabs say Messages', () => {
    expect(
      getLayoutPosition(
        phoneStack(
          { name: 'MainTabs', params: { splitSection: 'Messages' } },
          { name: 'Channel', params: { channelId, groupId } }
        )
      )
    ).toEqual({ kind: 'channel', channelId, groupId });
  });

  test('reads group settings open in a split channel stack', () => {
    expect(
      getLayoutPosition(
        splitChannelState([
          { name: 'ChannelRoot', params: { channelId, groupId } },
          {
            name: 'GroupSettings',
            state: {
              type: 'stack',
              index: 1,
              routes: [
                { name: 'GroupMeta', params: { groupId } },
                { name: 'GroupMembers', params: { groupId } },
              ],
            },
          },
        ] as never)
      )
    ).toEqual({
      kind: 'groupSettings',
      groupId,
      channelId,
      screen: 'GroupMembers',
      params: { groupId },
    });
  });

  test('reads group settings opened with a state payload on the phone', () => {
    expect(
      getLayoutPosition(
        phoneStack(
          { name: 'MainTabs' },
          { name: 'Channel', params: { channelId, groupId } },
          {
            name: 'GroupSettings',
            params: {
              state: {
                index: 0,
                routes: [{ name: 'Privacy', params: { groupId } }],
              },
            },
          }
        )
      )
    ).toEqual({
      kind: 'groupSettings',
      groupId,
      channelId,
      screen: 'Privacy',
      params: { groupId },
    });
  });

  test('reads a profile and a settings screen from the split drawers', () => {
    expect(
      getLayoutPosition({
        type: 'drawer',
        index: 0,
        routes: [
          {
            name: 'Activity',
            state: {
              type: 'drawer',
              index: 1,
              routes: [
                { name: 'ActivityEmpty' },
                { name: 'UserProfile', params: { userId: dmId } },
              ],
            },
          },
        ],
      })
    ).toEqual({ kind: 'profile', userId: dmId });
    expect(
      getLayoutPosition({
        type: 'drawer',
        index: 0,
        routes: [
          {
            name: 'Settings',
            state: {
              type: 'drawer',
              index: 1,
              routes: [
                { name: 'SettingsEmpty' },
                {
                  name: 'BotShipListSettings',
                  params: { list: 'dmAllowlist' },
                },
              ],
            },
          },
        ],
      })
    ).toEqual({
      kind: 'settingsScreen',
      screen: 'BotShipListSettings',
      params: { list: 'dmAllowlist' },
    });
  });

  test('does not take a sibling drawer route for the focused one', () => {
    expect(
      getLayoutPosition({
        type: 'drawer',
        index: 1,
        routes: [
          {
            name: 'Home',
            params: { screen: 'Channel', params: { channelId } },
          },
          { name: 'Settings' },
        ],
      })
    ).toEqual({ kind: 'settings' });
  });
});

describe('getLayoutState', () => {
  const positions: LayoutPosition[] = [
    { kind: 'home' },
    { kind: 'activity' },
    { kind: 'settings' },
    { kind: 'contacts' },
    { kind: 'group', groupId },
    { kind: 'channel', channelId, groupId },
    { kind: 'channel', channelId: dmId, groupId: undefined },
    {
      kind: 'post',
      channelId,
      groupId,
      postId: '1',
      authorId: '~zod',
    },
    { kind: 'channel', channelId: dmId, section: 'Messages' },
    {
      kind: 'post',
      channelId: dmId,
      postId: '1',
      authorId: '~zod',
      section: 'Messages',
    },
    { kind: 'profile', userId: dmId },
    {
      kind: 'settingsScreen',
      screen: 'BotModelSettings',
      params: { mode: 'default' },
    },
    { kind: 'settingsScreen', screen: 'BlockedUsers' },
    {
      kind: 'groupSettings',
      groupId,
      channelId,
      screen: 'GroupMembers',
      params: { groupId },
    },
    {
      kind: 'groupSettings',
      groupId,
      screen: 'GroupMeta',
      params: { groupId },
    },
  ];

  test.each(positions)('round-trips $kind through both trees', (position) => {
    for (const layout of ['phone', 'split'] as const) {
      const state = getLayoutState(position, layout);
      expect(
        getLayoutPosition({ type: 'stack', ...state }),
        `${layout} ${JSON.stringify(state)}`
      ).toEqual(position);
    }
  });

  test('seats phone destinations over the Workspaces tab', () => {
    expect(
      getLayoutState({ kind: 'channel', channelId: dmId }, 'phone')
    ).toEqual({
      index: 1,
      routes: [
        { name: 'MainTabs', params: { screen: 'ChatList' } },
        { name: 'DM', params: { channelId: dmId } },
      ],
    });
  });

  test('shows an empty Messages section only in the split tree', () => {
    const position: LayoutPosition = { kind: 'home', section: 'Messages' };
    expect(
      getLayoutPosition({
        type: 'stack',
        ...getLayoutState(position, 'split'),
      })
    ).toEqual(position);
    expect(getLayoutState(position, 'phone').routes).toEqual([
      { name: 'MainTabs' },
    ]);
  });

  test('does not place Home under Messages from a stale phone param', () => {
    expect(
      getLayoutPosition(
        phoneStack({ name: 'MainTabs', params: { splitSection: 'Messages' } })
      )
    ).toEqual({ kind: 'home' });
  });

  test('leaves the phone tab choice to the phone tree for Home', () => {
    expect(getLayoutState({ kind: 'home' }, 'phone')).toEqual({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  });

  test('carries the Messages section on the phone tab route', () => {
    expect(
      getLayoutState(
        { kind: 'channel', channelId: dmId, section: 'Messages' },
        'phone'
      ).routes[0]
    ).toEqual({
      name: 'MainTabs',
      params: { screen: 'ChatList', splitSection: 'Messages' },
    });
  });

  test('opens group settings outside a channel in the activity drawer', () => {
    expect(
      getLayoutState(
        {
          kind: 'groupSettings',
          groupId,
          screen: 'GroupMeta',
          params: { groupId },
        },
        'split'
      ).routes
    ).toEqual([
      {
        name: 'Activity',
        params: {
          screen: 'GroupSettings',
          params: { screen: 'GroupMeta', params: { groupId } },
        },
      },
    ]);
  });

  test('opens split destinations as one top-level drawer route', () => {
    expect(getLayoutState({ kind: 'group', groupId }, 'split')).toEqual({
      index: 0,
      routes: [
        {
          name: 'Home',
          params: { screen: 'GroupChannels', pop: true, params: { groupId } },
        },
      ],
    });
  });
});

describe('isSamePlace', () => {
  test('ignores the split section and absent optional fields', () => {
    expect(
      isSamePlace(
        { kind: 'channel', channelId: dmId, groupId: undefined },
        { kind: 'channel', channelId: dmId, section: 'Messages' }
      )
    ).toBe(true);
  });

  test('tells different places apart', () => {
    expect(
      isSamePlace(
        { kind: 'channel', channelId: dmId },
        { kind: 'channel', channelId }
      )
    ).toBe(false);
    expect(isSamePlace({ kind: 'home' }, { kind: 'activity' })).toBe(false);
  });
});
