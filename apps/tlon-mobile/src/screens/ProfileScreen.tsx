import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { purgeDb } from '../lib/nativeDb';
import NavBar from '../navigation/NavBarView';
import { SettingsStackParamList } from '../types';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const { clearShip } = useShip();
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  const handleLogout = useCallback(async () => {
    await purgeDb();
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        onAppSettingsPressed={() => props.navigation.navigate('FeatureFlags')}
        handleLogout={handleLogout}
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
