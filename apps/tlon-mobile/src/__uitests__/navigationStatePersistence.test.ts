import { describe, expect, it } from '@jest/globals';

import {
  NAVIGATION_STATE_MAX_AGE_MS,
  isPersistableNavigationState,
  isRestorableNavigationState,
} from '../lib/navigationStatePersistence';

const NOW = 1_700_000_000_000;

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

function saved(state: unknown, savedAt: number = NOW) {
  return { savedAt, state };
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
    const state = {
      index: 0,
      routes: [{ name: 'OnboardingStartup' }],
    };
    expect(isPersistableNavigationState(state)).toBe(false);
  });

  it('refuses malformed input', () => {
    expect(isPersistableNavigationState(undefined)).toBe(false);
    expect(isPersistableNavigationState(null)).toBe(false);
    expect(isPersistableNavigationState({})).toBe(false);
    expect(isPersistableNavigationState({ routes: [] })).toBe(false);
  });
});

describe('isRestorableNavigationState', () => {
  it('restores a state saved moments ago', () => {
    expect(isRestorableNavigationState(saved(mainTabsState()), NOW)).toBe(true);
  });

  it('restores a state saved just inside the window', () => {
    const at = NOW - NAVIGATION_STATE_MAX_AGE_MS;
    expect(isRestorableNavigationState(saved(mainTabsState(), at), NOW)).toBe(
      true
    );
  });

  it('refuses a state older than the window', () => {
    const at = NOW - NAVIGATION_STATE_MAX_AGE_MS - 1;
    expect(isRestorableNavigationState(saved(mainTabsState(), at), NOW)).toBe(
      false
    );
  });

  it('refuses a state saved in the future, which is a clock that moved back', () => {
    expect(
      isRestorableNavigationState(saved(mainTabsState(), NOW + 1), NOW)
    ).toBe(false);
  });

  it('refuses nothing saved', () => {
    expect(isRestorableNavigationState(null, NOW)).toBe(false);
    expect(isRestorableNavigationState(undefined, NOW)).toBe(false);
  });

  it('refuses an onboarding-rooted state', () => {
    const state = { index: 0, routes: [{ name: 'OnboardingStartup' }] };
    expect(isRestorableNavigationState(saved(state), NOW)).toBe(false);
  });

  it('refuses a state whose shape this build no longer understands', () => {
    expect(isRestorableNavigationState(saved({}), NOW)).toBe(false);
    expect(isRestorableNavigationState(saved({ routes: [] }), NOW)).toBe(false);
    expect(
      isRestorableNavigationState(saved(mainTabsState({ index: 5 })), NOW)
    ).toBe(false);
    expect(
      isRestorableNavigationState(saved(mainTabsState({ index: -1 })), NOW)
    ).toBe(false);
    expect(
      isRestorableNavigationState(
        saved(mainTabsState({ index: undefined })),
        NOW
      )
    ).toBe(false);
  });

  it('refuses a non-numeric timestamp', () => {
    expect(
      isRestorableNavigationState({ savedAt: NaN, state: mainTabsState() }, NOW)
    ).toBe(false);
    expect(
      isRestorableNavigationState(
        { savedAt: 'yesterday' as unknown as number, state: mainTabsState() },
        NOW
      )
    ).toBe(false);
  });

  it('honours an explicit window', () => {
    const at = NOW - 60_000;
    expect(
      isRestorableNavigationState(saved(mainTabsState(), at), NOW, 30_000)
    ).toBe(false);
    expect(
      isRestorableNavigationState(saved(mainTabsState(), at), NOW, 120_000)
    ).toBe(true);
  });
});
