import type * as db from '@tloncorp/shared/db';

import { resolveContactNameProps } from '../ui/components/contactNameResolver';

export type BrowserNotificationForegroundTab = {
  tabId: string;
  updatedAt: number;
};

export function parseBrowserNotificationForegroundTab(
  serializedTab: string | null
): BrowserNotificationForegroundTab | null {
  if (!serializedTab) {
    return null;
  }

  try {
    const tab: unknown = JSON.parse(serializedTab);
    if (
      typeof tab === 'object' &&
      tab !== null &&
      'tabId' in tab &&
      typeof tab.tabId === 'string' &&
      'updatedAt' in tab &&
      typeof tab.updatedAt === 'number'
    ) {
      return { tabId: tab.tabId, updatedAt: tab.updatedAt };
    }
  } catch {
    // Ignore malformed/stale values from previous app versions.
  }

  return null;
}

export function isOtherBrowserNotificationTabForegrounded({
  serializedTab,
  currentTabId,
  now,
  ttlMs,
}: {
  serializedTab: string | null;
  currentTabId: string;
  now: number;
  ttlMs: number;
}) {
  const foregroundTab = parseBrowserNotificationForegroundTab(serializedTab);
  if (!foregroundTab || foregroundTab.tabId === currentTabId) {
    return false;
  }

  const ageMs = now - foregroundTab.updatedAt;
  return ageMs >= 0 && ageMs < ttlMs;
}

export async function getBrowserNotificationTargetWithRetry<T>(
  getTarget: () => Promise<T | null | undefined>,
  retryDelaysMs: readonly number[],
  wait: (delayMs: number) => Promise<void> = (delayMs) =>
    new Promise((resolve) => setTimeout(resolve, delayMs))
): Promise<T | null> {
  let target = await getTarget();

  for (const delayMs of retryDelaysMs) {
    if (target != null) {
      return target;
    }

    await wait(delayMs);
    target = await getTarget();
  }

  return target ?? null;
}

type BrowserNotificationContactNameInput = {
  contact: db.Contact | null;
  contactId?: string | null;
  disableNicknames: boolean;
};

export function getBrowserNotificationContactName({
  contact,
  contactId,
  disableNicknames,
}: BrowserNotificationContactNameInput) {
  if (!contactId) {
    return 'Unknown';
  }

  return (
    resolveContactNameProps({
      contact,
      contactId,
      calmDisableNicknames: disableNicknames,
    }).children || contactId
  );
}

export function getBrowserNotificationGroupTitle(
  groupTitle: string | null | undefined,
  fallbackTitle: string
) {
  return groupTitle || fallbackTitle;
}

type BrowserNotificationCopyInput = {
  activityType: string;
  channelTitle?: string | null;
  contactName: string;
  contentText: string;
  groupTitle?: string | null;
  reactValue: string;
};

export function getBrowserNotificationCopy({
  activityType,
  channelTitle,
  contactName,
  contentText,
  groupTitle,
  reactValue,
}: BrowserNotificationCopyInput) {
  const flaggedKind =
    activityType === 'flag-post'
      ? 'post'
      : activityType === 'flag-reply'
        ? 'reply'
        : null;
  const isReact = activityType === 'react';
  const isDmInvite = activityType === 'dm-invite';

  let title = flaggedKind
    ? `Flagged ${flaggedKind}`
    : channelTitle || contactName || 'New message';
  let body = flaggedKind
    ? `A ${flaggedKind} by ${contactName} was flagged in your group`
    : isReact
      ? `${contactName} reacted${reactValue ? ` ${reactValue}` : ''} to your post`
      : isDmInvite
        ? // the title already names the inviter (DM titles are the counterparty)
          'Invited you to chat'
        : contentText || 'New message';

  if (groupTitle) {
    title = `${title} in ${groupTitle}`;
    if (!isReact && !flaggedKind) {
      body = contentText
        ? `${contactName || 'Someone'}: ${contentText}`
        : `New message in ${groupTitle}`;
    }
  }

  return { title, body };
}

type BrowserNotificationTargetInput = {
  parentAuthorId?: string | null;
  parentId?: string | null;
  postId?: string | null;
};

type BrowserNotificationNavigationTarget =
  | { type: 'channel'; selectedPostId?: string }
  | {
      type: 'thread';
      parentAuthorId: string;
      parentId: string;
      selectedPostId?: string;
    };

function getBrowserNotificationNavigationTarget({
  parentAuthorId,
  parentId,
  postId,
}: BrowserNotificationTargetInput): BrowserNotificationNavigationTarget {
  if (!parentId) {
    return { type: 'channel', selectedPostId: postId ?? undefined };
  }

  return {
    type: 'thread',
    parentAuthorId: parentAuthorId ?? '',
    parentId,
    selectedPostId: postId ?? undefined,
  };
}

type BrowserNotificationNavigationInput = BrowserNotificationTargetInput & {
  channelId: string;
  groupId?: string | null;
};

type BrowserNotificationNavigationActions = {
  resetToChannel: (
    channelId: string,
    options: { groupId?: string; selectedPostId?: string }
  ) => void;
  resetToPost: (post: {
    postId: string;
    authorId: string;
    channelId: string;
    groupId?: string;
    selectedPostId?: string;
  }) => void;
};

export function navigateToBrowserNotificationTarget(
  input: BrowserNotificationNavigationInput,
  actions: BrowserNotificationNavigationActions
) {
  const target = getBrowserNotificationNavigationTarget(input);
  const groupId = input.groupId ?? undefined;

  if (target.type === 'thread') {
    actions.resetToPost({
      postId: target.parentId,
      authorId: target.parentAuthorId,
      channelId: input.channelId,
      groupId,
      selectedPostId: target.selectedPostId,
    });
    return;
  }

  actions.resetToChannel(input.channelId, {
    groupId,
    selectedPostId: target.selectedPostId,
  });
}
