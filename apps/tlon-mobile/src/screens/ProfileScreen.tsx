import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import NavBar from '../navigation/NavBarView';
import { SettingsStackParamList } from '../types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        onAppSettingsPressed={() => props.navigation.navigate('FeatureFlags')}
      />
      <NavBar navigation={props.navigation} />
    </View>
  );
}
