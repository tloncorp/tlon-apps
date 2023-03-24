import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import useStore from '../state/store';

export async function registerForPushNotificationsAsync() {
  let token;
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
    console.log(token);
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

  return token;
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
          who: `rivfur-livmet`,
          service: 'pocket-dev',
          address: token
        }
      }
    });
  }
};

export const requestNotificationPermissions = async () => {
  await Notifications.requestPermissionsAsync();
};
