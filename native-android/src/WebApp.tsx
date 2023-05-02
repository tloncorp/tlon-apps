import { useCallback, useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import {
  SafeAreaView,
  AppState,
  AppStateStatus,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import { useTailwind } from 'tailwind-rn';
import useStore from './state/store';
import * as Notifications from 'expo-notifications';
import { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import {
  handleNotification,
  handleNotificationResponse,
  initializePushNotifications,
} from './lib/notifications';

export default function WebApp() {
  const { shipUrl } = useStore();
  const tailwind = useTailwind();
  const webviewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);
  const notificationSubscription = useRef<Notifications.Subscription | null>(
    null
  );
  const notificationResponseSubscription =
    useRef<Notifications.Subscription | null>(null);

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
            style: 'cancel',
          },
          {
            text: 'Refresh',
            onPress: () => {
              webviewRef?.current?.reload();
            },
            style: 'default',
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      webviewRef?.current?.injectJavaScript('window.bootstrapApi(true)');
    }

    appState.current = nextAppState;
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBackPressed);
    }

    const listener = AppState.addEventListener('change', handleAppStateChange);

    (async () => {
      // useHarkState.getState().start()
      const enabled = await initializePushNotifications();
      if (enabled) {
        notificationSubscription.current =
          Notifications.addNotificationReceivedListener(handleNotification);
        console.debug('Started notification listener');

        notificationResponseSubscription.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
            handleNotificationResponse(response, webviewRef);
          });
        console.debug('Started notification response listener');
      }
    })();

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPressed);
      listener.remove();

      if (notificationSubscription.current) {
        Notifications.removeNotificationSubscription(
          notificationSubscription.current
        );
        console.debug('Removed notification listener');
      }

      if (notificationResponseSubscription.current) {
        Notifications.removePushTokenSubscription(
          notificationResponseSubscription.current
        );
        console.debug('Removed notification response listener');
      }
    };
  }, []);

  return (
    <SafeAreaView style={tailwind('flex-1')}>
      <WebView
        source={{ uri: `${shipUrl}/apps/talk/` }}
        ref={webviewRef}
        onHttpError={handleUrlError}
        sharedCookiesEnabled
        scalesPageToFit
      />
    </SafeAreaView>
  );
}
