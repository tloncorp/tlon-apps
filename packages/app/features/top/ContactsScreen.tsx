import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ContactsScreenView,
  NavBarView,
  ScreenHeader,
  View,
  getDisplayName,
  isWeb,
  useCurrentUserId,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useFeatureFlag } from '../../lib/featureFlags';
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
  const { data: userContact } = store.useContact({ id: currentUser });

  const onContactPress = useCallback(
    (contact: db.Contact) => {
      navigate('UserProfile', { userId: contact.id });
    },
    [navigate]
  );

  const onContactLongPress = useCallback((contact: db.Contact) => {
    if (!isWeb && contact.isContactSuggestion) {
      Alert.alert(`Add ${getDisplayName(contact)}?`, '', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add Contact',
          style: 'default',
          onPress: () => {
            store.addContact(contact.id);
          },
        },
        {
          text: 'Decline Suggestion',
          style: 'destructive',
          onPress: () => {
            store.removeContactSuggestion(contact.id);
          },
        },
      ]);
    }
  }, []);

  return (
    <View flex={1}>
      <ScreenHeader
        title="Contacts"
        backAction={() => props.navigation.goBack()}
      />
      <ContactsScreenView
        contacts={contacts ?? []}
        suggestions={suggestions ?? []}
        userContact={userContact}
        onContactPress={onContactPress}
        onContactLongPress={onContactLongPress}
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
        currentRoute="Contacts"
        currentUserId={currentUser}
        showContactsTab={contactsTabEnabled}
      />
    </View>
  );
}
