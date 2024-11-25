import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { SectionList } from 'react-native';
import { View, XStack, getTokenValue } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { useSortedContacts } from '../hooks/contactSorters';
import { SystemIconAvatar } from './Avatar';
import { Badge } from './Badge';
import { ContactListItem } from './ListItem';
import { SectionListHeader } from './SectionList';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
  onContactPress: (contact: db.Contact) => void;
  onContactLongPress: (contact: db.Contact) => void;
}

interface Section {
  title?: string;
  data: db.Contact[];
}

export function ContactsScreenView(props: Props) {
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);
  const trimmedSuggested = useMemo(() => {
    if (props.suggestions.length < 4 || props.contacts.length === 0) {
      return props.suggestions;
    }
    return props.suggestions.slice(0, 4);
  }, [props.contacts, props.suggestions]);

  const sortedContacts = useSortedContacts({
    contacts: props.contacts,
    query: '',
  });

  const sections = useMemo(() => {
    const result: Section[] = [];

    if (userContact) {
      result.push({
        data: [userContact],
      });
    }

    if (sortedContacts.length > 0) {
      result.push({
        data: sortedContacts,
      });
    }

    if (trimmedSuggested.length > 0) {
      result.push({
        title: 'Suggested by Pals and DMs',
        data: trimmedSuggested,
      });
    }

    return result;
  }, [userContact, sortedContacts, trimmedSuggested]);

  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => {
      const isSelf = item.id === userContact?.id;
      return (
        <ContactListItem
          size="$4xl"
          contactId={item.id}
          showNickname
          showEndContent
          endContent={
            item.isContactSuggestion ? (
              <Badge text="Add" type="positive" />
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
          backgroundColor={isSelf ? '$secondaryBackground' : 'unset'}
          borderColor="$border"
        />
      );
    },
    [props, userContact?.id]
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
