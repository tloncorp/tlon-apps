import { describe, expect, it } from '@jest/globals';

import {
  NAVIGATION_STATE_MAX_AGE_MS,
  getFocusedTopLevelTab,
  isPersistableNavigationState,
  isRestorableNavigationState,
  sanitizeNavigationStateForPersistence,
} from '../lib/navigationStatePersistence';

const NOW = 1_700_000_000_000;
const SHIP = '~bosser-hatber';

function mainTabsState(overrides: object = {}) {
  return {
    index: 0,
    routes: [
      {
        name: 'MainTabs',
        state: {
          index: 1,
          routes: [{ name: 'BotChat' }, { name: 'ChatList' }],
        },
      },
    ],
    ...overrides,
  };
}

function saved(
  state: unknown,
  savedAt: number = NOW,
  userId: string | null = SHIP
) {
  return { savedAt, userId, state };
}

describe('isPersistableNavigationState', () => {
  it('accepts a stack rooted at MainTabs', () => {
    expect(isPersistableNavigationState(mainTabsState())).toBe(true);
  });

  it('accepts a MainTabs root with screens pushed on top', () => {
    const state = {
      index: 1,
      routes: [{ name: 'MainTabs' }, { name: 'ChannelRoot' }],
    };
    expect(isPersistableNavigationState(state)).toBe(true);
  });

  it('refuses a stack rooted at OnboardingStartup', () => {
    const state = { index: 0, routes: [{ name: 'OnboardingStartup' }] };
    expect(isPersistableNavigationState(state)).toBe(false);
  });

  it('refuses malformed input', () => {
    expect(isPersistableNavigationState(undefined)).toBe(false);
    expect(isPersistableNavigationState(null)).toBe(false);
    expect(isPersistableNavigationState({})).toBe(false);
    expect(isPersistableNavigationState({ routes: [] })).toBe(false);
  });
});

describe('sanitizeNavigationStateForPersistence', () => {
  it('returns null for a state not worth saving', () => {
    const onboarding = { index: 0, routes: [{ name: 'OnboardingStartup' }] };
    expect(sanitizeNavigationStateForPersistence(onboarding)).toBeNull();
    expect(sanitizeNavigationStateForPersistence(undefined)).toBeNull();
  });

  it('drops a one-shot param from a nested tab route', () => {
    const state = {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 0,
            routes: [
              {
                name: 'ChatList',
                params: {
                  previewGroupId: '~zod/group',
                  previewGroupFromInviteNotification: true,
                },
              },
            ],
          },
        },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes[0].state.routes[0].params).toEqual({});
  });

  it('drops one-shot params from a pushed route but keeps the position', () => {
    const state = {
      index: 1,
      routes: [
        { name: 'MainTabs' },
        {
          name: 'ChannelRoot',
          params: {
            channelId: 'chat/~zod/hello',
            startDraft: true,
            selectedPostId: 'abc',
          },
        },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes[1].params).toEqual({ channelId: 'chat/~zod/hello' });
    expect(clean.index).toBe(1);
  });

  it('trims a trailing media viewer and reindexes onto what is under it', () => {
    const state = {
      index: 2,
      routes: [
        { name: 'MainTabs' },
        { name: 'ChannelRoot', params: { channelId: 'chat/~zod/hello' } },
        { name: 'MediaViewer', params: { uri: 'https://example.com/a.png' } },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes.map((r: any) => r.name)).toEqual([
      'MainTabs',
      'ChannelRoot',
    ]);
    expect(clean.index).toBe(1);
  });

  it('keeps a media viewer that is not the top of the stack', () => {
    const state = {
      index: 2,
      routes: [
        { name: 'MainTabs' },
        { name: 'MediaViewer' },
        { name: 'ChannelRoot' },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes).toHaveLength(3);
  });

  it('never trims away the root', () => {
    const state = { index: 0, routes: [{ name: 'MainTabs' }] };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes).toHaveLength(1);
    expect(clean.index).toBe(0);
  });

  it('drops a one-shot param nested in a navigator instruction', () => {
    // What `getTopLevelTabRoute('ChatList', { previewGroupId })` records on
    // MainTabs; rehydration merges this inner `params` back into the child.
    const state = {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          params: {
            screen: 'ChatList',
            params: { previewGroupId: '~zod/group', someTabParam: 'keep' },
          },
          state: { index: 0, routes: [{ name: 'ChatList' }] },
        },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes[0].params).toEqual({
      screen: 'ChatList',
      params: { someTabParam: 'keep' },
    });
  });

  it('cuts the stack below a route whose params cannot be serialized', () => {
    const state = {
      index: 2,
      routes: [
        { name: 'MainTabs' },
        { name: 'GroupSettings', params: { groupId: '~zod/group' } },
        {
          name: 'SelectRoleMembers',
          params: {
            groupId: '~zod/group',
            selectedMembers: [],
            onSave: () => {},
          },
        },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state) as any;
    expect(clean.routes.map((r: any) => r.name)).toEqual([
      'MainTabs',
      'GroupSettings',
    ]);
    expect(clean.index).toBe(1);
  });

  it('refuses the whole position when the root route is unrestorable', () => {
    const state = {
      index: 0,
      routes: [{ name: 'MainTabs', params: { onSave: () => {} } }],
    };
    expect(sanitizeNavigationStateForPersistence(state)).toBeNull();
  });

  it('survives a JSON round trip, which is how it is actually stored', () => {
    const state = {
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          state: { index: 0, routes: [{ name: 'ChatList' }] },
        },
        {
          name: 'ChannelRoot',
          params: { channelId: 'chat/~zod/hello', onSave: () => {} },
        },
      ],
    };
    const clean = sanitizeNavigationStateForPersistence(state);
    expect(JSON.parse(JSON.stringify(clean))).toEqual(clean);
  });
});

