import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import NavBar from '../navigation/NavBarView';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Profile'>;

const DEBUG_MESSAGE = `
  Build Details
  
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
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
