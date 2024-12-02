import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getVariableValue, useTheme } from 'tamagui';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';
import { getHostingToken, getHostingUserId } from '../../utils/hosting';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
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

  const onProfilePressed = useCallback(() => {
    navigationRef.current.navigate('UserProfile', { userId: currentUserId });
  }, [currentUserId, navigationRef]);

  const onSendBugReportPressed = useCallback(() => {
    navigationRef.current.navigate('WompWomp');
  }, [navigationRef]);

  const onBack = useCallback(() => {
    navigationRef.current.goBack();
  }, [navigationRef]);

  const onThemePressed = useCallback(() => {
    navigationRef.current.navigate('Theme');
  }, [navigationRef]);

  const backgroundColor = getVariableValue(useTheme().background);

  return (
    <View backgroundColor={backgroundColor} flex={1}>
      <ProfileScreenView
        hasHostedAuth={hasHostedAuth}
        currentUserId={currentUserId}
        onProfilePressed={onProfilePressed}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={onSendBugReportPressed}
        onAppInfoPressed={onAppInfoPressed}
        onNotificationSettingsPressed={onPushNotifPressed}
        onBlockedUsersPressed={onBlockedUsersPressed}
        onManageAccountPressed={onManageAccountPressed}
        onExperimentalFeaturesPressed={onExperimentalFeaturesPressed}
        onThemePressed={onThemePressed}
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
        getHostingToken(),
        getHostingUserId(),
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
