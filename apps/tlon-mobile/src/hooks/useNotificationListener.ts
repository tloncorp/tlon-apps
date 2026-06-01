import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import {
  isDmChannelId,
  isGroupDmChannelId,
} from '@tloncorp/api/client/apiUtils';
import { useCurrentUserIdOrNull } from '@tloncorp/app/hooks/useCurrentUser';
import {
  connectNotifications,
  presentContactMatchNotification,
  presentContactsMatchedNotification,
} from '@tloncorp/app/lib/notifications';
import { startPushNotifTapMeasurement } from '@tloncorp/app/lib/pushNotifTapTelemetry';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import {
  createTypedReset,
  getMainGroupRoute,
  screenNameFromChannelId,
} from '@tloncorp/app/navigation/utils';
import { useIsWindowNarrow } from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  SyncPriority,
  createDevLogger,
  ensureDmInviteChannel,
  setContactsMatchedHandler,
  syncDms,
  syncGroups,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import {
  Notification,
  clearLastNotificationResponseAsync,
  useLastNotificationResponse,
} from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
  extractDmTapTelemetry,
  readRawPayload,
  safeParseActivityEvent,
} from '../lib/dmTapTelemetry';
import {
  type PostInfo,
  type ProcessableNotificationData,
  parseNotificationPayload,
} from '../lib/notificationPayload';

const logger = createDevLogger('useNotificationListener', false);

const notificationSyncCtx = {
  priority: SyncPriority.High + 1,
  retry: true,
};

type RouteStack = {
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
}[];

function payloadFromNotification(
  notification: Notification
): ReturnType<typeof parseNotificationPayload> {
  // When a notification is received directly (i.e. is not mutated via
  // notification service extension), the payload is delivered in the
  // `content`. When "triggered" through the NSE, the payload is in the
  // `trigger`.
  // Detect and use whatever payload is available.
  const payload = (() => {
    // Not sure why the payload is in different places per platform,
    // but it is what it is
    if (Platform.OS === 'android') {
      return notification.request.content.data;
    } else {
      const { content, trigger } = notification.request;
      const isPush = trigger && 'type' in trigger && trigger.type === 'push';
      return isPush ? trigger.payload : content.data;
    }
  })();

  return parseNotificationPayload(payload);
}

function getNotificationType(data: ProcessableNotificationData) {
  return data.type ?? 'channelNotification';
}

export function getNotificationRouteCategory(
  data: ProcessableNotificationData
) {
  if (!('channelId' in data)) {
    return 'nonChannelNotification';
  }

  if (data.type === 'dmInvite' && data.whomType === 'ship') {
    return 'dmInvite';
  }

  if (isDmChannelId(data.channelId)) {
    return 'singleDm';
  }

  if (isGroupDmChannelId(data.channelId)) {
    return 'groupDm';
  }

  return 'groupOrChannel';
}

export type MissingNotificationTargetRecovery =
  | 'none'
  | 'singleDmInvite'
  | 'dms'
  | 'groups';

export function getMissingNotificationTargetRecovery(
  data: ProcessableNotificationData,
  preparedDmInviteTarget = false
): MissingNotificationTargetRecovery {
  if (!('channelId' in data) || preparedDmInviteTarget) {
    return 'none';
  }

  if (isDmChannelId(data.channelId)) {
    return 'singleDmInvite';
  }

  if (isGroupDmChannelId(data.channelId)) {
    return 'dms';
  }

  return 'groups';
}

