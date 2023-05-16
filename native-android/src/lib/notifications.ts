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

const setHasRequestedNotifications = (value: boolean) =>
  storage.save({ key: 'hasRequestedNotifications', data: value });

const getHasRegisteredNotifications = async () => {
  try {
    const value = await storage.load<boolean>({
      key: 'hasRegisteredNotifications',
    });
    return value;
  } catch {
    return false;
  }
};

const setHasRegisteredNotifications = (value: boolean) =>
  storage.save({ key: 'hasRegisteredNotifications', data: value });

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
  // Skip if running on emulator
  if (!Device.isDevice && !__DEV__) {
    return false;
  }

  // Fetch statuses from storage
  const [hasRequestedNotifications, hasRegisteredNotifications] =
    await Promise.all([
      getHasRequestedNotifications(),
      getHasRegisteredNotifications(),
    ]);
  console.debug(
    'Already registered for push notifications?',
    hasRegisteredNotifications ? 'Yes' : 'No'
  );

  // Skip if already registered
  if (hasRegisteredNotifications) {
    return true;
  }

  // Fetch current permissions
  let isGranted = false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    isGranted = status === 'granted';
    console.debug('Current push notifications setting:', status);
  } catch (err) {
    console.error('Error reading current push notification setting:', err);
  }

  console.debug(
    'Already asked for notifications permission?',
    hasRequestedNotifications ? 'Yes' : 'No'
  );

  // Skip if permission not granted and already requested permission
  if (!isGranted && hasRequestedNotifications) {
    return false;
  }

  // Request permission
  try {
    const { status: nextStatus } =
      await Notifications.requestPermissionsAsync();
    isGranted = nextStatus === 'granted';
    setHasRequestedNotifications(true);
    console.debug('New push notifications setting:', nextStatus);
  } catch (err) {
    console.error('Error requesting new push notification setting:', err);
  }

  // Skip if permission explicitly not granted
  if (!isGranted) {
    return false;
  }

  // Register for push notifications
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  console.debug('Obtained new push notification token:', token);
  try {
    await connectNotificationProvider(token);
    setHasRegisteredNotifications(true);
    console.debug('Successfully connected notification provider');
    return true;
  } catch (err) {
    console.error('Error connecting notification provider:', err);
    return false;
  }
};

const connectNotificationProvider = async (token: string) => {
  const { api } = useStore.getState();
  if (api) {
    await api.poke({
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
  // Skip notification if user is not logged in
  const { ship } = useStore.getState();
  if (!ship) {
    return;
  }

  const { uid } = notification.data;

  try {
    const yarn = await useHarkState.getState().fetchYarn(uid);
    if (!isYarnValidNotification(yarn)) {
      console.debug('Skipping invalid notification:', yarn);
      return;
    }

    const content = {
      categoryIdentifier: 'message',
      title: await createNotificationTitle(yarn),
      body: createNotificationBody(yarn),
      data: yarn,
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
  } catch (err) {
    console.error('Error fetching yarn details:', err);
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
