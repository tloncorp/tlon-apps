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
import type { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import {
  handleNotificationResponse,
  connectNotifications,
} from './lib/notifications';
import useContactState from './state/contact';
import useGroupsState from './state/groups';

export default function WebApp() {
  const { shipUrl } = useStore();
  const tailwind = useTailwind();
  const webviewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);
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
    // Start back button listener
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBackPressed);
    }

    // Start app state change listener
    const listener = AppState.addEventListener('change', handleAppStateChange);

    // Start notification response listener
    notificationResponseSubscription.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response, webviewRef);
      });

    // Start notification prompt
    connectNotifications();

    // Fetch initial data
    useContactState.getState().fetchAll();
    useGroupsState.getState().fetchAll();

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPressed);
      listener.remove();

      if (notificationResponseSubscription.current) {
        Notifications.removePushTokenSubscription(
          notificationResponseSubscription.current
        );
      }
    };
  }, []);

  return (
    <WebView
      source={{ uri: `${shipUrl}/apps/talk/` }}
      ref={webviewRef}
      onHttpError={handleUrlError}
      sharedCookiesEnabled
      scalesPageToFit
    />
  );
}
