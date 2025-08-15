import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useTheme } from 'tamagui';

import SystemNotices from '../..//ui/components/SystemNotices';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import type { RootStackParamList } from '../../navigation/types';
import {
  AppDataContextProvider,
  ContactsScreenView,
  NavBarView,
  ScreenHeader,
  View,
  getDisplayName,
  isWeb,
  triggerHaptic,
  useInviteSystemContacts,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

export default function ContactsScreen(props: Props) {
  const theme = useTheme();
  const {
    navigation: { navigate },
  } = props;

  const inviteSystemContacts = useInviteSystemContacts();
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

  const handleInviteSystemContact = useCallback(
    async (systemContact: db.SystemContact) => {
      if (!inviteSystemContacts) {
        triggerHaptic('error');
        return;
      }

      const alreadyInvited = !!systemContact.sentInvites?.find(
        (invite) => invite.invitedTo === domain.InvitedToPersonalKey
      );
      if (alreadyInvited) {
        triggerHaptic('error');
        return;
      }

      const inviteType = systemContact.phoneNumber ? 'sms' : 'email';
      const recipient =
        inviteType === 'sms' ? systemContact.phoneNumber : systemContact.email;
      const personalInviteLink = await db.personalInviteLink.getValue();

      if (!recipient || !personalInviteLink) {
        triggerHaptic('error');
        return;
      }

      triggerHaptic('baseButtonClick');
      const params: domain.SystemContactInviteParams = {
        type: inviteType,
        recipients: [recipient],
        invite: {
          link: personalInviteLink,
          message: domain.SystemContactInviteMessages.Personal,
        },
      };
      const didSend = await inviteSystemContacts(params);
      if (didSend) {
        await store.recordSentInvites(domain.InvitedToPersonalKey, [
          systemContact,
        ]);
      }
    },
    [inviteSystemContacts]
  );

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
            borderBottom
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
