import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Insets,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, useStyle } from 'tamagui';

import { useContactIndex, useContacts } from '../contexts';
import {
  useAlphabeticallySegmentedContacts,
  useSortedContacts,
} from '../hooks/contactSorters';
import { ContactRow } from './ContactRow';
import { SearchBar } from './SearchBar';
import { BlockSectionList } from './SectionList';

export function ContactBook({
  searchable = false,
  searchPlaceholder = '',
  onSelect,
  multiSelect = false,
  onSelectedChange,
  onScrollChange,
  explanationComponent,
  quickActions,
}: {
  searchPlaceholder?: string;
  searchable?: boolean;
  onSelect?: (contactId: string) => void;
  multiSelect?: boolean;
  onSelectedChange?: (selected: string[]) => void;
  onScrollChange?: (scrolling: boolean) => void;
  explanationComponent?: React.ReactElement;
  quickActions?: React.ReactElement;
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
  const showSearchResults = searchable && query.length > 0;
  const sections = useMemo(() => {
    if (showSearchResults) {
      const label = `Contacts matching ‘${query}’`;
      return queryContacts?.length ? [{ label, data: queryContacts }] : [];
    } else {
      return segmentedContacts;
    }
  }, [showSearchResults, query, queryContacts, segmentedContacts]);

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
    ({ item }: SectionListRenderItemInfo<db.Contact, { label: string }>) => {
      const isSelected = !!selected?.includes(item.id);
      return (
        <ContactRow
          backgroundColor={'$secondaryBackground'}
          key={item.id}
          contact={item}
          selectable={multiSelect}
          selected={isSelected}
          onPress={handleSelect}
          pressStyle={{ backgroundColor: '$shadow' }}
        />
      );
    },
    [selected, multiSelect, handleSelect]
  );

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

  const insets = useSafeAreaInsets();

  const contentContainerStyle = useStyle({
    paddingBottom: insets.bottom,
    paddingTop: '$s',
    paddingHorizontal: '$xl',
  }) as StyleProp<ViewStyle>;

  const scrollIndicatorInsets = useStyle({
    bottom: insets.bottom,
    top: '$xl',
  }) as Insets;

  return (
    <View flex={1}>
      {searchable && (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$m"
          paddingBottom="$s"
        >
          <SearchBar
            paddingHorizontal="$xl"
            height="$4xl"
            debounceTime={100}
            onChangeQuery={setQuery}
            placeholder={searchPlaceholder ?? ''}
            inputProps={{ spellCheck: false }}
          />
        </XStack>
      )}
      {!showSearchResults && explanationComponent ? (
        explanationComponent
      ) : (
        <View flex={1} onTouchStart={Keyboard.dismiss}>
          <BlockSectionList
            ListHeaderComponent={!showSearchResults ? quickActions : null}
            sections={sections}
            onScroll={handleScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            renderItem={renderItem}
            contentContainerStyle={contentContainerStyle}
            automaticallyAdjustsScrollIndicatorInsets={false}
            scrollIndicatorInsets={scrollIndicatorInsets}
          />
        </View>
      )}
    </View>
  );
}
