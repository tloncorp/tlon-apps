import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getTextContent, useMutableRef } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef } from 'react';

import { useRootNavigation } from '../navigation/utils';
import { reactDisplayValue } from '../ui/components/Activity/ActivitySummaryMessage';
import { useCalm, useCurrentUserId } from '../ui/contexts/appDataContext';
import {
  getBrowserNotificationContactName,
  getBrowserNotificationCopy,
  getBrowserNotificationTargetWithRetry,
  isOtherBrowserNotificationTabForegrounded,
  navigateToBrowserNotificationTarget,
  parseBrowserNotificationForegroundTab,
} from './useBrowserNotifications.helpers';
import { useIsElectron } from './useIsElectron';

const logger = createDevLogger('useBrowserNotifications', false);
const CHANNEL_LOOKUP_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000] as const;
const FOREGROUND_TAB_HEARTBEAT_MS = 5_000;
const FOREGROUND_TAB_TTL_MS = 15_000;
const FOREGROUND_TAB_STORAGE_PREFIX = 'tlon.browserNotifications.foregroundTab';

function canUseBrowserNotifications() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window
  );
}

function hasNotificationPermission() {
  return (
    canUseBrowserNotifications() && window.Notification.permission === 'granted'
  );
}

function isCurrentDocumentForegrounded() {
  return (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus()
  );
}

function getBrowserNotificationStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createBrowserNotificationTabId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clearOwnedForegroundTab(
  storage: Storage,
  storageKey: string,
  tabId: string
) {
  try {
    const foregroundTab = parseBrowserNotificationForegroundTab(
      storage.getItem(storageKey)
    );
    if (foregroundTab?.tabId === tabId) {
      storage.removeItem(storageKey);
    }
  } catch {
    // Storage can be disabled even when the localStorage property is present.
  }
}

function useIsAppForegroundedAcrossTabs(enabled: boolean) {
  const currentUserId = useCurrentUserId();
  const tabIdRef = useRef<string | null>(null);
  const tabId = tabIdRef.current ?? createBrowserNotificationTabId();
  tabIdRef.current = tabId;
  const storageKey = `${FOREGROUND_TAB_STORAGE_PREFIX}:${currentUserId || 'unknown'}`;

  useEffect(() => {
    if (
      !enabled ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return;
    }

    const syncForegroundState = () => {
      const storage = getBrowserNotificationStorage();
      if (!storage) {
        return;
      }

      try {
        if (isCurrentDocumentForegrounded()) {
          storage.setItem(
            storageKey,
            JSON.stringify({ tabId, updatedAt: Date.now() })
          );
        } else {
          clearOwnedForegroundTab(storage, storageKey, tabId);
        }
      } catch {
        // Fall back to this document's foreground state when storage is blocked.
      }
    };
    const clearForegroundState = () => {
      const storage = getBrowserNotificationStorage();
      if (storage) {
        clearOwnedForegroundTab(storage, storageKey, tabId);
      }
    };

    syncForegroundState();
    window.addEventListener('focus', syncForegroundState);
    window.addEventListener('blur', clearForegroundState);
    window.addEventListener('pagehide', clearForegroundState);
    document.addEventListener('visibilitychange', syncForegroundState);
    const heartbeatId = window.setInterval(
      syncForegroundState,
      FOREGROUND_TAB_HEARTBEAT_MS
    );

    return () => {
      window.removeEventListener('focus', syncForegroundState);
      window.removeEventListener('blur', clearForegroundState);
      window.removeEventListener('pagehide', clearForegroundState);
      document.removeEventListener('visibilitychange', syncForegroundState);
      window.clearInterval(heartbeatId);
      clearForegroundState();
    };
  }, [enabled, storageKey, tabId]);

  return useCallback(() => {
    if (isCurrentDocumentForegrounded()) {
      return true;
    }

    const storage = getBrowserNotificationStorage();
    if (!storage) {
      return false;
    }

    try {
      return isOtherBrowserNotificationTabForegrounded({
        serializedTab: storage.getItem(storageKey),
        currentTabId: tabId,
        now: Date.now(),
        ttlMs: FOREGROUND_TAB_TTL_MS,
      });
    } catch {
      return false;
    }
  }, [storageKey, tabId]);
}

