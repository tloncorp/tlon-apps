import crashlytics from '@react-native-firebase/crashlytics';
import type { NavigationProp } from '@react-navigation/native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useFeatureFlag } from '@tloncorp/app/lib/featureFlags';
import { connectNotifications } from '@tloncorp/app/lib/notifications';
import * as posthog from '@tloncorp/app/utils/posthog';
import { syncDms, syncGroups } from '@tloncorp/shared';
import { markChatRead } from '@tloncorp/shared/dist/api';
import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { whomIsDm, whomIsMultiDm } from '@tloncorp/shared/dist/urbit';
import {
  Notification,
  addNotificationResponseReceivedListener,
} from 'expo-notifications';
import { useEffect, useState } from 'react';

import { RootStackParamList } from '../types';

type RouteStack = {
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
}[];

interface BaseNotificationData {
  meta: { errorsFromExtension?: unknown };
}
interface WerNotificationData extends BaseNotificationData {
  type: 'wer';
  channelId: string;
  postInfo: { id: string; authorId: string; isDm: boolean } | null;
  wer: string;
}
interface UnrecognizedNotificationData extends BaseNotificationData {
  type: 'unrecognized';
}

type NotificationData = WerNotificationData | UnrecognizedNotificationData;

function payloadFromNotification(
  notification: Notification
): NotificationData | null {
  // When a notification is received directly (i.e. is not mutated via
  // notification service extension), the payload is delivered in the
  // `content`. When "triggered" through the NSE, the payload is in the
  // `trigger`.
  // Detect and use whatever payload is available.
  const payload =
    notification.request.trigger.type === 'push'
      ? notification.request.trigger.payload
      : notification.request.content.data;

  if (payload == null || typeof payload !== 'object') {
    return null;
  }

  const baseNotificationData: BaseNotificationData = {
    meta: { errorsFromExtension: payload.notificationServiceExtensionErrors },
  };

  // welcome to my validation library ;)
  if (payload.wer != null && payload.channelId != null) {
    return {
      ...baseNotificationData,
      type: 'wer',
      channelId: payload.channelId,
      postInfo: api.getPostInfoFromWer(payload.wer),
      wer: payload.wer,
    };
  }
  return {
    ...baseNotificationData,
    type: 'unrecognized',
  };
}

export default function useNotificationListener() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { data: isTlonEmployee } = store.useIsTlonEmployee();
  const [channelSwitcherEnabled] = useFeatureFlag('channelSwitcher');

  const [notifToProcess, setNotifToProcess] =
    useState<WerNotificationData | null>(null);

  // Start notifications prompt
  useEffect(() => {
    connectNotifications();
  }, []);

  useEffect(() => {
    // Start notification tap listener
    // This only seems to get triggered on iOS. Android handles the tap and other intents in native code.
    const notificationTapListener = addNotificationResponseReceivedListener(
      (response) => {
        const data = payloadFromNotification(response.notification);

        // If the NSE caught an error, it puts it in a list under
        // `notificationServiceExtensionErrors` - slurp em and log.
        //
        // NB: This will only log errors on tapped notifications - we could use
        // `getPresentedNotificationsAsync` to log all notifications' errors,
        // but we don't have a good way to prevent logging the same
        // notification multiple times.
        const errorsFromExtension = data?.meta.errorsFromExtension;
        if (errorsFromExtension != null) {
          posthog.trackError({
            message: 'Notification service extension forwarded an error:',
            properties: { errors: errorsFromExtension },
          });
        }

        if (data == null || data.type === 'unrecognized') {
          // https://linear.app/tlon/issue/TLON-2551/multiple-notifications-that-lead-to-nowhere-crash-app
          // We're seeing cases where `data` is null here - not sure why this is happening.
          // Log the notification and don't try to navigate.
          posthog.trackError({
            message: 'Failed to get notification payload',
            properties: isTlonEmployee
              ? response.notification.request
              : undefined,
          });
          return;
        }

        const { actionIdentifier, userText } = response;
        if (actionIdentifier === 'markAsRead' && data.channelId) {
          markChatRead(data.channelId);
        } else if (actionIdentifier === 'reply' && userText) {
          // TODO: this is unhandled, when is actionIdentifier = reply?
        } else if (data.channelId) {
          setNotifToProcess(data);
        }
      }
    );

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [navigation, isTlonEmployee]);

  // If notification tapped, push channel on stack
  useEffect(() => {
    if (notifToProcess && notifToProcess.channelId) {
      const { channelId, postInfo } = notifToProcess;
      const goToChannel = async () => {
        const channel = await db.getChannelWithRelations({ id: channelId });
        if (!channel) {
          return false;
        }

        const routeStack: RouteStack = [{ name: 'ChatList' }];
        if (channel.group && !channelSwitcherEnabled) {
          routeStack.push({
            name: 'GroupChannels',
            params: { group: channel.group },
          });
        }
        routeStack.push({ name: 'Channel', params: { channel } });

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

          routeStack.push({ name: 'Post', params: { post: postToNavigateTo } });
        }

        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: routeStack,
          })
        );
        setNotifToProcess(null);
        return true;
      };

      (async () => {
        // First check if we have this channel in local store
        let didNavigate = await goToChannel();

        // If not, sync from source and try again
        if (!didNavigate) {
          if (whomIsDm(channelId) || whomIsMultiDm(channelId)) {
            await syncDms();
          } else {
            await syncGroups();
          }

          didNavigate = await goToChannel();

          // If still not found, clear out the requested channel ID
          if (!didNavigate) {
            if (isTlonEmployee) {
              crashlytics().log(`failed channel ID: ${channelId}`);
              crashlytics().log(`failed post ID: ${postInfo?.id}`);
            }
            crashlytics().recordError(
              new Error(
                `Notification listener: failed to navigate to ${postInfo?.isDm ? 'DM ' : ''}channel ${postInfo?.id ? ' thread' : ''}`
              )
            );
            setNotifToProcess(null);
          }
        }
      })();
    }
  }, [notifToProcess, navigation, isTlonEmployee, channelSwitcherEnabled]);
}
