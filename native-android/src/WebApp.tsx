import { useCallback, useEffect, useRef } from 'react';
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
  const webviewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);

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

  const handleWebviewMessage = (event: any) => {
    const { data } = event.nativeEvent;
    const { type, payload } = JSON.parse(data);
    if (type === 'notification') {
      const { date, latest, bins } = payload;
      const topYarn = bins[0].topYarn;
      const content = topYarn.con;
      const desk = topYarn.rope.desk;
      if (desk === 'talk') {
        const title = `New message from ${content[0].ship}`;
        const body = content[2];
        console.log({ title, body });
        Notifications.scheduleNotificationAsync({
          content: {
            title,
            body
          },
          trigger: null
        });
        webviewRef?.current?.postMessage(
          JSON.stringify({ type: 'hark-read', payload: topYarn.rope })
        );
      }
    }
  };

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

  console.log({ shipUrl });

  return (
    <SafeAreaView style={tailwind('flex-1')}>
      <WebView
        source={{ uri: `${shipUrl}/apps/talk/` }}
        ref={webviewRef}
        androidHardwareAccelerationDisabled={false}
        onHttpError={handleUrlError}
        onMessage={handleWebviewMessage}
        sharedCookiesEnabled
        scalesPageToFit
      />
    </SafeAreaView>
  );
}
