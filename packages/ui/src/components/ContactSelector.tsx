import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { FlatList } from 'react-native';

import { useContacts } from '../contexts';
import { Stack, View, XStack, YStack } from '../core';
import { useSortedListOfUrbits } from '../hooks/useSortedListOfUrbits';
import { Avatar } from './Avatar';
import { ListItem } from './ListItem';
import { SearchBar } from './SearchBar';

export function ContactSelector({
  multiSelect,
  onSelectedChange,
  onSelect,
}: {
  multiSelect?: boolean;
  onSelectedChange?: (selected: string[]) => void;
  onSelect?: (selected: string) => void;
}) {
  const contacts = useContacts();
  const [query, setQuery] = useState('');
  const urbitsToDisplay = useSortedListOfUrbits({
    contacts: contacts ?? [],
    query,
  });
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    onSelectedChange?.(selected);
  }, [onSelectedChange, selected]);

  return (
    <YStack
      flex={1}
      // borderWidth={1}
      // borderColor="$primaryText"
      justifyContent="flex-start"
      borderRadius="$l"
    >
      <View padding="$l">
        <SearchBar
          padding="$m"
          height="$4xl"
          debounceTime={100}
          onChangeQuery={setQuery}
          placeholder="Start a DM with..."
        />
      </View>
      {multiSelect ? (
        <ContactMultiSelectList
          urbits={urbitsToDisplay ?? []}
          onSelectedChange={setSelected}
        />
      ) : (
        <ContactSingleSelectList
          urbits={urbitsToDisplay ?? []}
          onSelect={(contactId) => onSelect?.(contactId)}
        />
      )}
    </YStack>
  );
}

export function ContactSingleSelectList({
  urbits,
  onSelect,
  initialSelected,
}: {
  urbits: db.Contact[];
  initialSelected?: string[];
  onSelect: (selected: string) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => (
      <ContactRowItem onPress={() => onSelect(item.id)} item={item} />
    ),
    []
  );

  return (
    <View flex={1} overflow="hidden">
      <FlatList renderItem={renderItem} data={urbits} />
    </View>
  );
}

export function ContactMultiSelectList({
  urbits,
  onSelectedChange,
  initialSelected,
}: {
  urbits: db.Contact[];
  initialSelected?: string[];
  onSelectedChange: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected ?? []);

  const toggleSelected = useCallback(
    (selectedUrbit: string) => {
      const newSelected = selected.includes(selectedUrbit)
        ? selected.filter((s) => s !== selectedUrbit)
        : [...selected, selectedUrbit];
      setSelected(newSelected);
      onSelectedChange(newSelected);
    },
    [selected, setSelected, onSelectedChange]
  );

  const renderItem = useCallback(
    ({ item }: { item: db.Contact }) => (
      <ContactRowItem
        selected={selected.includes(item.id)}
        onPress={() => toggleSelected(item.id)}
        item={item}
      />
    ),
    [selected, toggleSelected]
  );

  return (
    <View flex={1} overflow="hidden">
      <FlatList renderItem={renderItem} data={urbits} />
    </View>
  );
}

function ContactRowItemRaw({
  item,
  selected = false,
  onPress,
}: {
  item: db.Contact;
  onPress: () => void;
  selected?: boolean;
}) {
  const displayName = useMemo(
    () => (item.nickname && item.nickname.length > 2 ? item.nickname : item.id),
    [item]
  );

  return (
    <ListItem
      onPress={onPress}
      backgroundColor={selected ? '$secondaryBackground' : undefined}
    >
      {selected ? (
        <ListItem.Icon icon="Checkmark" />
      ) : (
        <Stack
          justifyContent="center"
          alignItems="center"
          height="$4xl"
          width="$4xl"
        >
          <View
            borderWidth={1}
            borderRadius="$4xl"
            borderColor="$secondaryText"
            height="$2xl"
            width="$2xl"
          />
        </Stack>
      )}
      <ListItem.MainContent>
        <XStack alignItems="center">
          <Avatar size="$4xl" contactId={item.id} contact={item} />
          <ListItem.Title marginLeft="$l">{displayName}</ListItem.Title>
        </XStack>
      </ListItem.MainContent>
    </ListItem>
  );
}
const ContactRowItem = React.memo(ContactRowItemRaw);
