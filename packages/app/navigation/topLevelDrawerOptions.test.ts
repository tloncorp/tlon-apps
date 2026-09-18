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

describe('isTopLevelDrawerSwipeTarget', () => {
  it('claims the edge at the stack root, and before the stack exists', () => {
    expect(isTopLevelDrawerSwipeTarget({ state: { index: 0 } })).toBe(true);
    expect(isTopLevelDrawerSwipeTarget({})).toBe(true);
    expect(isTopLevelDrawerSwipeTarget(undefined)).toBe(true);
  });

  // Deeper than the root the same edge belongs to the back gesture.
  it('leaves the edge alone with anything pushed above the sections', () => {
    expect(isTopLevelDrawerSwipeTarget({ state: { index: 1 } })).toBe(false);
    expect(isTopLevelDrawerSwipeTarget({ state: { index: 3 } })).toBe(false);
  });
});
