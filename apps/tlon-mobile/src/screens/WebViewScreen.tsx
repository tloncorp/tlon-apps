import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeWebViewOptions } from '@tloncorp/shared';
import * as Clipboard from 'expo-clipboard';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { Alert, Linking, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTailwind } from 'tailwind-rn';

import { IS_IOS } from '../constants';
import { useShip } from '../contexts/ship';
import { useWebView } from '../hooks/useWebView';
import { markChatRead } from '../lib/chatApi';
import { getHostingUser } from '../lib/hostingApi';
import { connectNotifications } from '../lib/notifications';
import type { WebViewStackParamList } from '../types';
import {
  getHostingToken,
  getHostingUserId,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';

type WebViewMessage = {
  action: 'copy' | 'logout' | 'manageAccount' | 'appLoaded';
  value?: string;
};

export type Props = NativeStackScreenProps<WebViewStackParamList, 'WebView'>;

const createUri = (shipUrl: string, path?: string) =>
  `${shipUrl}/apps/groups${
    path ? (path.startsWith('/') ? path : `/${path}`) : '/'
  }`;

const InnerWebViewScreen = ({
  navigation,
  route: {
    params: { initialPath, gotoPath },
  },
}: Props) => {
  const tailwind = useTailwind();
  const { shipUrl = '', clearShip } = useShip();
  const webViewProps = useWebView();
  const colorScheme = useColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const didManageAccount = useRef(false);
  const [{ uri, key }, setUri] = useState<{
    uri: string;
    key: number;
  }>({
    uri: createUri(shipUrl, initialPath),
    key: 1,
  });
  const [appLoaded, setAppLoaded] = useState(false);

  const handleLogout = useCallback(() => {
    clearShip();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  const handleMessage = async ({ action, value }: WebViewMessage) => {
    switch (action) {
      case 'copy':
        if (value) {
          await Clipboard.setStringAsync(value);
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
      case 'manageAccount':
        {
          const [hostingSession, hostingUserId] = await Promise.all([
            getHostingToken(),
            getHostingUserId(),
          ]);
          didManageAccount.current = true;
          navigation.push('ExternalWebView', {
            uri: 'https://tlon.network/account',
            headers: {
              Cookie: hostingSession,
            },
            injectedJavaScript: `localStorage.setItem("X-SESSION-ID", "${hostingUserId}")`,
          });
        }
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
          setUri((curr) => ({
            ...curr,
            uri: createUri(shipUrl, data.wer),
            key: curr.key + 1,
          }));
        }
      }
    );

    // Start notification prompt
    connectNotifications();

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [shipUrl]);

  useEffect(
    () =>
      // @ts-expect-error: react-navigation ID and event name mismatch
      navigation.getParent('TabBar')?.addListener('tabPress', () => {
        navigation.setParams({ gotoPath: initialPath });
      }),
    [navigation, initialPath]
  );

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
    if (gotoPath) {
      setUri((curr) => ({
        ...curr,
        uri: createUri(shipUrl, gotoPath),
        key: curr.key + 1,
      }));

      // Clear the path to mark it as handled
      navigation.setParams({ gotoPath: undefined });
    }
  }, [shipUrl, gotoPath, navigation]);

  const nativeOptions: NativeWebViewOptions = {
    colorScheme,
    hideTabBar: true,
    safeAreaInsets,
  };

  return (
    <WebView
      {...webViewProps}
      // Use key to force reload of view when uri is explicitly set
      scrollEnabled={false}
      key={key}
      source={{ uri }}
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
      `}
      onLoad={() => {
        // Start a timeout in case the web app doesn't send the appLoaded message
        setTimeout(() => setAppLoaded(true), 10_000);
      }}
      onShouldStartLoadWithRequest={({ url }) => {
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
        handleMessage(JSON.parse(data) as WebViewMessage)
      }
    />
  );
};

export const WebViewScreen = (props: Props) => {
  const tailwind = useTailwind();
  if (IS_IOS) {
    return (
      <KeyboardAvoidingView behavior="height" style={tailwind('h-full')}>
        <InnerWebViewScreen {...props} />
      </KeyboardAvoidingView>
    );
  }
  return <InnerWebViewScreen {...props} />;
};
