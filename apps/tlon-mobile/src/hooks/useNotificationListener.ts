import crashlytics from '@react-native-firebase/crashlytics';
import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useAppStatusChange } from '@tloncorp/app/hooks/useAppStatusChange';
import { useFeatureFlag } from '@tloncorp/app/lib/featureFlags';
import { connectNotifications } from '@tloncorp/app/lib/notifications';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import {
  createTypedReset,
  getMainGroupRoute,
  screenNameFromChannelId,
} from '@tloncorp/app/navigation/utils';
import * as posthog from '@tloncorp/app/utils/posthog';
import {
  AnalyticsEvent,
  createDevLogger,
  syncDms,
  syncGroups,
} from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { markChatRead } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as ub from '@tloncorp/shared/urbit';
import { whomIsDm, whomIsMultiDm } from '@tloncorp/shared/urbit';
import { useIsWindowNarrow } from '@tloncorp/ui';
import {
  Notification,
  addNotificationResponseReceivedListener,
  getPresentedNotificationsAsync,
} from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';

const logger = createDevLogger('useNotificationListener', false);

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
  post?: db.Post;
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
    const postInfo = api.getPostInfoFromWer(payload.wer);
    const handoffPost: db.Post | undefined = (() => {
      const dmPost = payload.dmPost as ub.DmPostEvent['dm-post'] | undefined;
      if (dmPost != null) {
        return db.postFromDmPostActivityEvent(dmPost);
      }
      const post = payload.post as ub.PostEvent['post'] | undefined;
      if (post != null) {
        return db.postFromPostActivityEvent(post);
      }
      return undefined;
    })();
    return {
      ...baseNotificationData,
      type: 'wer',
      channelId: payload.channelId,
      postInfo,
      wer: payload.wer,
      post: handoffPost,
    };
  }
  return {
    ...baseNotificationData,
    type: 'unrecognized',
  };
}

export default function useNotificationListener() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isTlonEmployee = db.isTlonEmployee.useValue();
  const [channelSwitcherEnabled] = useFeatureFlag('channelSwitcher');

  const [notifToProcess, setNotifToProcess] =
    useState<WerNotificationData | null>(null);

  const handoffDataFrom = useHandoffNotificationData();

  // Start notifications prompt
  useEffect(() => {
    connectNotifications();
  }, []);

  useEffect(() => {
    // Start notification tap listener
    // This only seems to get triggered on iOS. Android handles the tap and other intents in native code.
    const notificationTapListener = addNotificationResponseReceivedListener(
      (response) => {
        handoffDataFrom([response.notification]);

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
  }, [navigation, isTlonEmployee, handoffDataFrom]);

  const isDesktop = useIsWindowNarrow();

  // If notification tapped, push channel on stack
  useEffect(() => {
    if (notifToProcess && notifToProcess.channelId) {
      const { channelId, postInfo } = notifToProcess;
      const goToChannel = async () => {
        const channel = await db.getChannelWithRelations({ id: channelId });
        if (!channel) {
          return false;
        }

        logger.trackEvent(
          AnalyticsEvent.ActionTappedPushNotif,
          logic.getModelAnalytics({ channel })
        );

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
              logger.trackEvent(
                AnalyticsEvent.ErrorPushNotifNavigate,
                logic.getModelAnalytics({ channel: { id: channelId } })
              );
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
  }, [
    notifToProcess,
    navigation,
    isTlonEmployee,
    channelSwitcherEnabled,
    isDesktop,
  ]);
}

function useHandoffNotificationData() {
  const handoffDataFrom = useCallback(async (notifications: Notification[]) => {
    const handoffPosts = notifications.flatMap((notification) => {
      const data = payloadFromNotification(notification);
      if (data == null || data.type === 'unrecognized' || data.post == null) {
        return [];
      }
      return [data.post];
    });

    if (handoffPosts.length > 0) {
      await db.insertUnconfirmedPosts({ posts: handoffPosts });
    }
  }, []);

  // take data from presented notifications
  const handoffFromPresentedNotifications = useCallback(async () => {
    handoffDataFrom(await getPresentedNotificationsAsync());
  }, [handoffDataFrom]);

  // take data on launch
  useEffect(() => {
    handoffFromPresentedNotifications().catch((e) => {
      logger.error('Failed to slurp handoffs:', e);
    });
  }, [handoffFromPresentedNotifications]);

  // take data on each app resume
  useAppStatusChange(
    useCallback(
      async (status) => {
        if (status === 'active') {
          await handoffFromPresentedNotifications();
        }
      },
      [handoffFromPresentedNotifications]
    )
  );

  return handoffDataFrom;
}
