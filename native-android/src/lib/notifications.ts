import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import WebView from 'react-native-webview';
import useHarkState from '../state/hark';
import useStore from '../state/store';
import storage from './storage';
import {
  BACKGROUND_NOTIFICATION_TASK,
  NOTIFY_PROVIDER,
  NOTIFY_SERVICE,
} from '../constants';
import type { Yarn } from '../types/hark';
import * as TaskManager from 'expo-task-manager';
import {
  isYarnClub,
  isYarnContentEmphasis,
  isYarnContentShip,
  isYarnGroup,
  isYarnValidNotification,
  parseYarnChannelId,
} from './hark';
import useChatState from '../state/chat';
import useContactState from '../state/contact';
import useGroupsState from '../state/groups';

type NotificationPayload = {
  notification: {
    data: {
      uid: string;
    };
  };
};

const getHasRequestedNotifications = async () => {
  try {
    const value = await storage.load<boolean>({
      key: 'hasRequestedNotifications',
    });
    return value;
  } catch {
    return false;
  }
};

const setHasRequestedNotifications = (value: boolean) => {
  storage.save({ key: 'hasRequestedNotifications', data: value });
};

export const initNotifications = async () => {
  // Handle receiving notifications while app is in background
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
    if (error) {
      console.error('Error in background notification task:', error);
    }

    if (data) {
      handleNotification(data as NotificationPayload);
    }
  });
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

  // Handle receiving notifications while app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Set up notification categories
  await Notifications.setNotificationCategoryAsync('message', [
    {
      identifier: 'markAsRead',
      buttonTitle: 'Mark As Read',
      options: {
        opensAppToForeground: false,
      },
    },
    // {
    //   identifier: 'reply',
    //   buttonTitle: 'Reply',
    //   textInput: {
    //     placeholder: 'Type your reply...',
    //     submitButtonTitle: 'Send',
    //   },
    // }
  ]);

  // Set up notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
};

export const connectNotifications = async () => {
  if (!Device.isDevice) {
    return false;
  }

  const hasRequestedNotifications = await getHasRequestedNotifications();
  console.debug(
    'Already asked for notifications permission?',
    hasRequestedNotifications ? 'Yes' : 'No'
  );

  try {
    const { status } = await Notifications.getPermissionsAsync();
    console.debug('Current push notifications setting:', status);

    const isGranted = status === 'granted';
    if (hasRequestedNotifications || isGranted) {
      setHasRequestedNotifications(true);
      return isGranted;
    }
  } catch (err) {
    console.error('Error reading current push notification setting:', err);
  }

  try {
    const { status: nextStatus } =
      await Notifications.requestPermissionsAsync();
    console.debug('New push notifications setting:', nextStatus);

    setHasRequestedNotifications(true);
    if (nextStatus !== 'granted') {
      return false;
    }
  } catch (err) {
    console.error('Error requesting new push notification setting:', err);
    return false;
  }

  const { data: token } = await Notifications.getDevicePushTokenAsync();
  console.debug('Obtained new push notification token:', token);
  await connectNotificationProvider(token);

  return true;
};

const connectNotificationProvider = async (token: string) => {
  const { api } = useStore.getState();
  if (api) {
    const result = await api.poke({
      app: 'notify',
      mark: 'notify-client-action',
      json: {
        'connect-provider-with-binding': {
          who: NOTIFY_PROVIDER,
          service: NOTIFY_SERVICE,
          address: token,
          binding: Platform.OS === 'android' ? 'fcm' : 'apn',
        },
      },
    });
    console.debug('Connected notify client provider with result:', result);
  } else {
    console.error('Error connecting notify client provider: no api found');
  }
};

const createNotificationTitle = async (yarn: Yarn) => {
  const channelId = parseYarnChannelId(yarn);
  if (!channelId) {
    return undefined;
  }

  if (isYarnClub(yarn)) {
    const club = await useChatState.getState().fetchClub(channelId);
    return club.meta.title;
  }

  if (isYarnGroup(yarn)) {
    const groupChannel = await useGroupsState
      .getState()
      .fetchGroupChannel(channelId);
    return groupChannel?.meta.title ?? channelId.replace('chat/', '');
  }

  const contact = await useContactState.getState().fetchContact(channelId);
  return contact?.nickname ?? channelId;
};

const createNotificationBody = (yarn: Yarn) => {
  const parts = yarn.con.map((content) => {
    if (isYarnContentShip(content)) {
      return content.ship;
    }

    if (isYarnContentEmphasis(content)) {
      return content.emph;
    }

    return content;
  });

  // TODO: Clean up prefixes and separators
  return parts.join('');
};

export const handleNotification = async ({
  notification,
}: NotificationPayload) => {
  const { uid } = notification.data;
  let title: string | undefined;
  let body: string | undefined;
  let data: Record<string, any> = {};

  try {
    const yarn = await useHarkState.getState().fetchYarn(uid);
    if (!isYarnValidNotification(yarn)) {
      console.debug('Skipping invalid notification:', yarn);
      return;
    }

    title = await createNotificationTitle(yarn);
    body = createNotificationBody(yarn);
    data = yarn;
  } catch (err) {
    console.error('Error fetching yarn details:', err);
  }

  const content = {
    categoryIdentifier: 'message',
    title: title ?? 'You have received a new message',
    body,
    data,
  };

  if (Device.isDevice) {
    await Notifications.scheduleNotificationAsync({
      identifier: uid,
      content,
      trigger: null,
    });
  } else {
    console.log(content);
  }
};

export const handleNotificationResponse = (
  response: Notifications.NotificationResponse,
  webviewRef: React.RefObject<WebView>
) => {
  try {
    const { shipUrl } = useStore.getState();
    const {
      actionIdentifier,
      notification: {
        request: {
          identifier,
          content: { data },
        },
      },
    } = response;
    const { wer, rope } = data as Yarn;
    switch (actionIdentifier) {
      case 'markAsRead':
        useHarkState.getState().sawRope(rope);
        Notifications.dismissNotificationAsync(identifier);
        break;
      // case 'reply':
      //   // TODO: handle response.userText
      //   break;
      default:
        webviewRef?.current?.injectJavaScript(
          `window.location.href = '${shipUrl}/apps/talk${wer}';`
        );
        break;
    }
  } catch (err) {
    console.error('Error handling notification response:', err);
  }
};
