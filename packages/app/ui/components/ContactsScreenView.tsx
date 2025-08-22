import * as db from '@tloncorp/shared/db';
import { SectionListHeader } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { SectionList } from 'react-native';
import { View, XStack, getTokenValue } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { useSortedContacts } from '../hooks/contactSorters';
import { SystemIconAvatar } from './Avatar';
import { Badge } from './Badge';
import { ContactListItem, SystemContactListItem } from './ListItem';

interface Props {
  contacts: db.Contact[];
  systemContacts: db.SystemContact[];
  suggestions: db.Contact[];
  focusedContactId?: string;
  onContactPress: (contact: db.Contact) => void;
  onAddContact: (contact: db.Contact) => void;
  onContactLongPress: (contact: db.Contact) => void;
  onInviteSystemContact: (contact: db.SystemContact) => void;
}

interface Section {
  title?: string;
  data: db.Contact[];
}

export function ContactsScreenView(props: Props) {
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);

  const sortedContacts = useSortedContacts({
    contacts: props.contacts,
    query: '',
  });

  const sortedSystemContacts = useMemo(() => {
    return sortSystemContacts(props.systemContacts);
  }, [props.systemContacts]);

  const sections = useMemo(() => {
    const result: Section[] = [];

    result.push({
      data: [userContact ?? db.getFallbackContact(currentUserId)],
    });

    if (sortedContacts.length > 0) {
      result.push({
        data: sortedContacts,
      });
    }

    if (props.suggestions.length > 0) {
      result.push({
        title: 'Suggested from %pals and DMs',
        data: props.suggestions,
      });
    }

    if (sortedSystemContacts.length > 0) {
      result.push({
        title: 'From your address book',
        data: sortedSystemContacts,
      });
    }

    return result;
  }, [
    userContact,
    currentUserId,
    sortedContacts,
    props.suggestions,
    sortedSystemContacts,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: db.Contact | db.SystemContact }) => {
      if (db.isSystemContact(item)) {
        return (
          <SystemContactListItem
            systemContact={item}
            showInvitedStatus
            onPress={props.onInviteSystemContact}
          />
        );
      }

      const isSelf = item.id === currentUserId;
      const isFocused =
        props.focusedContactId === item.id ||
        (!props.focusedContactId && isSelf);
      return (
        <ContactListItem
          size="$4xl"
          contactId={item.id}
          showNickname
          testID="ContactListItem"
          aria-label={`ContactListItem-${item.id}`}
          showEndContent
          endContent={
            item.isContactSuggestion && !isSelf ? (
              <Badge
                text="Add"
                type="positive"
                onPress={(e) => {
                  e.stopPropagation();
                  props.onAddContact(item);
                }}
              />
            ) : isSelf ? (
              <XStack gap="$xs" alignItems="center">
                <Badge
                  text="You"
                  type="neutral"
                  backgroundColor="$background"
                />
                <SystemIconAvatar icon="ChevronRight" backgroundColor="unset" />
              </XStack>
            ) : (
              <SystemIconAvatar icon="ChevronRight" backgroundColor="unset" />
            )
          }
          subtitle={item.status ? item.status : undefined}
          onPress={() => props.onContactPress(item)}
          onLongPress={() => props.onContactLongPress(item)}
          backgroundColor={isFocused ? '$shadow' : 'unset'}
          borderColor="$border"
          hoverStyle={{ backgroundColor: '$secondaryBackground' }}
        />
      );
    },
    [currentUserId, props]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      if (!section.title) {
        return null;
      }

      return (
        <SectionListHeader paddingTop="$xl">
          <SectionListHeader.Text>{section.title}</SectionListHeader.Text>
        </SectionListHeader>
      );
    },
    []
  );

  const contentContainerStyle = useMemo(() => {
    return {
      padding: getTokenValue('$l', 'size'),
      paddingBottom: 100, // bottom nav height + some cushion
    };
  }, []);

  return (
    <View flex={1}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={contentContainerStyle}
      />
    </View>
  );
}

export function sortSystemContacts(
  contacts: db.SystemContact[]
): db.SystemContact[] {
  return [...contacts].sort((a, b) => {
    const aName = getDisplayName(a);
    const bName = getDisplayName(b);

    // Check if names start with alphabetical characters
    const aStartsWithLetter = /^[a-z]/i.test(aName);
    const bStartsWithLetter = /^[a-z]/i.test(bName);

    // If one starts with a letter and the other doesn't, prioritize the one with a letter
    if (aStartsWithLetter && !bStartsWithLetter) {
      return -1;
    }
    if (!aStartsWithLetter && bStartsWithLetter) {
      return 1;
    }

    // If both start with letters or both don't, use normal string comparison
    return aName.localeCompare(bName);
  });
}

function getDisplayName(contact: db.SystemContact): string {
  if (contact.firstName && contact.lastName) {
    return `${contact.firstName} ${contact.lastName}`.trim().toLowerCase();
  } else if (contact.firstName) {
    return contact.firstName.trim().toLowerCase();
  } else if (contact.lastName) {
    return contact.lastName.trim().toLowerCase();
  } else if (contact.email) {
    return contact.email.trim().toLowerCase();
  } else if (contact.phoneNumber) {
    return contact.phoneNumber.trim().toLowerCase();
  }

  return contact.id.toLowerCase();
}
