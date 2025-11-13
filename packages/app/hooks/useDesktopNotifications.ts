import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { getTextContent } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef } from 'react';

import { useIsElectron } from './useIsElectron';

const logger = createDevLogger('useDesktopNotifications', false);

interface NotificationData {
  type: string;
  channelId?: string;
  groupId?: string;
}

export default function useDesktopNotifications(isClientReady: boolean) {
  const processedNotifications = useRef<Set<string>>(new Set());
  const isElectron = useIsElectron();

  const processActivityEvent = useCallback(
    async (activityEvent: db.ActivityEvent) => {
      if (!isElectron || !window.electronAPI) {
        return;
      }

      const notificationKey = `${activityEvent.channelId}-${activityEvent.timestamp}`;

      if (processedNotifications.current.has(notificationKey)) {
        return;
      }

      processedNotifications.current.add(notificationKey);

      // Limit the size of the set to avoid memory leaks
      if (processedNotifications.current.size > 100) {
        // Keep only the most recent 50 notification keys
        processedNotifications.current = new Set(
          Array.from(processedNotifications.current).slice(-50)
        );
      }

      let body = '';

      if (!activityEvent.channelId) {
        logger.error('No channel ID in activity event:', activityEvent);
        return;
      }

      try {
        const channel = await db.getChannelWithRelations({
          id: activityEvent.channelId,
        });
        if (activityEvent.content) {
          body =
            getTextContent(activityEvent.content as api.PostContent) ||
            'New message';
        } else {
          body = 'New message';
        }

        const contactId = activityEvent.authorId;
        const contact = contactId
          ? await db.getContact({ id: contactId })
          : null;

        if (!channel) return;

        // Use nickname if available, otherwise use contactId
        // This matches the logic in ContactNameV2
        const contactName = contact?.nickname ?? contactId ?? 'Unknown';

        let title = channel.title ? channel.title : contactName;

        if (activityEvent.groupId) {
          const group = await db.getGroup({ id: activityEvent.groupId });
          if (group) {
            if (activityEvent.content) {
              body = `${contactName}: ${getTextContent(activityEvent.content as api.PostContent)}`;
              title = title + ` in ${group.title}`;
            } else {
              body = `New message in ${group.title}`;
            }
          }
        }

        logger.log('Showing desktop notification:', title);

        window.electronAPI.showNotification({
          title,
          body,
          data: {
            type: 'channel',
            channelId: activityEvent.channelId,
            groupId: channel.groupId,
          },
        });
      } catch (error) {
        logger.error(
          'Error processing channel activity for notifications',
          error
        );
      }
    },
    []
  );

  const handleNotificationClick = useCallback(
    async (data: NotificationData) => {
      if (!data || !data.channelId) return;

      try {
        logger.log('Notification clicked:', data);
        await api.markChatRead(data.channelId);

        // In the future, we could add navigation logic here
      } catch (error) {
        logger.error('Error handling notification click', error);
      }
    },
    []
  );

  useEffect(() => {
    if (!isElectron || !window.electronAPI || !isClientReady) return;

    const handleActivityEvent = (event: api.ActivityEvent) => {
      logger.log('Activity event:', event);
      if (event.type === 'addActivityEvent' && event.events[0].shouldNotify) {
        processActivityEvent(event.events[0]);
      }
    };

    api.subscribeToActivity(handleActivityEvent);

    const unsubscribeNotificationClick =
      window.electronAPI.onNotificationClicked(handleNotificationClick);

    return () => {
      unsubscribeNotificationClick();
    };
  }, [
    processActivityEvent,
    handleNotificationClick,
    isClientReady,
    isElectron,
  ]);
}
