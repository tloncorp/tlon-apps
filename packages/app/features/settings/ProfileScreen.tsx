import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { getHostingToken, getHostingUserId } from '../../utils/hosting';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
  const { dmLink } = useDMLureLink();
  const hasHostedAuth = useHasHostedAuth();

  const onAppInfoPressed = useCallback(() => {
    props.navigation.navigate('AppInfo');
  }, [props.navigation]);

  const onPushNotifPressed = useCallback(() => {
    props.navigation.navigate('PushNotificationSettings');
  }, [props.navigation]);

  const onBlockedUsersPressed = useCallback(() => {
    props.navigation.navigate('BlockedUsers');
  }, [props.navigation]);

  const onManageAccountPressed = useCallback(() => {
    props.navigation.navigate('ManageAccount');
  }, [props.navigation]);

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        hasHostedAuth={hasHostedAuth}
        currentUserId={currentUserId}
        onEditProfilePressed={() => props.navigation.navigate('EditProfile')}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={() => props.navigation.navigate('WompWomp')}
        onAppInfoPressed={onAppInfoPressed}
        onNotificationSettingsPressed={onPushNotifPressed}
        onBlockedUsersPressed={onBlockedUsersPressed}
        onManageAccountPressed={onManageAccountPressed}
        dmLink={dmLink}
      />
      <NavBarView
        navigateToHome={() => props.navigation.navigate('ChatList')}
        navigateToNotifications={() => props.navigation.navigate('Activity')}
        navigateToProfileSettings={() => props.navigation.navigate('Profile')}
        currentRoute="Profile"
        currentUserId={currentUserId}
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
