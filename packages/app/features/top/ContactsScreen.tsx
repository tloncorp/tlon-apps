import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert, SectionList } from 'react-native';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useInviteSystemContactHandler } from '../../hooks/useInviteSystemContactHandler';
import { useMarkMatchesSeen } from '../../hooks/useMarkMatchesSeen';
import { useScrollToTabTop } from '../../hooks/useScrollToTabTop';
import { useNavigation } from '../../navigation/utils';
import {
  AppDataContextProvider,
  ContactsScreenView,
  ScreenHeader,
  View,
  getDisplayName,
  isWeb,
  useInviteSystemContacts,
} from '../../ui';
import SystemNotices from '../../ui/components/SystemNotices';

export default function ContactsScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();

  const inviteSystemContacts = useInviteSystemContacts();
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteSystemContact = useInviteSystemContactHandler(
    inviteSystemContacts,
    inviteLink
  );
  const currentUser = useCurrentUserId();
  const scrollRef = useScrollToTabTop<SectionList<db.Contact>>();

  const { data: userContacts } = store.useUserContacts();
  const { data: contacts } = store.useContacts();
  const { data: suggestions } = store.useSuggestedContacts();
  const { data: calmSettings } = store.useCalmSettings();
  const { data: systemContacts } = store.useSystemContacts();

  const systemContactsWithoutContactId = useMemo(
    () => systemContacts?.filter((contact) => !contact.contactId),
    [systemContacts]
  );

  useMarkMatchesSeen();

  const onContactPress = useCallback(
    (contact: db.Contact) => {
      trackEvent(AnalyticsEvent.ContactProfileSelected);
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
                  navigate('Settings', undefined, { pop: true });
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
            scrollRef={scrollRef}
          />
        </View>
      </View>
    </AppDataContextProvider>
  );
}
