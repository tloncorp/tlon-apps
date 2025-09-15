import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getVariableValue, useTheme } from 'tamagui';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { SettingsScreenView, View } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
  const { dmLink } = useDMLureLink();
  const hasHostedAuth = useHasHostedAuth();
  const navigationRef = useMutableRef(props.navigation);

  const onAppInfoPressed = useCallback(() => {
    navigationRef.current.navigate('AppInfo');
  }, [navigationRef]);

  const onPushNotifPressed = useCallback(() => {
    navigationRef.current.navigate('PushNotificationSettings');
  }, [navigationRef]);

  const onBlockedUsersPressed = useCallback(() => {
    navigationRef.current.navigate('BlockedUsers');
  }, [navigationRef]);

  const onManageAccountPressed = useCallback(() => {
    navigationRef.current.navigate('ManageAccount');
  }, [navigationRef]);

  const onExperimentalFeaturesPressed = useCallback(() => {
    navigationRef.current.navigate('FeatureFlags');
  }, [navigationRef]);

  const onSendBugReportPressed = useCallback(() => {
    navigationRef.current.navigate('WompWomp');
  }, [navigationRef]);

  const onBack = useCallback(() => {
    navigationRef.current.goBack();
  }, [navigationRef]);

  const onThemePressed = useCallback(() => {
    navigationRef.current.navigate('Theme');
  }, [navigationRef]);

  const onPrivacyPressed = useCallback(() => {
    navigationRef.current.navigate('PrivacySettings');
  }, [navigationRef]);
  const backgroundColor = getVariableValue(useTheme().background);

  return (
    <View backgroundColor={backgroundColor} flex={1}>
      <SettingsScreenView
        hasHostedAuth={hasHostedAuth}
        currentUserId={currentUserId}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={onSendBugReportPressed}
        onAppInfoPressed={onAppInfoPressed}
        onNotificationSettingsPressed={onPushNotifPressed}
        onBlockedUsersPressed={onBlockedUsersPressed}
        onManageAccountPressed={onManageAccountPressed}
        onExperimentalFeaturesPressed={onExperimentalFeaturesPressed}
        onThemePressed={onThemePressed}
        onPrivacyPressed={onPrivacyPressed}
        dmLink={dmLink}
        onBackPressed={onBack}
      />
    </View>
  );
}

function useHasHostedAuth() {
  const [hasHostedAuth, setHasHostedAuth] = useState(false);

  useEffect(() => {
    async function getHostingInfo() {
      const [cookie, userId] = await Promise.all([
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
      ]);
      if (cookie && userId) {
        setHasHostedAuth(true);
      }
    }
    if (Platform.OS !== 'web') {
      getHostingInfo();
    }
  }, []);

  return hasHostedAuth;
}
