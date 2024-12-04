import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  AppDataContextProvider,
  ContactsScreenView,
  NavBarView,
  ScreenHeader,
  View,
  getDisplayName,
  isWeb,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export default function ContactsScreen(props: Props) {
  const {
    navigation: { navigate },
  } = props;

  const currentUser = useCurrentUserId();

  const { data: userContacts } = store.useUserContacts();
  const { data: contacts } = store.useContacts();
  const { data: suggestions } = store.useSuggestedContacts();

  const onContactPress = useCallback(
    (contact: db.Contact) => {
      navigate('UserProfile', { userId: contact.id });
    },
    [navigate]
  );

  const onContactLongPress = useCallback((contact: db.Contact) => {
    store.addContactSuggestions([contact.id]);
  }, []);

  // const onContactLongPress = useCallback((contact: db.Contact) => {
  //   if (!isWeb && contact.isContactSuggestion) {
  //     Alert.alert(`Add ${getDisplayName(contact)}?`, '', [
  //       {
  //         text: 'Cancel',
  //         style: 'cancel',
  //       },
  //       {
  //         text: 'Add Contact',
  //         style: 'default',
  //         onPress: () => {
  //           store.addContact(contact.id);
  //         },
  //       },
  //       {
  //         text: 'Decline Suggestion',
  //         style: 'destructive',
  //         onPress: () => {
  //           store.removeContactSuggestion(contact.id);
  //         },
  //       },
  //     ]);
  //   }
  // }, []);

  return (
    <AppDataContextProvider contacts={contacts} currentUserId={currentUser}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Contacts"
          leftControls={
            <ScreenHeader.IconButton
              type="Add"
              onPress={() => navigate('AddContacts')}
            />
          }
          rightControls={
            <ScreenHeader.IconButton
              type="Settings"
              onPress={() => {
                navigate('Profile');
              }}
            />
          }
        />
        <ContactsScreenView
          contacts={userContacts ?? []}
          suggestions={suggestions ?? []}
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
          currentRoute="Contacts"
          currentUserId={currentUser}
        />
      </View>
    </AppDataContextProvider>
  );
}