function rememberProcessedNotification(
  processedNotifications: { current: Set<string> },
  notificationKey: string
) {
  processedNotifications.current.add(notificationKey);
  if (processedNotifications.current.size > 100) {
    processedNotifications.current = new Set(
      Array.from(processedNotifications.current).slice(-50)
    );
  }
}

async function getContactName(
  contactId: string | null | undefined,
  disableNicknames: boolean
) {
  const contact = contactId ? await db.getContact({ id: contactId }) : null;
  return getBrowserNotificationContactName({
    contact,
    contactId,
    disableNicknames,
  });
}

// Group join requests and group invites have a groupId but no channelId;
// clicking routes to the group (join requests) or the chat list where the
// invite is surfaced (invites).
async function showGroupNotification({
  activityEvent,
  notificationKey,
  disableNicknames,
  shouldSuppressNotification,
  fallbackTitle,
  getBody,
  navigateOnClick,
}: {
  activityEvent: db.ActivityEvent;
  notificationKey: string;
  disableNicknames: boolean;
  shouldSuppressNotification: () => boolean;
  fallbackTitle: string;
  getBody: (contactName: string) => string;
  navigateOnClick: (groupId: string) => void;
}) {
  const groupId = activityEvent.groupId;
  if (!groupId) {
    logger.error('No group ID in group activity event:', activityEvent);
    return false;
  }

  const group = await db.getGroup({ id: groupId });
  const contactName = await getContactName(
    activityEvent.groupEventUserId,
    disableNicknames
  );

  if (!hasNotificationPermission() || shouldSuppressNotification()) {
    return false;
  }

  const notification = new window.Notification(group?.title ?? fallbackTitle, {
    body: getBody(contactName),
    tag: notificationKey,
  });

  notification.onclick = () => {
    window.focus();
    navigateOnClick(groupId);
    notification.close();
  };

  return true;
}

/**
 * Shows browser notifications for incoming activity. Electron gets native
 * notifications via useDesktopNotifications instead, so this bails there.
 *
 * Must be mounted inside the NavigationContainer (clicking a notification
 * navigates to the source channel), and only once the client is configured
 * and syncing.
 */