describe('getFocusedTopLevelTab', () => {
  it('names the focused tab', () => {
    expect(getFocusedTopLevelTab(mainTabsState())).toBe('ChatList');
  });

  it('names the bot tab, which rehydration drops while its flag loads', () => {
    const state = {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: { index: 0, routes: [{ name: 'BotChat' }] },
        },
      ],
    };
    expect(getFocusedTopLevelTab(state)).toBe('BotChat');
  });

  it('names no tab when the position is deeper than the tab navigator', () => {
    const state = {
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          state: { index: 0, routes: [{ name: 'BotChat' }] },
        },
        { name: 'ChannelRoot' },
      ],
    };
    expect(getFocusedTopLevelTab(state)).toBeNull();
  });

  it('names no tab for malformed input', () => {
    expect(getFocusedTopLevelTab(undefined)).toBeNull();
    expect(getFocusedTopLevelTab({})).toBeNull();
    expect(
      getFocusedTopLevelTab({ index: 0, routes: [{ name: 'MainTabs' }] })
    ).toBeNull();
  });
});

describe('isRestorableNavigationState', () => {
  it('restores a state saved moments ago by this user', () => {
    expect(isRestorableNavigationState(saved(mainTabsState()), NOW, SHIP)).toBe(
      true
    );
  });

  it('restores a state saved just inside the window', () => {
    const at = NOW - NAVIGATION_STATE_MAX_AGE_MS;
    expect(
      isRestorableNavigationState(saved(mainTabsState(), at), NOW, SHIP)
    ).toBe(true);
  });

  it('refuses a state older than the window', () => {
    const at = NOW - NAVIGATION_STATE_MAX_AGE_MS - 1;
    expect(
      isRestorableNavigationState(saved(mainTabsState(), at), NOW, SHIP)
    ).toBe(false);
  });

  it('refuses a state saved in the future, which is a clock that moved back', () => {
    expect(
      isRestorableNavigationState(saved(mainTabsState(), NOW + 1), NOW, SHIP)
    ).toBe(false);
  });

  it('refuses a position saved by a different account', () => {
    expect(
      isRestorableNavigationState(
        saved(mainTabsState(), NOW, '~other-ship'),
        NOW,
        SHIP
      )
    ).toBe(false);
  });

  it('refuses an unstamped position, and refuses when this user is unknown', () => {
    expect(
      isRestorableNavigationState(saved(mainTabsState(), NOW, null), NOW, SHIP)
    ).toBe(false);
    expect(isRestorableNavigationState(saved(mainTabsState()), NOW, null)).toBe(
      false
    );
  });

  it('refuses nothing saved', () => {
    expect(isRestorableNavigationState(null, NOW, SHIP)).toBe(false);
    expect(isRestorableNavigationState(undefined, NOW, SHIP)).toBe(false);
  });

  it('refuses an onboarding-rooted state', () => {
    const state = { index: 0, routes: [{ name: 'OnboardingStartup' }] };
    expect(isRestorableNavigationState(saved(state), NOW, SHIP)).toBe(false);
  });

  it('refuses a state whose shape this build no longer understands', () => {
    expect(isRestorableNavigationState(saved({}), NOW, SHIP)).toBe(false);
    expect(isRestorableNavigationState(saved({ routes: [] }), NOW, SHIP)).toBe(
      false
    );
    expect(
      isRestorableNavigationState(saved(mainTabsState({ index: 5 })), NOW, SHIP)
    ).toBe(false);
    expect(
      isRestorableNavigationState(
        saved(mainTabsState({ index: -1 })),
        NOW,
        SHIP
      )
    ).toBe(false);
    expect(
      isRestorableNavigationState(
        saved(mainTabsState({ index: undefined })),
        NOW,
        SHIP
      )
    ).toBe(false);
  });

  it('refuses a non-numeric timestamp', () => {
    expect(
      isRestorableNavigationState(
        { savedAt: NaN, userId: SHIP, state: mainTabsState() },
        NOW,
        SHIP
      )
    ).toBe(false);
  });

  it('honours an explicit window', () => {
    const at = NOW - 60_000;
    expect(
      isRestorableNavigationState(saved(mainTabsState(), at), NOW, SHIP, 30_000)
    ).toBe(false);
    expect(
      isRestorableNavigationState(
        saved(mainTabsState(), at),
        NOW,
        SHIP,
        120_000
      )
    ).toBe(true);
  });

  it('round-trips what the save side actually writes', () => {
    const live = {
      index: 1,
      routes: [
        {
          name: 'MainTabs',
          state: { index: 0, routes: [{ name: 'ChatList' }] },
        },
        { name: 'ChannelRoot', params: { channelId: 'x', startDraft: true } },
      ],
    };
    const position = sanitizeNavigationStateForPersistence(live);
    expect(isRestorableNavigationState(saved(position), NOW, SHIP)).toBe(true);
  });
});
