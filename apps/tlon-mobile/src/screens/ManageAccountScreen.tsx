import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoadingSpinner, ScreenHeader, View, YStack } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';

import { useWebView } from '../hooks/useWebView';
import { RootStackParamList } from '../types';
import { getHostingToken, getHostingUserId } from '../utils/hosting';

const MANAGE_ACCOUNT_URL = 'https://tlon.network/account';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageAccount'>;

interface HostingSession {
  cookie: string;
  userId: string;
}

export function ManageAccountScreen(props: Props) {
  const webview = useWebView();
  const [hostingSession, setHostingSession] = useState<HostingSession | null>(
    null
  );

  useEffect(() => {
    async function initialize() {
      const [cookie, userId] = await Promise.all([
        getHostingToken(),
        getHostingUserId(),
      ]);
      if (cookie && userId) {
        // we need to strip HttpOnly from the cookie or it won't get sent along with the request
        const modifiedCookie = cookie.replace(' HttpOnly;', '');
        setHostingSession({ cookie: modifiedCookie, userId });
      } else {
        throw new Error(
          'Cannot manage account, failed to get hosting token or user ID.'
        );
      }
    }
    initialize();
  }, []);

  return (
    <View flex={1}>
      <ScreenHeader>
        <ScreenHeader.BackButton onPress={() => props.navigation.goBack()} />
        <ScreenHeader.Title>Manage Account</ScreenHeader.Title>
      </ScreenHeader>
      {hostingSession ? (
        <View flex={1}>
          <WebView
            webview={webview}
            source={{
              uri: MANAGE_ACCOUNT_URL,
            }}
            injectedJavaScriptBeforeContentLoaded={`
              document.cookie= "${hostingSession.cookie}";
              localStorage.setItem("X-SESSION-ID", "${hostingSession.userId}");
              true;
            `}
          />
        </View>
      ) : (
        <YStack flex={1}>
          <LoadingSpinner />
        </YStack>
      )}
    </View>
  );
}
