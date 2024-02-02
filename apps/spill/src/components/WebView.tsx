import React from 'react';
import * as Clipboard from 'expo-clipboard';
// import {useCallback, useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, useColorScheme} from 'react-native';
import {Alert, Linking} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView as ReactWebView} from 'react-native-webview';

import * as db from '@db';
import {useWebView} from '@utils/useWebView';
import {useLogOut} from '@utils/useLogOut';

type WebViewMessage = {
  action: 'copy' | 'logout' | 'manageAccount' | 'appLoaded';
  value?: string;
};

type Props = {
  path: string;
};

export const InnerWebView = ({path}: Props) => {
  const safeAreaInsets = useSafeAreaInsets();
  // const didManageAccount = useRef(false);
  // const [appLoaded, setAppLoaded] = useState(false);
  const webViewProps = useWebView();
  const colorScheme = useColorScheme();
  const {url: shipUrl} = db.useObject('Account', db.DEFAULT_ACCOUNT_ID) ?? {};
  const logOut = useLogOut();

  const handleMessage = async ({action, value}: WebViewMessage) => {
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
              onPress: logOut,
            },
          ],
          {
            cancelable: true,
          },
        );
        break;
      // case 'manageAccount':
      //   {
      //     const [hostingSession, hostingUserId] = await Promise.all([
      //       getHostingToken(),
      //       getHostingUserId(),
      //     ]);
      //     didManageAccount.current = true;
      //     navigation.push('ExternalWebView', {
      //       uri: 'https://tlon.network/account',
      //       headers: {
      //         Cookie: hostingSession,
      //       },
      //       injectedJavaScript: `localStorage.setItem("X-SESSION-ID", "${hostingUserId}")`,
      //     });
      //   }
      //   break;
      // case 'appLoaded':
      //   // Slight delay otherwise white background flashes
      //   setTimeout(() => {
      //     setAppLoaded(true);
      //   }, 100);
      //   break;
    }
  };

  return (
    <ReactWebView
      {...webViewProps}
      // Use key to force reload of view when uri is explicitly set
      scrollEnabled={false}
      source={{uri: shipUrl + path}}
      // style={
      //   appLoaded
      //     ? tailwind('bg-transparent')
      //     : {flex: 0, height: 0, opacity: 0}
      // }
      injectedJavaScriptBeforeContentLoaded={`
        window.colorscheme="${colorScheme}";
        window.safeAreaInsets=${JSON.stringify(safeAreaInsets)};
      `}
      // onLoad={() => {
      //   // Start a timeout in case the web app doesn't send the appLoaded message
      //   setTimeout(() => setAppLoaded(true), 10_000);
      // }}
      onShouldStartLoadWithRequest={({url}) => {
        // Clear ship info if webview is redirecting to login page
        if (url.includes(`${shipUrl}/~/login`)) {
          logOut();
          return false;
        }

        // Open URL in device browser if user navigates to non-Groups URL
        if (!url.startsWith(`${shipUrl}/apps/groups`)) {
          Linking.openURL(url);
          return false;
        }

        return true;
      }}
      onMessage={async ({nativeEvent: {data}}) =>
        handleMessage(JSON.parse(data) as WebViewMessage)
      }
    />
  );
};
export const WebView = (props: Props) => {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView behavior="height" style={{height: '100%'}}>
        <InnerWebView {...props} />
      </KeyboardAvoidingView>
    );
  }
  return <InnerWebView {...props} />;
};
