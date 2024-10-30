import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';

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
  const [contactsTabEnabled] = useFeatureFlag('contactsTab');
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

  const onNavigateToHome = useCallback(() => {
    navigationRef.current.navigate('ChatList');
  }, [navigationRef]);

  const onNavigateToNotifications = useCallback(() => {
    navigationRef.current.navigate('Activity');
  }, [navigationRef]);

  const onNavigateToProfileSettings = useCallback(() => {
    navigationRef.current.navigate('Profile');
  }, [navigationRef]);

  const onNavigateToContacts = useCallback(() => {
    navigationRef.current.navigate('Contacts');
  }, [navigationRef]);

  return (
    <View backgroundColor="$background" flex={1}>
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
        dmLink={dmLink}
      />
      <NavBarView
        navigateToContacts={onNavigateToContacts}
        navigateToHome={onNavigateToHome}
        navigateToNotifications={onNavigateToNotifications}
        navigateToProfileSettings={onNavigateToProfileSettings}
        currentRoute="Profile"
        currentUserId={currentUserId}
        showContactsTab={contactsTabEnabled}
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
    getHostingInfo();
  }, []);

  return hasHostedAuth;
}
