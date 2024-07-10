import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import * as Application from 'expo-application';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';
import { clearShipInfo, useShip } from '../contexts/ship';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { purgeDb } from '../lib/nativeDb';
import NavBar from '../navigation/NavBarView';
import { RootStackParamList, SettingsStackParamList } from '../types';
import {
  getHostingToken,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const DEBUG_MESSAGE = `
  Version: 
  ${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}
  
  Notify Provider: 
  ${NOTIFY_PROVIDER}

  Notify Service: 
  ${NOTIFY_SERVICE}
`;

export default function ProfileScreen(props: Props) {
  const { clearShip } = useShip();
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  const handleLogout = useCallback(async () => {
    await purgeDb();
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  const onManageAccountPressed = useCallback(() => {
    props.navigation.navigate('ManageAccount');
  }, [props.navigation]);

  const onAppSettingsPressed = useCallback(() => {
    props.navigation.navigate('FeatureFlags');
  }, [props.navigation]);

  const onBlockedUsersPressed = useCallback(() => {
    props.navigation.navigate('BlockedUsers');
  }, [props.navigation]);

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        debugMessage={DEBUG_MESSAGE}
        onManageAccountPressed={onManageAccountPressed}
        onAppSettingsPressed={onAppSettingsPressed}
        onBlockedUsersPressed={onBlockedUsersPressed}
        handleLogout={handleLogout}
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
