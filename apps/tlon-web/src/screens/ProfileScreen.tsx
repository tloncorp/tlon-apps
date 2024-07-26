// import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

// import { useDMLureLink } from '../hooks/useBranchLink';
import { useCurrentUserId } from '../hooks/useCurrentUser';
// import { useHandleLogout } from '../hooks/useHandleLogout';
import NavBar from '../navigation/NavBarView';

// import { RootStackParamList } from '../types';

// type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigate = useNavigate();
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  // const handleLogout = useHandleLogout();
  const handleLogout = useCallback(() => {
    // props.navigation.navigate('AppSettings');
    navigate('/logout');
  }, [navigate]);

  const onAppSettingsPressed = useCallback(() => {
    // props.navigation.navigate('AppSettings');
    navigate('/app-settings');
  }, [navigate]);

  const onEditProfilePressed = useCallback(() => {
    // props.navigation.navigate('EditProfile');
    navigate('/edit-profile');
  }, [navigate]);

  // const { dmLink } = useDMLureLink();
  const dmLink = '';

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        onAppSettingsPressed={onAppSettingsPressed}
        onEditProfilePressed={onEditProfilePressed}
        onLogoutPressed={handleLogout}
        dmLink={dmLink}
      />
      <NavBar />
    </View>
  );
}
