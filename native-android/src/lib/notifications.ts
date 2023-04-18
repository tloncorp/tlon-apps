import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import WebView from 'react-native-webview';
import useHarkState from '../state/hark';
import useStore from '../state/store';

export const initializePushNotifications = async () => {
  if (!Device.isDevice) {
    return false;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });

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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C'
    });
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    console.debug("Current push notifications setting:", status);
    if (false) { // check if not first run
      return status === 'granted';
    }
  } catch (err) {
    console.error("Error reading current push notification setting:", err);
  }

  try {
    const { status: nextStatus } = await Notifications.requestPermissionsAsync();
    console.debug("New push notifications setting:", nextStatus);
    if (nextStatus !== 'granted') {
      return false;
    }
  } catch (err) {
    console.error("Error requesting new push notification setting:", err);
    return false;
  }

  const { data: token } = await Notifications.getDevicePushTokenAsync();
  console.debug("Obtained new push notification token:", token);
  await pokeNotify(token);

  return true;
}

export const pokeNotify = async (token: string) => {
  const api = useStore.getState().api;
  await api?.poke({
    app: 'notify',
    mark: 'notify-client-action',
    json: {
      'connect-provider': {
        who: 'tilpyl-nodnys-sapdex-diflyx',
        service: 'android',
        address: token,
        binding: Platform.OS === 'android' ? 'fcm' : 'apn',
      }
    }
  });
};

export const handleNotification = async (
  notification: Notifications.Notification
) => {
  const { identifier, content } = notification.request;
  console.log("Handling notification", identifier, content.data);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      categoryIdentifier: "message",
      title: "You received a new message",
      // data: { data: 'goes here' },
    },
    trigger: null,
  });
};

export const handleNotificationResponse = (
  response: Notifications.NotificationResponse,
  webviewRef: React.RefObject<WebView>
) => {
  const { shipUrl } = useStore.getState();
  const action = response.actionIdentifier;
  const identifier = JSON.parse(response.notification.request.identifier);
  const { rope } = identifier;
  switch (action) {
    case 'reply':
      const url = `${shipUrl}/apps/talk${rope.thread}`;
      webviewRef?.current?.injectJavaScript(`window.location.href = '${url}';`);
      break;
    case 'dismiss':
      useHarkState.getState().sawRope(rope);
      break;
    default:
      console.warn("Receiving unknown notification response action:", response);
      break;
  }
};
