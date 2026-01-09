import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useInviteSystemContactHandler } from '../../hooks/useInviteSystemContactHandler';
import type { RootStackParamList } from '../../navigation/types';
import {
  AppDataContextProvider,
  ContactsScreenView,
  NavBarView,
  ScreenHeader,
  View,
  getDisplayName,
  isWeb,
  useInviteSystemContacts,
} from '../../ui';
import SystemNotices from '../../ui/components/SystemNotices';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export default function ContactsScreen(props: Props) {
  const theme = useTheme();
  const {
    navigation: { navigate },
  } = props;

  const inviteSystemContacts = useInviteSystemContacts();
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteSystemContact = useInviteSystemContactHandler(
    inviteSystemContacts,
    inviteLink
  );
  const currentUser = useCurrentUserId();

  const { data: userContacts } = store.useUserContacts();
  const { data: contacts } = store.useContacts();
  const { data: suggestions } = store.useSuggestedContacts();
  const { data: calmSettings } = store.useCalmSettings();
  const { data: systemContacts } = store.useSystemContacts();

  const systemContactsWithoutContactId = useMemo(
    () => systemContacts?.filter((contact) => !contact.contactId),
    [systemContacts]
  );

  const onContactPress = useCallback(
    (contact: db.Contact) => {
      navigate('UserProfile', { userId: contact.id });
    },
    [navigate]
  );

  const onAddContact = useCallback((contact: db.Contact) => {
    store.addContact(contact.id);
  }, []);

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
    <AppDataContextProvider
      contacts={contacts}
      currentUserId={currentUser}
      calmSettings={calmSettings}
    >
      <View backgroundColor={theme?.background?.val} flex={1} height="100%">
        <View flex={1} width="100%" maxWidth={600} marginHorizontal="auto">
          <ScreenHeader
            title="Contacts"
            leftControls={
              <ScreenHeader.IconButton
                type="Add"
                testID="ContactsAddButton"
                onPress={() => navigate('AddContacts')}
              />
            }
            rightControls={
              <ScreenHeader.IconButton
                type="Settings"
                testID="ContactsSettingsButton"
                onPress={() => {
                  navigate('Settings');
                }}
              />
            }
          />
          <SystemNotices.ContactBookPrompt
            status="undetermined"
            onDismiss={() => {}}
            onRequestAccess={() => {}}
            onOpenSettings={() => {}}
          />
          <ContactsScreenView
            contacts={userContacts ?? []}
            systemContacts={systemContactsWithoutContactId ?? []}
            suggestions={suggestions ?? []}
            onContactPress={onContactPress}
            onAddContact={onAddContact}
            onContactLongPress={onContactLongPress}
            onInviteSystemContact={handleInviteSystemContact}
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
      </View>
    </AppDataContextProvider>
  );
}
