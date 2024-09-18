import {
  LoadingSpinner,
  ScreenHeader,
  View,
  YStack,
  isWeb,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { checkIfAccountDeleted } from '../../lib/hostingApi';
import { getHostingToken, getHostingUserId } from '../../utils/hosting';
import { getHostingAuthExpired } from '../../utils/hosting';

const MANAGE_ACCOUNT_URL = 'https://tlon.network/account';

interface HostingSession {
  cookie: string;
  userId: string;
  isExpired: boolean;
}

export function ManageAccountScreen({
  onGoBack,
  webview,
  resetDb,
}: {
  onGoBack: () => void;
  webview?: WebViewProps;
  resetDb?: () => void;
}) {
  const [goingBack, setGoingBack] = useState(false);
  const handleLogout = useHandleLogout({ resetDb });
  const [hostingSession, setHostingSession] = useState<HostingSession | null>(
    null
  );

  const handleBack = useCallback(async () => {
    setGoingBack(true);
    const wasDeleted = await checkIfAccountDeleted();
    if (wasDeleted) {
      handleLogout();
    } else {
      onGoBack();
      setGoingBack(false);
    }
  }, [handleLogout, onGoBack]);

  useEffect(() => {
    async function initialize() {
      const [cookie, userId, isExpired] = await Promise.all([
        getHostingToken(),
        getHostingUserId(),
        getHostingAuthExpired(),
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
            onPress: () => onGoBack(),
            style: 'cancel',
          },
          {
            text: 'Logout',
            onPress: handleLogout,
          },
        ]
      );
    }
  }, [hostingSession?.isExpired, handleLogout, onGoBack]);

  return (
    <View flex={1}>
      <ScreenHeader>
        <View marginRight="$m">
          {goingBack ? (
            <LoadingSpinner />
          ) : (
            <ScreenHeader.BackButton onPress={handleBack} />
          )}
        </View>
        <ScreenHeader.Title>Manage Account</ScreenHeader.Title>
      </ScreenHeader>
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
