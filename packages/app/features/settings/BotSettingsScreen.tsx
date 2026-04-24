import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { WebView } from 'react-native-webview';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { useWebView } from '../../hooks/useWebview';
import { RootStackParamList } from '../../navigation/types';
import { LoadingSpinner, ScreenHeader, View, YStack, isWeb } from '../../ui';

const BOT_SETTINGS_URL = 'https://tlon.network/tlonbot';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'>;

interface HostingSession {
  cookie: string;
  userId: string;
  isExpired: boolean;
}

export function BotSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const webview = useWebView();
  const handleLogout = useHandleLogout({ resetDb });
  const [hostingSession, setHostingSession] = useState<HostingSession | null>(
    null
  );

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

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
          'Cannot access bot settings, failed to get hosting token or user ID.'
        );
      }
    }
    initialize();
  }, []);

  useEffect(() => {
    if (hostingSession?.isExpired) {
      Alert.alert(
        'Logout Required',
        "To access bot settings, you'll need to log back in again.",
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
        title="Bot settings"
      />
      {isWeb && (
        <View flex={1}>
          <iframe
            src={BOT_SETTINGS_URL}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </View>
      )}
      {hostingSession && !hostingSession.isExpired && webview ? (
        <View flex={1}>
          <WebView
            webview={webview}
            source={{
              uri: BOT_SETTINGS_URL,
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
