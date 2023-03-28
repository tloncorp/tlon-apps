import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import WebView from 'react-native-webview';
import useHarkState from '../state/hark';
import useStore from '../state/store';

export async function registerForPushNotificationsAsync() {
  let token;
  let expoToken;
  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getDevicePushTokenAsync()).data;
    expoToken = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    });
  }

  return { token, expoToken };
}

export const setMessageCategory = async () => {
  await Notifications.setNotificationCategoryAsync('message', [
    {
      identifier: 'reply',
      buttonTitle: 'Reply',
      options: {
        opensAppToForeground: true
      }
    },
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: {
        opensAppToForeground: false
      }
    }
  ]);
};

export const pokeNotify = async (token: string) => {
  const api = useStore.getState().api;

  if (api) {
    await api.poke({
      app: 'notify',
      mark: 'notify-client-action',
      json: {
        'connect-provider': {
          who: `dilreb-dapbel-finned-palmer`,
          service: 'android',
          address: token,
          binding: 'fcm'
        }
      }
    });
  }
};

export const requestNotificationPermissions = async () => {
  await Notifications.requestPermissionsAsync();
};

export const handleNotification = (
  notification: Notifications.Notification
) => {
  console.log({ notification });
};

export const handleNotificationResponse = (
  response: Notifications.NotificationResponse,
  webviewRef: React.RefObject<WebView>
) => {
  const { shipUrl } = useStore.getState();
  const action = response.actionIdentifier;
  const identifier = JSON.parse(response.notification.request.identifier);
  const { rope } = identifier;
  if (action === 'reply') {
    const url = `${shipUrl}/apps/talk${rope.thread}`;
    webviewRef?.current?.injectJavaScript(`window.location.href = '${url}';`);
  }

  if (action === 'dismiss') {
    useHarkState.getState().sawRope(rope);
  }
};
