import { IS_ANDROID } from '@tloncorp/app/constants';
import { LoadingSpinner } from '@tloncorp/app/ui';
import { type Ref, useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import type WebView from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

export const useWebView = (): WebViewProps & {
  ref: Ref<WebView>;
} => {
  const ref = useRef<WebView>(null);
  const handleBackPressed = useCallback(() => {
    if (!ref.current) {
      return false;
    }

    ref.current.goBack();
    return true; // prevent default behavior (exit app)
  }, []);

  useEffect(() => {
    // Start Android back button listener
    if (IS_ANDROID) {
      BackHandler.addEventListener('hardwareBackPress', handleBackPressed);
    }

    return () => {
      // Clean up listeners
      BackHandler.removeEventListener('hardwareBackPress', handleBackPressed);
    };
  }, [handleBackPressed]);

  const showErrorAlert = () => {
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
            ref.current?.reload();
          },
          style: 'default',
        },
      ],
      { cancelable: true }
    );
  };

  return {
    ref,
    style: { backgroundColor: 'transparent' },
    onHttpError: ({ nativeEvent: { statusCode } }) => {
      if (statusCode > 399) {
        showErrorAlert();
      }
    },
    onError: showErrorAlert,
    onContentProcessDidTerminate: () => ref.current?.reload(),
    renderLoading: () => (
      <View
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner />
      </View>
    ),
    overScrollMode: 'content',
    sharedCookiesEnabled: true,
    scalesPageToFit: true,
    startInLoadingState: true,
    hideKeyboardAccessoryView: true,
    webviewDebuggingEnabled: __DEV__,
  };
};
