import { useFocusEffect } from '@react-navigation/native';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  type MobileNavTab,
  type NativeWebViewOptions,
  type WebAppAction,
} from '@tloncorp/shared';
import * as Clipboard from 'expo-clipboard';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { URL } from 'react-native-url-polyfill';
import { WebView } from 'react-native-webview';
import { useTailwind } from 'tailwind-rn';

import { DEV_LOCAL } from '../constants';
import { useShip } from '../contexts/ship';
import { useWebViewContext } from '../contexts/webview/webview';
import { useWebView } from '../hooks/useWebView';
import WebAppHelpers from '../lib/WebAppHelpers';
import { markChatRead } from '../lib/chatApi';
import { getHostingUser } from '../lib/hostingApi';
// import { connectNotifications } from '../lib/notifications';
import {
  getHostingUserId,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';

// TODO: add typing for data beyond generic value string
type WebAppCommand = {
  action: WebAppAction;
  value?: string | { tab: string; path: string };
};

const createUri = (shipUrl: string, path?: string) =>
  `${shipUrl}/apps/groups${
    path ? (path.startsWith('/') ? path : `/${path}`) : '/'
  }`;

export const SingletonWebview = () => {
  const tailwind = useTailwind();
  const { shipUrl = '', ship, clearShip, setShip } = useShip();
  const webViewProps = useWebView();
  const colorScheme = useColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const didManageAccount = useRef(false);
  const [appLoaded, setAppLoaded] = useState(false);
  const webviewContext = useWebViewContext();

  const handleLogout = useCallback(() => {
    clearShip();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  const handleMessage = async ({ action, value }: WebAppCommand) => {
    switch (action) {
      case 'copy':
        if (value) {
          await Clipboard.setStringAsync(value as string);
        }
        break;
      case 'logout':
        Alert.alert(
          'Are you sure?',
          'Click Log Out to continue.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Log Out',
              style: 'destructive',
              onPress: handleLogout,
            },
          ],
          {
            cancelable: true,
          }
        );
        break;
      case 'activeTabChange':
        webviewContext.setGotoTab(value as MobileNavTab);
        break;
      case 'saveLastPath': {
        if (!value || typeof value !== 'object' || !value.tab || !value.path) {
          return;
        }

        if (value.tab === 'Messages') {
          webviewContext.setLastMessagesPath(value.path);
        }
        break;
      }
      // TODO: handle manage account
      case 'manageAccount':
        webviewContext.setDidManageAccount(true);
        break;
      case 'appLoaded':
        // Slight delay otherwise white background flashes
        setTimeout(() => {
          setAppLoaded(true);
        }, 100);
        break;
    }
  };

  useEffect(() => {
    // Start notification tap listener
    // This only seems to get triggered on iOS. Android handles the tap and other intents in native code.
    const notificationTapListener = addNotificationResponseReceivedListener(
      (response) => {
        const {
          actionIdentifier,
          userText,
          notification: {
            request: {
              content: { data },
            },
          },
        } = response;
        if (actionIdentifier === 'markAsRead' && data.channelId) {
          markChatRead(data.channelId);
        } else if (actionIdentifier === 'reply' && userText) {
          // Send reply
        } else if (data.wer) {
          // TODO: handle wer
          // setUri((curr) => ({
          //   ...curr,
          //   uri: createUri(shipUrl, data.wer),
          //   key: curr.key + 1,
          // }));
        }
      }
    );

    // connectNotifications();

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [shipUrl]);

  // When this view regains focus from Manage Account, query for hosting user's details and bump back to login if an error occurs
  useFocusEffect(
    useCallback(() => {
      if (!didManageAccount.current) {
        return;
      }

      (async () => {
        const hostingUserId = await getHostingUserId();
        if (hostingUserId) {
          try {
            const user = await getHostingUser(hostingUserId);
            if (user.verified) {
              didManageAccount.current = false;
            } else {
              handleLogout();
            }
          } catch (err) {
            handleLogout();
          }
        }
      })();
    }, [handleLogout])
  );

  useEffect(() => {
    // Path was changed by the parent view
    if (webviewContext.gotoPath) {
      // Navigate within the webview
      WebAppHelpers.sendCommand(webviewRef, {
        action: 'goto',
        path: webviewContext.gotoPath,
      });

      // Clear the path to mark it as handled
      webviewContext.clearGotoPath();
    }
  }, [shipUrl, webviewContext, webviewRef]);

  // Injected web settings
  const nativeOptions: NativeWebViewOptions = {
    colorScheme,
    hideTabBar: true,
    safeAreaInsets,
  };

  return (
    <WebView
      {...webViewProps}
      scrollEnabled={false}
      ref={webviewRef}
      source={{ uri: createUri(shipUrl, '/') }}
      style={
        appLoaded
          ? tailwind('bg-transparent')
          : { flex: 0, height: 0, opacity: 0 }
      }
      injectedJavaScriptBeforeContentLoaded={`
        window.nativeOptions=${JSON.stringify(nativeOptions)};
        // set old values for backwards compatibility
        window.colorscheme="${nativeOptions.colorScheme}";
        window.safeAreaInsets=${JSON.stringify(nativeOptions.safeAreaInsets)};
        ${
          DEV_LOCAL
            ? ` window.our="${ship}"; window.ship="${ship?.slice(1)}"; `
            : ''
        }
      `}
      onLoad={() => {
        // Start a timeout in case the web app doesn't send the appLoaded message
        setTimeout(() => setAppLoaded(true), 10_000);
      }}
      onShouldStartLoadWithRequest={({ url }) => {
        const parsedUrl = new URL(url);
        const parsedShipUrl = new URL(shipUrl);
        const redirectedToHttps =
          parsedUrl.protocol === 'https:' &&
          parsedShipUrl.protocol === 'http:' &&
          parsedUrl.host === parsedShipUrl.host &&
          parsedUrl.pathname.startsWith('/apps/groups');

        // Allow redirect to HTTPS
        if (redirectedToHttps) {
          setShip({
            ship,
            shipUrl: parsedUrl.origin,
          });

          return true;
        }

        // Clear ship info if webview is redirecting to login page
        if (url.includes(`${shipUrl}/~/login`)) {
          clearShip();
          return false;
        }

        // Open URL in device browser if user navigates to non-Groups URL
        if (!url.startsWith(`${shipUrl}/apps/groups`)) {
          Linking.openURL(url);
          return false;
        }

        return true;
      }}
      onMessage={async ({ nativeEvent: { data } }) =>
        handleMessage(JSON.parse(data) as WebAppCommand)
      }
    />
  );
};
