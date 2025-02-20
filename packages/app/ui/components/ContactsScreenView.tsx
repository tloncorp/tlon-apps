import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { SectionList } from 'react-native';
import { View, XStack, getTokenValue } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { useSortedContacts } from '../hooks/contactSorters';
import { SystemIconAvatar } from './Avatar';
import { Badge } from './Badge';
import { ContactListItem } from './ListItem';
import { SectionListHeader } from '../tmp/components/SectionList';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
  focusedContactId?: string;
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

  const sortedContacts = useSortedContacts({
    contacts: props.contacts,
    query: '',
  });

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

    return result;
  }, [userContact, currentUserId, sortedContacts, props.suggestions]);

  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => {
      const isSelf = item.id === currentUserId;
      const isFocused =
        props.focusedContactId === item.id ||
        (!props.focusedContactId && isSelf);
      return (
        <ContactListItem
          size="$4xl"
          contactId={item.id}
          showNickname
          showEndContent
          endContent={
            item.isContactSuggestion && !isSelf ? (
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
          backgroundColor={isFocused ? '$secondaryBackground' : 'unset'}
          borderColor="$border"
          hoverStyle={{ backgroundColor: '$border' }}
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
