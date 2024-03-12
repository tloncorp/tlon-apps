import {
  type MobileNavTab,
  type NativeWebViewOptions,
  type WebAppAction,
} from '@tloncorp/shared';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { URL } from 'react-native-url-polyfill';
import { WebView } from 'react-native-webview';
import type {
  WebViewRenderProcessGoneEvent,
  WebViewTerminatedEvent,
} from 'react-native-webview/lib/WebViewTypes';
import { useTailwind } from 'tailwind-rn';

import { DEFAULT_SHIP_LOGIN_URL, DEFAULT_TLON_LOGIN_EMAIL } from '../constants';
import { useShip } from '../contexts/ship';
import { useWebViewContext } from '../contexts/webview/webview';
import useAppStatus from '../hooks/useAppStatus';
import { useWebView } from '../hooks/useWebView';
import WebAppHelpers from '../lib/WebAppHelpers';
import { isUsingTlonAuth } from '../lib/hostingApi';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

// TODO: add typing for data beyond generic value string
type WebAppCommand = {
  action: WebAppAction;
  value?: string | { tab: string; path: string };
};

// used for tracking and recovering from crashes
interface CrashState {
  isCrashed: boolean;
  crashEvent: WebViewTerminatedEvent | WebViewRenderProcessGoneEvent | null;
  lastUrl: string;
}

// used for forcing the webview to reload
interface SourceState {
  url: string;
  key: number;
}

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
  const webviewContext = useWebViewContext();
  const initialUrl = useMemo(() => createUri(shipUrl, '/'), [shipUrl]);
  const appStatus = useAppStatus();

  const [crashRecovery, setCrashRecovery] = useState<CrashState>({
    isCrashed: false,
    crashEvent: null,
    lastUrl: '',
  });

  const [source, setSource] = useState<SourceState>({
    url: initialUrl,
    key: 0,
  });

  // If the webview crashed, wait until it's back in the foreground to reload
  useEffect(() => {
    if (appStatus === 'active' && crashRecovery.isCrashed) {
      setSource({
        url: crashRecovery.lastUrl,
        key: source.key + 1,
      });
      setCrashRecovery({ isCrashed: false, lastUrl: '', crashEvent: null });

      // TODO: for debugging purposes, log the crash recovery. Remove before
      // shipping to prod.
      setTimeout(() => {
        Alert.alert(
          'Recovered from Webview Crash',
          crashRecovery.crashEvent?.toString(),
          [
            {
              text: 'Okay',
              style: 'cancel',
            },
          ],
          {
            cancelable: true,
          }
        );
      }, 2000);
    }
  }, [appStatus, crashRecovery, source]);

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
        webviewContext.setNewWebappTab(value as MobileNavTab);
        break;
      case 'saveLastPath': {
        if (!value || typeof value !== 'object' || !value.tab || !value.path) {
          return;
        }

        if (value.tab === 'Messages') {
          webviewContext.setLastMessagesPath(value.path);
        }
        if (value.tab === 'Groups') {
          webviewContext.setLastGroupsPath(value.path);
        }
        break;
      }
      case 'manageAccount':
        webviewContext.setManageAccountState('triggered');
        break;
      case 'appLoaded':
        // Slight delay otherwise white background flashes
        setTimeout(() => {
          webviewContext.setAppLoaded(true);
        }, 100);
        break;
    }
  };

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
    isUsingTlonAuth: isUsingTlonAuth(),
    safeAreaInsets,
  };

  return (
    <WebView
      {...webViewProps}
      scrollEnabled={false}
      ref={webviewRef}
      key={source.key}
      source={{ uri: source.url }}
      style={
        webviewContext.appLoaded
          ? tailwind('bg-transparent')
          : { flex: 0, height: 0, opacity: 0 }
      }
      injectedJavaScriptBeforeContentLoaded={`
        window.nativeOptions=${JSON.stringify(nativeOptions)};
        // set old values for backwards compatibility
        window.colorscheme="${nativeOptions.colorScheme}";
        window.safeAreaInsets=${JSON.stringify(nativeOptions.safeAreaInsets)};
        ${
          // in development, explicitly set Urbit runtime configured window vars
          DEFAULT_SHIP_LOGIN_URL || DEFAULT_TLON_LOGIN_EMAIL
            ? ` window.our="${ship}"; window.ship="${ship?.slice(1)}"; `
            : ''
        }
      `}
      onLoad={() => {
        // Start a timeout in case the web app doesn't send the appLoaded message
        setTimeout(() => webviewContext.setAppLoaded(true), 10_000);
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
      // on iOS, this is called if the webview crashes or is
      // killed by the OS
      onContentProcessDidTerminate={(event) => {
        console.error('Content process terminated', event);
        webviewContext.setAppLoaded(false);
        setCrashRecovery((prev) => ({
          ...prev,
          isCrashed: true,
          crashEvent: event,
        }));
      }}
      // on Android, this is called if the webview crashes or is
      // killed by the OS
      onRenderProcessGone={(event) => {
        console.error('Render process gone', event);
        webviewContext.setAppLoaded(false);
        setCrashRecovery((prev) => ({
          ...prev,
          isCrashed: true,
          crashEvent: event,
        }));
      }}
      // store a reference to the last url the webview was at for crash recovery
      onNavigationStateChange={({ url }) => {
        setCrashRecovery((prev) => ({ ...prev, lastUrl: url }));
      }}
    />
  );
};
