import { type Ref, useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  BackHandler,
  NativeEventSubscription,
  View,
} from 'react-native';
import type WebView from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

import { IS_ANDROID } from '../constants';
import { LoadingSpinner } from '../ui';

export const useWebView = ():
  | (WebViewProps & {
      ref: Ref<WebView>;
    })
  | null => {
  const ref = useRef<WebView>(null);
  const handleBackPressed = useCallback(() => {
    if (!ref.current) {
      return false;
    }

    ref.current.goBack();
    return true; // prevent default behavior (exit app)
  }, []);

  useEffect(() => {
    let subscription: NativeEventSubscription | undefined;
    // Start Android back button listener
    if (IS_ANDROID) {
      subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBackPressed
      );
    }

    return () => {
      // Clean up listeners
      subscription?.remove();
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
