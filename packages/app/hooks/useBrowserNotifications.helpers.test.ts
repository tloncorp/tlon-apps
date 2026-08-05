import { describe, expect, it, vi } from 'vitest';

import {
  getBrowserNotificationContactName,
  getBrowserNotificationCopy,
  getBrowserNotificationGroupTitle,
  getBrowserNotificationTargetWithRetry,
  isOtherBrowserNotificationTabForegrounded,
  navigateToBrowserNotificationTarget,
} from './useBrowserNotifications.helpers';

describe('getBrowserNotificationGroupTitle', () => {
  it.each([undefined, null, ''])(
    'uses the fallback for an empty group title (%s)',
    (groupTitle) => {
      expect(
        getBrowserNotificationGroupTitle(groupTitle, 'Group invitation')
      ).toBe('Group invitation');
    }
  );

  it('preserves an explicit group title', () => {
    expect(getBrowserNotificationGroupTitle('Tlon', 'Group invitation')).toBe(
      'Tlon'
    );
  });
});

describe('isOtherBrowserNotificationTabForegrounded', () => {
  const now = 20_000;

  it('detects a recent foreground lease owned by another tab', () => {
    expect(
      isOtherBrowserNotificationTabForegrounded({
        serializedTab: JSON.stringify({
          tabId: 'other-tab',
          updatedAt: now - 1_000,
        }),
        currentTabId: 'current-tab',
        now,
        ttlMs: 15_000,
      })
    ).toBe(true);
  });

  it('ignores the current tab and expired or malformed leases', () => {
    const baseInput = {
      currentTabId: 'current-tab',
      now,
      ttlMs: 15_000,
    };

    expect(
      isOtherBrowserNotificationTabForegrounded({
        ...baseInput,
        serializedTab: JSON.stringify({
          tabId: 'current-tab',
          updatedAt: now - 1_000,
        }),
      })
    ).toBe(false);
    expect(
      isOtherBrowserNotificationTabForegrounded({
        ...baseInput,
        serializedTab: JSON.stringify({
          tabId: 'other-tab',
          updatedAt: now - 15_000,
        }),
      })
    ).toBe(false);
    expect(
      isOtherBrowserNotificationTabForegrounded({
        ...baseInput,
        serializedTab: 'not-json',
      })
    ).toBe(false);
  });
});

describe('getBrowserNotificationTargetWithRetry', () => {
  it('retries a missing target and returns it once synchronization catches up', async () => {
    const target = { id: 'chat/~zod/general' };
    const getTarget = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(target);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      getBrowserNotificationTargetWithRetry(getTarget, [250], wait)
    ).resolves.toBe(target);
    expect(getTarget).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(250);
  });

  it('does not wait when the target is already synchronized', async () => {
    const target = { id: 'chat/~zod/general' };
    const getTarget = vi.fn().mockResolvedValue(target);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      getBrowserNotificationTargetWithRetry(getTarget, [250, 500], wait)
    ).resolves.toBe(target);
    expect(getTarget).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it('stops after the bounded retry schedule when the target stays missing', async () => {
    const getTarget = vi.fn().mockResolvedValue(null);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      getBrowserNotificationTargetWithRetry(getTarget, [250, 500], wait)
    ).resolves.toBeNull();
    expect(getTarget).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[250], [500]]);
  });
});

describe('getBrowserNotificationContactName', () => {
  const contact = {
    id: '~ravmel-ropdyl',
    nickname: 'galen',
    bio: null,
    color: null,
    avatarImage: null,
    status: null,
    coverImage: null,
  };

  it('uses a contact nickname when Calm nickname suppression is disabled', () => {
    expect(
      getBrowserNotificationContactName({
        contact,
        contactId: contact.id,
        disableNicknames: false,
      })
    ).toBe('galen');
  });

  it('uses the contact ID when Calm nickname suppression is enabled', () => {
    expect(
      getBrowserNotificationContactName({
        contact,
        contactId: contact.id,
        disableNicknames: true,
      })
    ).toBe('~ravmel-ropdyl');
  });
});

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
      body: `A ${kind} by Alice was flagged in your group`,
    });
    expect(copy.body).not.toContain('Alice flagged');
    expect(copy.body).not.toBe('New message');
  });

  it('uses invite copy for dm-invite activity instead of the message fallback', () => {
    expect(
      getBrowserNotificationCopy({
        activityType: 'dm-invite',
        channelTitle: '',
        contactName: 'Alice',
        contentText: '',
        reactValue: '',
      })
    ).toEqual({
      title: 'Alice',
      body: 'Invited you to chat',
    });
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

  it('routes parentless activity to its channel and focuses the target post', () => {
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
      selectedPostId: '~bus/2',
    });
    expect(resetToPost).not.toHaveBeenCalled();
  });
});
