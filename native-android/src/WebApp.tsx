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
import { WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';

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

  const handleUrlError = useCallback((event: WebViewHttpErrorEvent) => {
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
  }, []);

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

  return (
    <SafeAreaView style={tailwind('flex-1')}>
      <WebView
        source={{ uri: `${shipUrl}/apps/talk` }}
        ref={webviewRef}
        androidHardwareAccelerationDisabled={false}
        onHttpError={handleUrlError}
        sharedCookiesEnabled
        scalesPageToFit
      />
    </SafeAreaView>
  );
}
