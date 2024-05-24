import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { useContactIndex, useContacts } from '../contexts';
import { ScrollView, SizableText, View, XStack, YStack } from '../core';
import {
  AlphaContactsSegment,
  useAlphabeticallySegmentedContacts,
  useSortedContacts,
} from '../hooks/contactSorters';
import { ContactRow } from './ContactRow';
import { SearchBar } from './SearchBar';

export function ContactBook({
  searchable = false,
  searchPlaceholder = '',
  onSelect,
  multiSelect = false,
  onSelectedChange,
  onScrollChange,
}: {
  searchPlaceholder?: string;
  searchable?: boolean;
  onSelect?: (contactId: string) => void;
  multiSelect?: boolean;
  onSelectedChange?: (selected: string[]) => void;
  onScrollChange?: (scrolling: boolean) => void;
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
    sortOrder: [],
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

  const itemSeperator = useCallback(() => <View height="$xl" />, []);

  const scrollPosition = useRef(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    []
  );
  const onTouchStart = useCallback(() => {
    if (scrollPosition.current > 0) {
      onScrollChange?.(true);
    }
  }, [onScrollChange]);

  const onTouchEnd = useCallback(
    () => onScrollChange?.(false),
    [onScrollChange]
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
            onScrollChange={onScrollChange}
          />
        ) : (
          <FlatList
            data={segmentedContacts}
            renderItem={renderItem}
            ItemSeparatorComponent={itemSeperator}
            onScroll={handleScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
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
            onPress={onSelect}
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
  onScrollChange,
}: {
  contacts: db.Contact[];
  selected?: string[];
  onSelect: (contactId: string) => void;
  onScrollChange?: (scrolling: boolean) => void;
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
          onPress={onSelect}
        />
      );
    });
  }, [contacts, onSelect, selected]);

  const scrollPosition = useRef(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const onTouchStart = useCallback(() => {
    if (scrollPosition.current > 0) {
      onScrollChange?.(true);
    }
  }, [onScrollChange]);

  const onTouchEnd = useCallback(
    () => onScrollChange?.(false),
    [onScrollChange]
  );

  return contacts.length === 0 ? (
    <XStack justifyContent="center" paddingTop="$m">
      <SizableText>No results found</SizableText>
    </XStack>
  ) : (
    <ContactContainer>
      <ScrollView
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {contactRows}
      </ScrollView>
    </ContactContainer>
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
