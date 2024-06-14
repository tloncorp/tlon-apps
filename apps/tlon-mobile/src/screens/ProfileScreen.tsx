import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import NavBar from '../navigation/NavBarView';
import { SettingsStackParamList } from '../types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

const DEBUG_MESSAGE = `
  Version: 
  ${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}
  
  Notify Provider: 
  ${NOTIFY_PROVIDER}

  Notify Service: 
  ${NOTIFY_SERVICE}
`;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        debugMessage={DEBUG_MESSAGE}
        onAppSettingsPressed={() => props.navigation.navigate('FeatureFlags')}
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
