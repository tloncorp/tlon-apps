import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoadingSpinner, ScreenHeader, View, YStack } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useWebView } from '../hooks/useWebView';
import { RootStackParamList } from '../types';
import { getHostingToken, getHostingUserId } from '../utils/hosting';

// TODO: why getting this? https://github.com/tloncorp/ylem/blob/6c9a64b3c3e7221b00514103e5720b57df8fa22f/pkg/ui/horizon/src/features/account/hooks.ts#L134

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
        // console.log(`bl: userId ${userId}`);
        // console.log(`bl: cookie ${cookie}`);
        setHostingSession({ cookie, userId });
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
              headers: {
                Cookie: hostingSession.cookie,
              },
            }}
            injectedJavaScriptBeforeContentLoaded={`localStorage.setItem("X-SESSION-ID", "${hostingSession.userId}")`}
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
