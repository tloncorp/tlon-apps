import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import {
  ContactsScreenView,
  NavBarView,
  View,
  useCurrentUserId,
} from '@tloncorp/ui';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export default function ContactsScreen(props: Props) {
  const {
    navigation: { navigate },
  } = props;
  const currentUser = useCurrentUserId();

  const { data: contacts } = store.useUserContacts();
  const { data: suggestions } = store.useSuggestedContacts();

  return (
    <View flex={1}>
      <ContactsScreenView
        contacts={contacts ?? []}
        suggestions={suggestions ?? []}
      />
      <NavBarView
        navigateToHome={() => {
          navigate('ChatList');
        }}
        navigateToNotifications={() => {
          navigate('Activity');
        }}
        navigateToProfileSettings={() => {
          navigate('Profile');
        }}
        currentRoute="ChatList"
        currentUserId={currentUser}
      />
    </View>
  );
}
