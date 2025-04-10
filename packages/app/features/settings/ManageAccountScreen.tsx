import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { checkIfAccountDeleted } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { WebView } from 'react-native-webview';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { useWebView } from '../../hooks/useWebview';
import { RootStackParamList } from '../../navigation/types';
import { LoadingSpinner, ScreenHeader, View, YStack, isWeb } from '../../ui';

const MANAGE_ACCOUNT_URL = 'https://tlon.network/account';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageAccount'>;

interface HostingSession {
  cookie: string;
  userId: string;
  isExpired: boolean;
}

export function ManageAccountScreen(props: Props) {
  const resetDb = useResetDb();
  const webview = useWebView();
  const handleLogout = useHandleLogout({ resetDb });
  const [hostingSession, setHostingSession] = useState<HostingSession | null>(
    null
  );

  const handleBack = useCallback(async () => {
    try {
      const wasDeleted = await checkIfAccountDeleted();
      if (wasDeleted) {
        handleLogout();
      } else {
        props.navigation.goBack();
      }
    } catch (error) {
      console.error('Error checking if account was deleted:', error);
      props.navigation.goBack();
    }
  }, [handleLogout, props.navigation]);

  useEffect(() => {
    async function initialize() {
      const [cookie, userId, isExpired] = await Promise.all([
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
        db.hostingAuthExpired.getValue(),
      ]);
      if (cookie && userId) {
        // we need to strip HttpOnly from the cookie or it won't get sent along with the request
        const modifiedCookie = cookie.replace(' HttpOnly;', '');
        setHostingSession({ cookie: modifiedCookie, userId, isExpired });
      } else {
        throw new Error(
          'Cannot manage account, failed to get hosting token or user ID.'
        );
      }
    }
    initialize();
  }, []);

  useEffect(() => {
    if (hostingSession?.isExpired) {
      Alert.alert(
        'Logout Required',
        "To manage your Tlon account, you'll need to log back in again.",
        [
          {
            text: 'Cancel',
            onPress: () => props.navigation.goBack(),
            style: 'cancel',
          },
          {
            text: 'Logout',
            onPress: handleLogout,
          },
        ]
      );
    }
  }, [hostingSession?.isExpired, handleLogout, props.navigation]);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        leftControls={<ScreenHeader.BackButton onPress={handleBack} />}
        title="Manage account"
      />
      {isWeb && (
        <View flex={1}>
          <iframe
            src={MANAGE_ACCOUNT_URL}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </View>
      )}
      {hostingSession && !hostingSession.isExpired && webview ? (
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