export default function useNotificationListener() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isTlonEmployee = db.isTlonEmployee.useValue();
  const currentUserId = useCurrentUserIdOrNull();

  const [notifToProcess, setNotifToProcess] =
    useState<ProcessableNotificationData | null>(null);

  // Start notifications prompt
  useEffect(() => {
    connectNotifications();
    setContactsMatchedHandler(async (contactIds) => {
      if (contactIds.length === 1) {
        const [contactId] = contactIds;
        const systemContacts =
          await db.getSystemContactsBatchByContactId(contactIds);
        const sc = systemContacts.find((c) => c.contactId === contactId);
        const name =
          [sc?.firstName, sc?.lastName].filter(Boolean).join(' ').trim() ||
          contactId;
        await presentContactMatchNotification({ contactId, name });
      } else {
        await presentContactsMatchedNotification({ count: contactIds.length });
      }
    });
    return () => setContactsMatchedHandler(null);
  }, []);

  const notificationResponse = useLastNotificationResponse();
  useEffect(() => {
    if (notificationResponse != null) {
      try {
        // Emit DM-tap telemetry (TLON-5728) before any navigation or DB work,
        // so the event fires for every tapped dm-post regardless of whether the
        // channel can be hydrated. Best-effort: a throw here must never break
        // the notification routing below. Joined to OpenClaw's nudge-send event
        // in PostHog on `messageId`.
        if (currentUserId != null) {
          try {
            const rawPayload = readRawPayload(
              notificationResponse.notification
            );
            const parsedActivity = safeParseActivityEvent(rawPayload);
            const dmTap = extractDmTapTelemetry(
              parsedActivity,
              rawPayload,
              currentUserId
            );
            if (dmTap != null) {
              logger.trackEvent(AnalyticsEvent.ActionTappedDmPushNotif, dmTap);
            }
          } catch (telemetryErr) {
            console.warn(
              'Failed to emit DM tap telemetry (best-effort)',
              telemetryErr
            );
          }
        }

        const data = payloadFromNotification(notificationResponse.notification);

        // If the NSE caught an error, it puts it in a list under
        // `notificationServiceExtensionErrors` - slurp em and log.
        //
        // NB: This will only log errors on tapped notifications - we could use
        // `getPresentedNotificationsAsync` to log all notifications' errors,
        // but we don't have a good way to prevent logging the same
        // notification multiple times.
        const errorsFromExtension = data?.meta.errorsFromExtension;
        if (errorsFromExtension != null) {
          logger.trackError(AnalyticsEvent.ErrorNotificationService, {
            context: 'Notification service extension forwarded an error:',
            properties: { errors: errorsFromExtension },
          });
        }

        if (data == null || data.type === 'unrecognized') {
          // https://linear.app/tlon/issue/TLON-2551/multiple-notifications-that-lead-to-nowhere-crash-app
          // We're seeing cases where `data` is null here - not sure why this is happening.
          // Log the notification and don't try to navigate.
          logger.trackError(AnalyticsEvent.ErrorNotificationService, {
            context: 'Failed to get notification payload',
            properties: {
              notificationType: data?.type ?? 'null',
            },
          });
        } else {
          setNotifToProcess(data);
        }
      } catch (error) {
        logger.trackError(AnalyticsEvent.ErrorNotificationService, {
          context: 'Failed to process notification response',
          properties: {
            errorKind: error instanceof Error ? error.name : typeof error,
          },
        });
      } finally {
        // Clear so future taps with reused request identifiers are not deduped.
        void clearLastNotificationResponseAsync().catch((error) => {
          logger.trackError(AnalyticsEvent.ErrorNotificationService, {
            context: 'Failed to clear last notification response',
            error,
          });
        });
      }
    }
  }, [notificationResponse, currentUserId]);

  const isDesktop = useIsWindowNarrow();

  // If notification tapped, navigate
  useEffect(() => {
    async function goToGroupMembers(groupId: string) {
      navigation.navigate('GroupSettings', {
        screen: 'GroupMembers',
        params: { groupId },
      });
      setNotifToProcess(null);
      return true;
    }

    async function goToUserProfile(userId: string) {
      navigation.navigate('UserProfile', { userId });
      setNotifToProcess(null);
      return true;
    }

    async function goToContacts() {
      navigation.navigate('Contacts', undefined, { pop: true });
      setNotifToProcess(null);
      return true;
    }

    async function gotToChannel(channelId: string, postInfo?: PostInfo | null) {
      const channel = await db.getChannelWithRelations({ id: channelId });
      if (!channel) {
        return false;
      }

      logger.trackEvent(
        AnalyticsEvent.ActionTappedPushNotif,
        logic.getModelAnalytics({ channel })
      );
      startPushNotifTapMeasurement({
        channelId: channel.id,
        initialLastPostId: channel.lastPostId ?? null,
      });

      const routeStack: RouteStack = [{ name: 'ChatList' }];
      if (channel.groupId) {
        const mainGroupRoute = await getMainGroupRoute(
          channel.groupId,
          isDesktop
        );
        // @ts-expect-error - we know we're on mobile and we can't get a "Home" route
        routeStack.push(mainGroupRoute);
      }
      // Only push the channel if it wasn't already handled by the main group stack
      if (routeStack[routeStack.length - 1].name !== 'Channel') {
        const screenName = screenNameFromChannelId(channelId);
        routeStack.push({
          name: screenName,
          params: { channelId: channel.id },
        });
      }

      // if we have a post id, try to navigate to the thread
      if (postInfo) {
        let postToNavigateTo: {
          id: string;
          authorId: string;
          channelId: string;
        } | null = null;

        const post = await db.getPost({ postId: postInfo.id });

        if (post) {
          postToNavigateTo = post;
        } else {
          postToNavigateTo = { ...postInfo, channelId };
        }

        routeStack.push({
          name: 'Post',
          params: {
            postId: postToNavigateTo.id,
            authorId: postToNavigateTo.authorId,
            channelId: postToNavigateTo.channelId,
          },
        });
      }

      const typedReset = createTypedReset(navigation);

      typedReset(routeStack, 1);
      setNotifToProcess(null);
      return true;
    }

    async function syncMissingNotificationTarget(
      data: ProcessableNotificationData,
      preparedDmInviteTarget: boolean
    ) {
      if (!('channelId' in data)) {
        return false;
      }

      switch (
        getMissingNotificationTargetRecovery(data, preparedDmInviteTarget)
      ) {
        case 'singleDmInvite': {
          const result = await ensureDmInviteChannel({
            channelId: data.channelId,
            syncCtx: notificationSyncCtx,
          });
          return result.found;
        }
        case 'dms':
          await syncDms(notificationSyncCtx);
          return true;
        case 'groups':
          await syncGroups(notificationSyncCtx);
          return true;
        case 'none':
          return false;
      }
    }

    if (notifToProcess) {
      const notificationData = notifToProcess;
      const handleNavigate = (() => {
        switch (notificationData.type) {
          case 'groupJoinRequest':
            return () => goToGroupMembers(notificationData.groupId);
          case 'contactMatched':
            return () => goToUserProfile(notificationData.contactId);
          case 'contactsMatched':
            return () => goToContacts();
          case 'dmInvite':
            return () => gotToChannel(notificationData.channelId, null);
          default:
            return () =>
              gotToChannel(
                notificationData.channelId,
                notificationData.postInfo
              );
        }
      })();

      (async () => {
        try {
          let preparedDmInviteTarget = false;
          let canNavigate = true;

          if (notificationData.type === 'dmInvite') {
            preparedDmInviteTarget = true;

            if (notificationData.whomType === 'ship') {
              const result = await ensureDmInviteChannel({
                channelId: notificationData.channelId,
                syncCtx: notificationSyncCtx,
              });
              canNavigate = result.found;
            } else {
              await syncDms(notificationSyncCtx);
            }
          }

          let didNavigate = canNavigate ? await handleNavigate() : false;

          if (!didNavigate) {
            const recovered = await syncMissingNotificationTarget(
              notificationData,
              preparedDmInviteTarget
            );
            didNavigate = recovered ? await handleNavigate() : false;

            // If still not found, clear out the requested channel ID
            if (!didNavigate) {
              if (isTlonEmployee) {
                logger.trackEvent(AnalyticsEvent.ErrorPushNotifNavigate, {
                  routeCategory: getNotificationRouteCategory(notificationData),
                  notificationType: getNotificationType(notificationData),
                });
              }
              setNotifToProcess(null);
            }
          }
        } catch (error) {
          logger.trackError(AnalyticsEvent.ErrorPushNotifNavigate, {
            context: 'Failed to route push notification',
            routeCategory: getNotificationRouteCategory(notificationData),
            notificationType: getNotificationType(notificationData),
            errorKind: error instanceof Error ? error.name : typeof error,
          });
          setNotifToProcess(null);
        }
      })();
    }
  }, [notifToProcess, navigation, isTlonEmployee, isDesktop]);
}
