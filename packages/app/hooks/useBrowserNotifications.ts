import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getTextContent } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef } from 'react';

const logger = createDevLogger('useBrowserNotifications', false);

interface NotificationData {
  type: string;
  channelId?: string;
  groupId?: string;
}

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

export default function useBrowserNotifications(isClientReady: boolean) {
  const processedNotifications = useRef<Set<string>>(new Set());
  const subscribedRef = useRef(false);

  const showActivityNotification = useCallback(
    async (activityEvent: db.ActivityEvent) => {
      if (!canUseBrowserNotifications()) {
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

      if (!hasNotificationPermission()) {
        return;
      }

      if (!activityEvent.channelId) {
        logger.error('No channel ID in activity event:', activityEvent);
        return;
      }

      try {
        const channel = await db.getChannelWithRelations({
          id: activityEvent.channelId,
        });
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
          data: {
            type: 'channel',
            channelId: activityEvent.channelId,
            groupId: channel.groupId ?? undefined,
          } satisfies NotificationData,
        });

        notification.onclick = () => {
          window.focus();
        };
      } catch (error) {
        logger.error(
          'Error processing channel activity for browser notifications',
          error
        );
      }
    },
    []
  );

  useEffect(() => {
    if (
      !isClientReady ||
      subscribedRef.current ||
      !canUseBrowserNotifications()
    ) {
      return;
    }

    subscribedRef.current = true;

    const handleActivityEvent = (event: api.ActivityEvent) => {
      if (event.type !== 'addActivityEvent') {
        return;
      }

      const activityEvent =
        event.events.find((e) => e.bucketId === 'all') ?? event.events[0];

      if (activityEvent?.shouldNotify) {
        showActivityNotification(activityEvent);
      }
    };

    try {
      api.subscribeToActivity(handleActivityEvent);
    } catch (error) {
      subscribedRef.current = false;
      logger.error('Error subscribing to browser notification activity', error);
    }
  }, [isClientReady, showActivityNotification]);
}
