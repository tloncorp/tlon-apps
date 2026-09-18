import { describe, expect, it, vi } from 'vitest';

import {
  announceTopLevelSectionReselected,
  subscribeToTopLevelSectionReselected,
} from './topLevelSectionReselect';

describe('topLevelSectionReselect', () => {
  it('carries the section to every listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToTopLevelSectionReselected(first);
    const unsubscribeSecond = subscribeToTopLevelSectionReselected(second);

    announceTopLevelSectionReselected('Activity');

    expect(first).toHaveBeenCalledWith('Activity');
    expect(second).toHaveBeenCalledWith('Activity');
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('stops at unsubscribe', () => {
    const listener = vi.fn();
    subscribeToTopLevelSectionReselected(listener)();

    announceTopLevelSectionReselected('ChatList');

    expect(listener).not.toHaveBeenCalled();
  });

  // The listeners are iterated over a copy, so one that unsubscribes while the
  // announcement is running cannot make the set skip the next one.
  it('reaches every listener even when one unsubscribes mid-announcement', () => {
    const later = vi.fn();
    const unsubscribeLater = subscribeToTopLevelSectionReselected(later);
    const unsubscribeFirst = subscribeToTopLevelSectionReselected(() =>
      unsubscribeFirst()
    );

    announceTopLevelSectionReselected('Settings');

    expect(later).toHaveBeenCalledWith('Settings');
    unsubscribeLater();
  });
});
