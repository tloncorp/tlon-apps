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
import useStore from './state/store';
import * as Notifications from 'expo-notifications';
import { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import useHarkState from './state/hark';
// import { useNotifications } from './notifications/useNotifications';
// import { YarnContentShip } from './types/hark';
import {
  handleNotification,
  handleNotificationResponse,
  pokeNotify,
  registerForPushNotificationsAsync,
  requestNotificationPermissions,
  setMessageCategory
} from './lib/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export default function WebApp() {
  const { shipUrl } = useStore();
  const tailwind = useTailwind();
  const [fcmDeviceToken, setFcmDeviceToken] = useState('');
  const webviewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);
  // const loaded = useHarkState(s => s.loaded);
  // const { count, unreadNotifications } = useNotifications('');
  // const hasUnreads = count > 0;

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
    requestNotificationPermissions();
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

    registerForPushNotificationsAsync().then((response) => {
      if (!response) {
        return;
      }
      const { token, expoToken } = response;
      console.log({token, expoToken})
      setFcmDeviceToken(token);
    });

    const notificationSubscription =
      Notifications.addNotificationReceivedListener(handleNotification);

    const initialize = async () => {
      await useHarkState.getState().start();
    };

    setMessageCategory();

    const notificationResponseReceivedSubscription =
      Notifications.addNotificationResponseReceivedListener(response => {
        handleNotificationResponse(response, webviewRef);
      });

    initialize();

    return () => {
      if (notificationSubscription) notificationSubscription.remove();
      if (notificationResponseReceivedSubscription)
        notificationResponseReceivedSubscription.remove();
      BackHandler.removeEventListener('hardwareBackPress', handleBackPressed);
      listener.remove();
    };
  }, []);

  useEffect(() => {
    if (fcmDeviceToken) {
      pokeNotify(fcmDeviceToken);
    }
  }, [fcmDeviceToken]);

  // useEffect(() => {
  // if (loaded && hasUnreads) {
  // unreadNotifications.forEach(n => {
  // const content = n.bins[0].topYarn.con;
  // const ship = (content[0] as YarnContentShip).ship;
  // const title = `New message from ${ship}`;
  // const body = content[2] as string;
  // const rope = n.bins[0].topYarn.rope;
  // Notifications.scheduleNotificationAsync({
  // content: {
  // title,
  // body,
  // categoryIdentifier: 'message'
  // },
  // trigger: null,
  // identifier: JSON.stringify({ ship, rope })
  // });
  // });
  // }
  // }, [loaded, hasUnreads, unreadNotifications]);

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
