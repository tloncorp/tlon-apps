import { describe, expect, it } from 'vitest';

import {
  getTopLevelDrawerWidth,
  isTopLevelDrawerSwipeTarget,
} from './topLevelDrawerOptions';

describe('getTopLevelDrawerWidth', () => {
  it('leaves a strip of the screen behind it on a phone', () => {
    expect(getTopLevelDrawerWidth(390)).toBe(320);
    expect(getTopLevelDrawerWidth(320)).toBe(262);
  });

  it('stops widening on a tablet, where 82% would be most of the screen', () => {
    expect(getTopLevelDrawerWidth(1024)).toBe(320);
  });
});

// The argument is the root stack's own state, as `AppDrawer` subscribes to it.
// An earlier version took the drawer's screen route and read `.state` off it,
// which is never populated there — so this answered "at the root" wherever the
// user was, and these tests passed a shape that never reached it.
describe('isTopLevelDrawerSwipeTarget', () => {
  it('claims the edge at the stack root, and before the stack exists', () => {
    expect(isTopLevelDrawerSwipeTarget({ index: 0 })).toBe(true);
    expect(isTopLevelDrawerSwipeTarget({})).toBe(true);
    expect(isTopLevelDrawerSwipeTarget(undefined)).toBe(true);
  });

  // Deeper than the root the same edge belongs to the back gesture.
  it('leaves the edge alone with anything pushed above the sections', () => {
    expect(
      isTopLevelDrawerSwipeTarget({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'Post' }],
      })
    ).toBe(false);
    expect(
      isTopLevelDrawerSwipeTarget({
        index: 2,
        routes: [
          { name: 'MainTabs' },
          { name: 'GroupChannels' },
          { name: 'ChatDetails' },
        ],
      })
    ).toBe(false);
  });

  // The conversations the drawer opens carry its button rather than a back
  // caret, and the gesture has to agree with the button.
  it('claims the edge on a conversation sitting on the sections', () => {
    for (const name of ['DM', 'GroupDM', 'GroupChannels']) {
      expect(
        isTopLevelDrawerSwipeTarget({
          index: 1,
          routes: [{ name: 'MainTabs' }, { name }],
        })
      ).toBe(true);
    }
  });

  it('distinguishes a channel opened as a destination from one pushed over something', () => {
    expect(
      isTopLevelDrawerSwipeTarget({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'Channel', params: { isDrawerDestination: true } },
        ],
      })
    ).toBe(true);
    expect(
      isTopLevelDrawerSwipeTarget({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'Channel', params: {} }],
      })
    ).toBe(false);
  });

  // Only the focused route decides: a destination left further down the stack
  // is behind something that owns the edge itself.
  it('reads the focused route, not one buried under it', () => {
    expect(
      isTopLevelDrawerSwipeTarget({
        index: 2,
        routes: [{ name: 'MainTabs' }, { name: 'DM' }, { name: 'UserProfile' }],
      })
    ).toBe(false);
  });
});
