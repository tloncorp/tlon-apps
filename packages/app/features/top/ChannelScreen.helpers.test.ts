import { describe, expect, it } from 'vitest';

import { shouldFallbackFromUnreadCursor } from './ChannelScreen.helpers';

describe('shouldFallbackFromUnreadCursor', () => {
  it('falls back after the unread cursor query fails', () => {
    expect(
      shouldFallbackFromUnreadCursor({
        unreadCursor: 'stale-unread-post',
        clearedCursor: false,
        queryFailureCount: 1,
      })
    ).toBe(true);
  });

  it('does not hide a selected-post query failure', () => {
    expect(
      shouldFallbackFromUnreadCursor({
        unreadCursor: 'stale-unread-post',
        selectedPostId: 'selected-post',
        clearedCursor: false,
        queryFailureCount: 1,
      })
    ).toBe(false);
  });

  it('does not switch query modes before a failure or after fallback', () => {
    expect(
      shouldFallbackFromUnreadCursor({
        unreadCursor: 'unread-post',
        clearedCursor: false,
        queryFailureCount: 0,
      })
    ).toBe(false);
    expect(
      shouldFallbackFromUnreadCursor({
        unreadCursor: 'unread-post',
        clearedCursor: true,
        queryFailureCount: 1,
      })
    ).toBe(false);
  });
});
