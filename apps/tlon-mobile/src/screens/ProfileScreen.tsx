import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useDMLureLink } from '../hooks/useBranchLink';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useHandleLogout } from '../hooks/useHandleLogout';
import NavBar from '../navigation/NavBarView';
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

  const onViewProfile = useCallback(() => {
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
        onViewProfile={onViewProfile}
        dmLink={dmLink}
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
