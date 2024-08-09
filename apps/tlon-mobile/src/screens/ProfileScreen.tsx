import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDMLureLink } from '@tloncorp/app/hooks/useBranchLink';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import * as store from '@tloncorp/shared/dist/store';
import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const handleLogout = useHandleLogout();

  const onAppSettingsPressed = useCallback(() => {
    props.navigation.navigate('AppSettings');
  }, [props.navigation]);

  const onEditProfilePressed = useCallback(() => {
    props.navigation.navigate('EditProfile');
  }, [props.navigation]);

  const onSendBugReportPressed = useCallback(() => {
    props.navigation.navigate('WompWomp');
  }, [props.navigation]);

  const onViewProfilePressed = useCallback(() => {
    props.navigation.navigate('UserProfile', { userId: currentUserId });
  }, [currentUserId, props.navigation]);

  const { dmLink } = useDMLureLink();

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        onAppSettingsPressed={onAppSettingsPressed}
        onEditProfilePressed={onEditProfilePressed}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={onSendBugReportPressed}
        onViewProfile={onViewProfilePressed}
        dmLink={dmLink}
      />
      <NavBarView
        navigateToHome={() => {
          props.navigation.navigate('ChatList');
        }}
        navigateToNotifications={() => {
          props.navigation.navigate('Activity');
        }}
        navigateToProfile={() => {
          props.navigation.navigate('Profile');
        }}
        currentRoute="Profile"
      />
    </View>
  );
}