export default function useBrowserNotifications() {
  const processedNotifications = useRef<Set<string>>(new Set());
  const inFlightNotifications = useRef<Set<string>>(new Set());
  const isElectron = useIsElectron();
  const isAppForegrounded = useIsAppForegroundedAcrossTabs(!isElectron);
  const { disableNicknames } = useCalm();
  const { resetToChannel, resetToGroup, resetToGroupInvite, resetToPost } =
    useRootNavigation();
  const resetToChannelRef = useMutableRef(resetToChannel);
  const resetToGroupRef = useMutableRef(resetToGroup);
  const resetToGroupInviteRef = useMutableRef(resetToGroupInvite);
  const resetToPostRef = useMutableRef(resetToPost);

  const showActivityNotification = useCallback(
    async (activityEvent: db.ActivityEvent) => {
      if (!hasNotificationPermission()) {
        return;
      }

      if (isAppForegrounded()) {
        // the user is already looking at the app
        return;
      }

      const notificationKey = activityEvent.id;
      if (
        processedNotifications.current.has(notificationKey) ||
        inFlightNotifications.current.has(notificationKey)
      ) {
        return;
      }

      inFlightNotifications.current.add(notificationKey);

      try {
        if (
          activityEvent.type === 'group-ask' ||
          activityEvent.type === 'group-invite'
        ) {
          const isAsk = activityEvent.type === 'group-ask';
          const didNotify = await showGroupNotification({
            activityEvent,
            notificationKey,
            disableNicknames,
            shouldSuppressNotification: isAppForegrounded,
            fallbackTitle: isAsk ? 'Group join request' : 'Group invitation',
            getBody: (contactName) =>
              isAsk
                ? `${contactName} is requesting to join`
                : `${contactName} invited you to join`,
            navigateOnClick: (groupId) =>
              isAsk
                ? resetToGroupRef.current(groupId)
                : resetToGroupInviteRef.current(groupId),
          });
          if (didNotify) {
            rememberProcessedNotification(
              processedNotifications,
              notificationKey
            );
          }
          return;
        }

        const channelId = activityEvent.channelId;
        if (!channelId) {
          logger.error('No channel ID in activity event:', activityEvent);
          return;
        }

        const channel = await getBrowserNotificationTargetWithRetry(
          () => db.getChannelWithRelations({ id: channelId }),
          CHANNEL_LOOKUP_RETRY_DELAYS_MS
        );
        if (!channel) {
          logger.warn(
            'Channel unavailable after retrying browser notification target:',
            channelId
          );
          return;
        }

        const contactName = await getContactName(
          activityEvent.authorId,
          disableNicknames
        );
        const isReact = activityEvent.type === 'react';
        const reactValue = isReact
          ? reactDisplayValue(activityEvent.content)
          : '';
        const contentText =
          !isReact && activityEvent.content
            ? getTextContent(activityEvent.content as api.PostContent) ?? ''
            : '';
        const group = activityEvent.groupId
          ? await db.getGroup({ id: activityEvent.groupId })
          : null;
        const { title, body } = getBrowserNotificationCopy({
          activityType: activityEvent.type,
          channelTitle: channel.title,
          contactName,
          contentText,
          groupTitle: group?.title,
          reactValue,
        });

        if (!hasNotificationPermission() || isAppForegrounded()) {
          return;
        }

        const notification = new window.Notification(title, {
          body,
          tag: notificationKey,
        });

        notification.onclick = () => {
          window.focus();
          navigateToBrowserNotificationTarget(
            {
              channelId,
              groupId: channel.groupId ?? activityEvent.groupId ?? undefined,
              parentAuthorId: activityEvent.parentAuthorId,
              parentId: activityEvent.parentId,
              postId: activityEvent.postId,
            },
            {
              resetToChannel: resetToChannelRef.current,
              resetToPost: resetToPostRef.current,
            }
          );
          notification.close();
        };
        rememberProcessedNotification(processedNotifications, notificationKey);
      } catch (error) {
        logger.error(
          'Error processing activity for browser notifications',
          error
        );
      } finally {
        inFlightNotifications.current.delete(notificationKey);
      }
    },
    [
      disableNicknames,
      isAppForegrounded,
      resetToChannelRef,
      resetToGroupRef,
      resetToGroupInviteRef,
      resetToPostRef,
    ]
  );

  useEffect(() => {
    if (isElectron || !canUseBrowserNotifications()) {
      return;
    }

    let cancelled = false;
    let subscriptionId: number | null = null;

    api
      .subscribeToActivity(
        (event: api.ActivityEvent) => {
          if (event.type !== 'addActivityEvent') {
            return;
          }

          const activityEvent =
            event.events.find((e) => e.bucketId === 'all') ?? event.events[0];

          if (activityEvent?.shouldNotify) {
            showActivityNotification(activityEvent);
          }
        },
        // dm-invite/group-invite events notify by default but aren't part of
        // the converted feed stream; opt in here (see toActivityEvent)
        { includeInvites: true }
      )
      .then((id) => {
        if (cancelled) {
          // effect already cleaned up before the subscription landed
          api.unsubscribe(id);
        } else {
          subscriptionId = id;
        }
      })
      .catch((e) => {
        logger.error('Error subscribing to browser notification activity', e);
      });

    return () => {
      cancelled = true;
      if (subscriptionId != null) {
        api.unsubscribe(subscriptionId);
      }
    };
  }, [isElectron, showActivityNotification]);
}
