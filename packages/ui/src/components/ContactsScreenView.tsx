import * as db from '@tloncorp/shared/db';
import { ComponentProps, useCallback, useMemo } from 'react';
import { SectionList } from 'react-native';
import { SizableText, View, XStack } from 'tamagui';

import { useSortedContacts } from '../hooks/contactSorters';
import { SystemIconAvatar } from './Avatar';
import { Badge } from './Badge';
import { ContactListItem } from './ListItem';

interface Props {
  contacts: db.Contact[];
  suggestions: db.Contact[];
  userContact?: db.Contact | null;
  onContactPress: (contact: db.Contact) => void;
  onContactLongPress: (contact: db.Contact) => void;
}

interface Section {
  title?: string;
  data: db.Contact[];
}

export function ContactsScreenView(props: Props) {
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

    if (props.userContact) {
      result.push({
        data: [props.userContact],
      });
    }

    if (sortedContacts.length > 0) {
      result.push({
        data: sortedContacts,
      });
    }

    if (trimmedSuggested.length > 0) {
      result.push({
        title: 'Suggestions',
        data: trimmedSuggested,
      });
    }

    return result;
  }, [props.userContact, sortedContacts, trimmedSuggested]);

  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => {
      return (
        <ContactListItem
          size="$4xl"
          contactId={item.id}
          showNickname
          showEndContent
          endContent={
            item.isContactSuggestion ? (
              <Badge text="Add" type="positive" />
            ) : (
              <SystemIconAvatar icon="ChevronRight" backgroundColor="unset" />
            )
          }
          subtitle={item.status ? item.status : undefined}
          onPress={() => props.onContactPress(item)}
          onLongPress={() => props.onContactLongPress(item)}
        />
      );
    },
    [props]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      if (!section.title) {
        return null;
      }

      return (
        <View paddingLeft="$xl" paddingVertical="$xl">
          <SizableText color="$secondaryText">{section.title}</SizableText>
        </View>
      );
    },
    []
  );

  return (
    <View flex={1}>
      {/* {props.userContact ? (
        <View
          width="100%"
          borderTopWidth={1}
          borderBottomWidth={1}
          borderColor="$border"
          // backgroundColor="$secondaryBackground"
          // marginHorizontal="$l"
          // borderRadius="$xl"
        >
          <ContactListItem
            size="$4xl"
            contactId={props.userContact.id}
            showNickname
            showEndContent
            endContent={
              <XStack
                height="$2xl"
                alignItems="center"
                // backgroundColor="orange"
              >
                <Badge text="You" type="neutral" />
                <SystemIconAvatar icon="ChevronRight" backgroundColor="unset" />
              </XStack>
            }
            subtitle={
              props.userContact.status ? props.userContact.status : undefined
            }
            onPress={() => props.onContactPress(props.userContact!)}
          />
        </View>
      ) : null} */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
      />
    </View>
  );
}
