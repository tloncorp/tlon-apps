import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { connectNotifications } from '@tloncorp/app/lib/notifications';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import {
  createTypedReset,
  getMainGroupRoute,
  screenNameFromChannelId,
} from '@tloncorp/app/navigation/utils';
import { useIsWindowNarrow } from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  createDevLogger,
  syncDms,
  syncGroups,
} from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as ub from '@tloncorp/shared/urbit';
import { ActivityIncomingEvent } from '@tloncorp/shared/urbit';
import { Notification, useLastNotificationResponse } from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const logger = createDevLogger('useNotificationListener', false);

type RouteStack = {
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
}[];

interface BaseNotificationData {
  meta: { errorsFromExtension?: unknown };
}
interface PostInfo {
  id: string;
  authorId: string;
  isDm: boolean;
}
interface MinimalNotificationData extends BaseNotificationData {
  type?: undefined;
  channelId: string;
  postInfo: PostInfo | null;
}
interface UnrecognizedNotificationData extends BaseNotificationData {
  type: 'unrecognized';
}

interface GroupJoinRequestNotificationData extends BaseNotificationData {
  type: 'groupJoinRequest';
  groupId: string;
}

type NotificationData =
  | MinimalNotificationData
  | GroupJoinRequestNotificationData
  | UnrecognizedNotificationData;

function payloadFromNotification(
  notification: Notification
): NotificationData | null {
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

  if (payload == null || typeof payload !== 'object') {
    return null;
  }

  const baseNotificationData: BaseNotificationData = {
    meta: { errorsFromExtension: payload.notificationServiceExtensionErrors },
  };
  if (
    payload.activityEventJsonString != null &&
    typeof payload.activityEventJsonString === 'string'
  ) {
    const { event: ev } = JSON.parse(payload.activityEventJsonString) as {
      event: ub.ActivityEvent;
    };
    const is = ActivityIncomingEvent.is;

    const authorAndId = (id: string) => ({
      id: api.getCanonicalPostId(id),
      authorId: ub.getIdParts(id).author,
    });

    const dmTarget = (
      info: Pick<ub.DmPostEvent['dm-post'], 'whom'>,
      { parent }: { parent?: ub.DmReplyEvent['dm-reply']['parent'] } = {}
    ) => ({
      ...baseNotificationData,
      channelId: 'ship' in info.whom ? info.whom.ship : 'unknown',
      postInfo:
        parent == null
          ? null
          : {
              ...authorAndId(parent.id),
              isDm: false,
            },
    });
    const channelPostTarget = (
      info: Pick<ub.PostEvent['post'], 'channel'>,
      { parent }: { parent?: ub.ReplyEvent['reply']['parent'] } = {}
    ) => ({
      ...baseNotificationData,
      channelId: info.channel,
      postInfo:
        parent == null
          ? null
          : {
              ...authorAndId(parent.id),
              isDm: false,
            },
    });

    const groupAskTarget = (info: { group: string }): NotificationData => {
      return {
        ...baseNotificationData,
        type: 'groupJoinRequest',
        groupId: info.group,
      };
    };

    switch (true) {
      case is(ev, 'dm-post'):
        return dmTarget(ev['dm-post']);

      case is(ev, 'dm-reply'):
        return dmTarget(ev['dm-reply']);

      case is(ev, 'post'):
        return channelPostTarget(ev.post);

      case is(ev, 'reply'):
        return channelPostTarget(ev.reply, { parent: ev.reply.parent });

      case is(ev, 'group-ask'):
        return groupAskTarget(ev['group-ask']);
      case is(ev, 'dm-invite'):
      // fallthrough
      case is(ev, 'group-join'):
      // fallthrough
      case is(ev, 'group-kick'):
      // fallthrough
      case is(ev, 'group-invite'):
      // fallthrough
      case is(ev, 'group-role'):
      // fallthrough
      case is(ev, 'flag-post'):
      // fallthrough
      case is(ev, 'contact'):
      // fallthrough
      case is(ev, 'flag-reply'):
        return null;

      default: {
        return ((_x: never) => {
          throw new Error(`Unexpected activity event: ${ev}`);
        })(ev);
      }
    }
  }

  return {
    ...baseNotificationData,
    type: 'unrecognized',
  };
}

export default function useNotificationListener() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isTlonEmployee = db.isTlonEmployee.useValue();

  const [notifToProcess, setNotifToProcess] = useState<
    MinimalNotificationData | GroupJoinRequestNotificationData | null
  >(null);

  // Start notifications prompt
  useEffect(() => {
    connectNotifications();
  }, []);

  const notificationResponse = useLastNotificationResponse();
  useEffect(() => {
    if (notificationResponse != null) {
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
          properties: isTlonEmployee
            ? notificationResponse.notification.request
            : undefined,
        });
        return;
      }

      setNotifToProcess(data);
    }
  }, [notificationResponse, isTlonEmployee]);

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

    async function gotToChannel(channelId: string, postInfo?: PostInfo | null) {
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
    }

    if (notifToProcess) {
      const handleNavigate =
        notifToProcess.type === 'groupJoinRequest'
          ? () => goToGroupMembers(notifToProcess.groupId)
          : () =>
              gotToChannel(notifToProcess.channelId, notifToProcess.postInfo);

      (async () => {
        // First check if we have this channel in local store
        let didNavigate = await handleNavigate();

        // If not, sync from source and try again
        if (!didNavigate) {
          await Promise.all([syncDms(), syncGroups()]);

          didNavigate = await handleNavigate();

          // If still not found, clear out the requested channel ID
          if (!didNavigate) {
            if (isTlonEmployee) {
              logger.trackEvent(AnalyticsEvent.ErrorPushNotifNavigate);
            }
            setNotifToProcess(null);
          }
        }
      })();
    }
  }, [notifToProcess, navigation, isTlonEmployee, isDesktop]);
}
