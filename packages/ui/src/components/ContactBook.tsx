import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';

import { useContactIndex, useContacts } from '../contexts';
import { SizableText, View, XStack, YStack } from '../core';
import {
  AlphaContactsSegment,
  useAlphabeticallySegmentedContacts,
  useSortedContacts,
} from '../hooks/useSortedListOfUrbits';
import { ContactRow } from './ContactRow';
import { SearchBar } from './SearchBar';

export function ContactBook({
  searchable = false,
  searchPlaceholder = '',
  onSelect,
  multiSelect = false,
  onSelectedChange,
}: {
  searchPlaceholder?: string;
  searchable?: boolean;
  onSelect?: (contactId: string) => void;
  multiSelect?: boolean;
  onSelectedChange?: (selected: string[]) => void;
}) {
  const contacts = useContacts();
  const contactsIndex = useContactIndex();
  const segmentedContacts = useAlphabeticallySegmentedContacts(
    contacts ?? [],
    contactsIndex ?? {}
  );

  const [query, setQuery] = useState('');
  const queryContacts = useSortedContacts({
    contacts: contacts ?? [],
    query,
  });

  const [selected, setSelected] = useState<string[]>([]);
  const handleSelect = useCallback(
    (contactId: string) => {
      if (multiSelect) {
        if (selected.includes(contactId)) {
          const newSelected = selected.filter((id) => id !== contactId);
          setSelected(newSelected);
          onSelectedChange?.(newSelected);
        } else {
          const newSelected = [...selected, contactId];
          setSelected(newSelected);
          onSelectedChange?.(newSelected);
        }
      } else {
        onSelect?.(contactId);
      }
    },
    [multiSelect, onSelect, onSelectedChange, selected]
  );

  const renderItem = useCallback(
    ({ item }: { item: AlphaContactsSegment }) => {
      return (
        <LetterSection
          letter={item.alphaKey}
          contacts={item.contacts}
          onSelect={handleSelect}
          selected={multiSelect ? selected : undefined}
        />
      );
    },
    [handleSelect, multiSelect, selected]
  );

  return (
    <View flex={1}>
      {searchable && (
        <View marginBottom="$xl">
          <SearchBar
            padding="$m"
            height="$4xl"
            debounceTime={100}
            onChangeQuery={setQuery}
            placeholder={searchPlaceholder ?? ''}
          />
        </View>
      )}
      <View flex={1}>
        {searchable && query.length > 0 ? (
          <ContactSearchResults
            contacts={queryContacts}
            onSelect={handleSelect}
            selected={multiSelect ? selected : undefined}
          />
        ) : (
          <FlatList
            data={segmentedContacts}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View height="$xl" />}
          />
        )}
      </View>
    </View>
  );
}

function LetterSection({
  letter,
  contacts,
  onSelect,
  selected,
}: {
  letter: string;
  contacts: db.Contact[];
  selected?: string[];
  onSelect: (contactId: string) => void;
}) {
  const contactRows = useMemo(
    () =>
      contacts.map((contact) => {
        const isSelected = !!selected?.includes(contact.id);
        return (
          <ContactRow
            backgroundColor="$secondaryBackground"
            key={contact.id}
            contact={contact}
            selectable={!!selected}
            selected={isSelected}
            onPress={() => onSelect(contact.id)}
          />
        );
      }),
    [contacts, onSelect, selected]
  );

  return (
    <YStack
      backgroundColor="$secondaryBackground"
      borderRadius="$3xl"
      paddingVertical="$xl"
      paddingHorizontal="$m"
    >
      <XStack paddingHorizontal="$xl" paddingBottom="$m">
        <SizableText color="$secondaryText">
          {letter === '_' ? 'Other' : letter}
        </SizableText>
      </XStack>
      {contactRows}
    </YStack>
  );
}

function ContactSearchResults({
  contacts,
  onSelect,
  selected,
}: {
  contacts: db.Contact[];
  selected?: string[];
  onSelect: (contactId: string) => void;
}) {
  const contactRows = useMemo(() => {
    return contacts.map((contact) => {
      const isSelected = !!selected?.includes(contact.id);
      return (
        <ContactRow
          backgroundColor="$secondaryBackground"
          key={contact.id}
          contact={contact}
          selectable={!!selected}
          selected={isSelected}
          onPress={() => onSelect(contact.id)}
        />
      );
    });
  }, [contacts, onSelect, selected]);

  return contacts.length === 0 ? (
    <XStack justifyContent="center" paddingTop="$m">
      <SizableText>No results found</SizableText>
    </XStack>
  ) : (
    <ContactContainer>{contactRows}</ContactContainer>
  );
}

function ContactContainer({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      backgroundColor="$secondaryBackground"
      borderRadius="$3xl"
      paddingVertical="$xl"
      paddingHorizontal="$m"
    >
      {children}
    </YStack>
  );
}