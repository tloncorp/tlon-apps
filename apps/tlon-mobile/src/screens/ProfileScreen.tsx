import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import { ContactsProvider, ProfileScreenView, View } from '@tloncorp/ui/src';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  return (
    <ContactsProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <SafeAreaView style={{ flex: 1 }}>
          <ProfileScreenView currentUserId={currentUserId} />
        </SafeAreaView>
      </View>
    </ContactsProvider>
  );
}
