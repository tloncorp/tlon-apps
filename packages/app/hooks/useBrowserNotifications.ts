import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getTextContent, useMutableRef } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef } from 'react';

import { useRootNavigation } from '../navigation/utils';
import { useIsElectron } from './useIsElectron';

const logger = createDevLogger('useBrowserNotifications', false);

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

function isAppForegrounded() {
  return (
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus()
  );
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
  const isElectron = useIsElectron();
  const { resetToChannel } = useRootNavigation();
  const resetToChannelRef = useMutableRef(resetToChannel);

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
      if (processedNotifications.current.has(notificationKey)) {
        return;
      }

      processedNotifications.current.add(notificationKey);
      if (processedNotifications.current.size > 100) {
        processedNotifications.current = new Set(
          Array.from(processedNotifications.current).slice(-50)
        );
      }

      const channelId = activityEvent.channelId;
      if (!channelId) {
        logger.error('No channel ID in activity event:', activityEvent);
        return;
      }

      try {
        const channel = await db.getChannelWithRelations({ id: channelId });
        if (!channel) {
          return;
        }

        const contactId = activityEvent.authorId;
        const contact = contactId
          ? await db.getContact({ id: contactId })
          : null;
        const contactName = contact?.nickname ?? contactId ?? 'Unknown';
        const contentText = activityEvent.content
          ? getTextContent(activityEvent.content as api.PostContent)
          : '';

        let title = channel.title ?? contactName ?? 'New message';
        let body = contentText || 'New message';

        if (activityEvent.groupId) {
          const group = await db.getGroup({ id: activityEvent.groupId });
          if (group) {
            title = `${title} in ${group.title}`;
            body = contentText
              ? `${contactName ?? 'Someone'}: ${contentText}`
              : `New message in ${group.title}`;
          }
        }

        const notification = new window.Notification(title, {
          body,
          tag: notificationKey,
        });

        notification.onclick = () => {
          window.focus();
          resetToChannelRef.current(channelId, {
            groupId: channel.groupId ?? undefined,
          });
          notification.close();
        };
      } catch (error) {
        logger.error(
          'Error processing channel activity for browser notifications',
          error
        );
      }
    },
    [resetToChannelRef]
  );

  useEffect(() => {
    if (isElectron || !canUseBrowserNotifications()) {
      return;
    }

    let cancelled = false;
    let subscriptionId: number | null = null;

    api
      .subscribeToActivity((event: api.ActivityEvent) => {
        if (event.type !== 'addActivityEvent') {
          return;
        }

        const activityEvent =
          event.events.find((e) => e.bucketId === 'all') ?? event.events[0];

        if (activityEvent?.shouldNotify) {
          showActivityNotification(activityEvent);
        }
      })
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
