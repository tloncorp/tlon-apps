import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import {
  ContactsScreenView,
  NavBarView,
  ScreenHeader,
  View,
  useCurrentUserId,
} from '@tloncorp/ui';
import { useFeatureFlag } from 'packages/app/lib/featureFlags';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export default function ContactsScreen(props: Props) {
  const {
    navigation: { navigate },
  } = props;

  const [contactsTabEnabled] = useFeatureFlag('contactsTab');
  const currentUser = useCurrentUserId();

  const { data: contacts } = store.useUserContacts();
  const { data: suggestions } = store.useSuggestedContacts();

  return (
    <View flex={1}>
      <ScreenHeader title="Contacts" />
      <ContactsScreenView
        contacts={contacts ?? []}
        suggestions={suggestions ?? []}
        onContactPress={(contactId) => {
          navigate('UserProfile', { userId: contactId });
        }}
      />
      <NavBarView
        navigateToContacts={() => {
          navigate('Contacts');
        }}
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
        showContactsTab={contactsTabEnabled}
      />
    </View>
  );
}
