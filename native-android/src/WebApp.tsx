import { useCallback, useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import {
  SafeAreaView,
  AppState,
  AppStateStatus,
  BackHandler,
  Platform,
  Alert
} from 'react-native';
import { useTailwind } from 'tailwind-rn';
import * as Device from 'expo-device';
import useStore from './state/store';
import * as Notifications from 'expo-notifications';
import { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import useHarkState from './state/hark';
import { useNotifications } from './notifications/useNotifications';
import { YarnContentShip } from './types/hark';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

Notifications.registerTaskAsync('HANDLE_NOTIFICATION_BACKGROUND');

async function registerForPushNotificationsAsync() {
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
    token = (await Notifications.getExpoPushTokenAsync()).data;
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

export default function WebApp() {
  const { shipUrl } = useStore();
  const tailwind = useTailwind();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] =
    useState<Notifications.Notification>();
  const webviewRef = useRef<WebView>(null);
  const notificationListener =
    useRef<ReturnType<typeof Notifications.addNotificationReceivedListener>>();
  const responseListener =
    useRef<
      ReturnType<typeof Notifications.addNotificationResponseReceivedListener>
    >();
  const appState = useRef(AppState.currentState);
  const loaded = useHarkState(s => s.loaded);
  const { count, unreadNotifications } = useNotifications('');
  const hasUnreads = count > 0;

  const handleBackPressed = useCallback(() => {
    if (webviewRef?.current) {
      webviewRef.current?.goBack();
      return true; // prevent default behavior (exit app)
    }
    return false;
  }, [webviewRef.current]);

  const handleUrlError = (event: WebViewHttpErrorEvent) => {
    if (event.nativeEvent.statusCode > 399) {
      Alert.alert(
        'Error',
        'There was an error loading the page. Please check your server and try again.',
        [
          {
            text: 'Cancel',
            onPress: () => null,
            style: 'cancel'
          },
          {
            text: 'Refresh',
            onPress: () => {
              webviewRef?.current?.reload();
            },
            style: 'default'
          }
        ],
        { cancelable: true }
      );
    }
  };

  useEffect(() => {
    registerForPushNotificationsAsync().then(
      token => token && setExpoPushToken(token)
    );

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log(response);
      });

    const initialize = async () => {
      await useHarkState.getState().start();
    };

    const setMessageCategory = async () => {
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

    setMessageCategory();

    const pokeNotify = async () => {
      const api = useStore.getState().api;

      if (api) {
        await api.poke({
          app: 'notify',
          mark: 'notify-client-action',
          json: {
            'connect-provider': {
              who: `~${window.ship}`,
              service: 'talk-android',
              address: 'token'
            }
          }
        });
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const action = response.actionIdentifier;
        const identifier = JSON.parse(response.notification.request.identifier);
        const { rope } = identifier;
        if (action === 'reply') {
          const url = `${shipUrl}/apps/talk${rope.thread}`;
          webviewRef?.current?.injectJavaScript(
            `window.location.href = '${url}';`
          );
        }

        if (action === 'dismiss') {
          useHarkState.getState().sawRope(rope);
        }
      }
    );

    initialize();

    return () => {
      subscription.remove();
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    if (loaded && hasUnreads) {
      unreadNotifications.forEach(n => {
        const content = n.bins[0].topYarn.con;
        const ship = (content[0] as YarnContentShip).ship;
        const title = `New message from ${ship}`;
        const body = content[2] as string;
        const rope = n.bins[0].topYarn.rope;
        Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            categoryIdentifier: 'message'
          },
          trigger: null,
          identifier: JSON.stringify({ ship, rope })
        });
      });
    }
  }, [loaded, hasUnreads, unreadNotifications]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBackPressed);
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        webviewRef?.current?.injectJavaScript('window.bootstrapApi(true)');
      }

      appState.current = nextAppState;
    };

    const listener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPressed);
      listener.remove();
    };
  }, []);

  useEffect(() => {
    // Request notification permissions
    const requestPermissions = async () => {
      await Notifications.requestPermissionsAsync();
    };

    requestPermissions();
  }, []);

  return (
    <SafeAreaView style={tailwind('flex-1')}>
      <WebView
        source={{ uri: `${shipUrl}/apps/talk/` }}
        ref={webviewRef}
        androidHardwareAccelerationDisabled={false}
        onHttpError={handleUrlError}
        sharedCookiesEnabled
        scalesPageToFit
      />
    </SafeAreaView>
  );
}
