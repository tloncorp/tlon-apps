import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { BlockSectionList } from '@tloncorp/ui';
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
import { View, XStack, getTokenValue, useStyle } from 'tamagui';

import { useContactIndex, useContacts } from '../contexts';
import {
  useAlphabeticallySegmentedContacts,
  useSortedContacts,
} from '../hooks/contactSorters';
import { ContactRow } from './ContactRow';
import { SearchBar } from './SearchBar';

export function ContactBook({
  autoFocus = false,
  searchable = false,
  searchPlaceholder = '',
  onSelect,
  multiSelect = false,
  immutableIds = [],
  onSelectedChange,
  onScrollChange,
  explanationComponent,
  quickActions,
  height,
  width,
}: {
  autoFocus?: boolean;
  immutableIds?: string[];
  searchPlaceholder?: string;
  searchable?: boolean;
  onSelect?: (contactId: string) => void;
  multiSelect?: boolean;
  onSelectedChange?: (selected: string[]) => void;
  onScrollChange?: (scrolling: boolean) => void;
  explanationComponent?: React.ReactElement;
  quickActions?: React.ReactElement;
  height?: number;
  width?: number;
}) {
  const contacts = useContacts();
  const contactsForBook = useMemo(() => {
    const markedContacts =
      contacts?.filter((contact) => contact.isContact) ?? [];
    if (markedContacts.length) {
      return markedContacts;
    }
    return contacts;
  }, [contacts]);
  const immutableSet = useMemo(() => new Set(immutableIds), [immutableIds]);
  const contactsIndex = useContactIndex();
  const segmentedContacts = useAlphabeticallySegmentedContacts(
    contactsForBook ?? [],
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
      if (immutableSet.has(contactId)) {
        return;
      }

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
    [immutableSet, multiSelect, onSelect, onSelectedChange, selected]
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<db.Contact, { label: string }>) => {
      const isSelected = !!selected?.includes(item.id);
      return (
        <ContactRow
          backgroundColor={'$secondaryBackground'}
          key={item.id}
          contact={item}
          immutable={immutableSet.has(item.id)}
          selectable={multiSelect}
          selected={isSelected}
          onPress={handleSelect}
          pressStyle={{ backgroundColor: '$shadow' }}
        />
      );
    },
    [selected, immutableSet, multiSelect, handleSelect]
  );

  const onTouchStart = useCallback(() => {
    onScrollChange?.(true);
  }, [onScrollChange]);

  const onTouchEnd = useCallback(
    () => onScrollChange?.(false),
    [onScrollChange]
  );

  const insets = useSafeAreaInsets();

  const contentContainerStyle = useStyle({
    paddingBottom: insets.bottom,
    paddingTop: '$s',
  }) as StyleProp<ViewStyle>;

  const scrollIndicatorInsets = useStyle({
    bottom: insets.bottom,
    top: '$xl',
  }) as Insets;

  const isWindowNarrow = useIsWindowNarrow();

  const listStyle = useMemo(() => {
    if (!isWindowNarrow) {
      return {
        flex: 1,
        paddingTop: getTokenValue('$l'),
        overflow: 'scroll' as const,
      };
    }
    return undefined;
  }, [isWindowNarrow]);

  return (
    <View
      flex={1}
      height={isWindowNarrow ? undefined : height || '100%'}
      width={isWindowNarrow ? undefined : width || '100%'}
      display={isWindowNarrow ? undefined : 'flex'}
      flexDirection={isWindowNarrow ? undefined : 'column'}
    >
      {searchable && (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$m"
          paddingBottom="$s"
          width="100%"
        >
          <SearchBar
            height="$4xl"
            debounceTime={100}
            onChangeQuery={setQuery}
            placeholder={searchPlaceholder ?? ''}
            inputProps={{
              spellCheck: false,
              autoCapitalize: 'none',
              autoComplete: 'off',
              flex: 1,
              autoFocus,
            }}
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
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            renderItem={renderItem}
            contentContainerStyle={contentContainerStyle}
            automaticallyAdjustsScrollIndicatorInsets={false}
            scrollIndicatorInsets={scrollIndicatorInsets}
            style={listStyle}
          />
        </View>
      )}
    </View>
  );
}
