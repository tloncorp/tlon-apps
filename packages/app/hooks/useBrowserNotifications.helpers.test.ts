import { describe, expect, it, vi } from 'vitest';

import {
  getBrowserNotificationCopy,
  navigateToBrowserNotificationTarget,
} from './useBrowserNotifications.helpers';

describe('getBrowserNotificationCopy', () => {
  it('falls back to the contact name when a DM title is empty', () => {
    expect(
      getBrowserNotificationCopy({
        activityType: 'post',
        channelTitle: '',
        contactName: 'Alice',
        contentText: 'Hello',
        reactValue: '',
      })
    ).toEqual({
      title: 'Alice',
      body: 'Hello',
    });
  });

  it.each([
    ['flag-post', 'post'],
    ['flag-reply', 'reply'],
  ])('uses flag-specific copy for %s activity', (activityType, kind) => {
    const copy = getBrowserNotificationCopy({
      activityType,
      channelTitle: 'General',
      contactName: 'Alice',
      contentText: '',
      groupTitle: 'Tlon',
      reactValue: '',
    });

    expect(copy).toEqual({
      title: `Flagged ${kind} in Tlon`,
      body: `Alice flagged a ${kind} in your group`,
    });
    expect(copy.body).not.toBe('New message');
  });
});

describe('navigateToBrowserNotificationTarget', () => {
  it('resets parented activity, including replies and reactions, to its thread', () => {
    const resetToChannel = vi.fn();
    const resetToPost = vi.fn();

    navigateToBrowserNotificationTarget(
      {
        channelId: 'chat/~zod/general',
        groupId: '~zod/tlon',
        parentAuthorId: '~zod',
        parentId: '~zod/1',
        postId: '~bus/2',
      },
      { resetToChannel, resetToPost }
    );

    expect(resetToPost).toHaveBeenCalledWith({
      postId: '~zod/1',
      authorId: '~zod',
      channelId: 'chat/~zod/general',
      groupId: '~zod/tlon',
      selectedPostId: '~bus/2',
    });
    expect(resetToChannel).not.toHaveBeenCalled();
  });

  it('keeps parentless activity routed to its channel', () => {
    const resetToChannel = vi.fn();
    const resetToPost = vi.fn();

    navigateToBrowserNotificationTarget(
      {
        channelId: 'chat/~zod/general',
        groupId: '~zod/tlon',
        postId: '~bus/2',
      },
      { resetToChannel, resetToPost }
    );

    expect(resetToChannel).toHaveBeenCalledWith('chat/~zod/general', {
      groupId: '~zod/tlon',
    });
    expect(resetToPost).not.toHaveBeenCalled();
  });
});
