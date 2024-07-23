import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useHandleLogout } from '../hooks/useHandleLogout';
import NavBar from '../navigation/NavBarView';
import { RootStackParamList } from '../types';
import { getDmLink } from '../utils/branch';

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

  const [dmLink, setDmLink] = useState('');

  useEffect(() => {
    async function populateLink() {
      const link = await getDmLink(currentUserId);
      setDmLink(link || '');
    }
    populateLink();
  }, [currentUserId]);

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
      <NavBar navigation={props.navigation} />
    </View>
  );
}
