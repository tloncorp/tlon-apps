import * as db from '@tloncorp/shared/db';
import { BlockSectionList, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Insets,
  Keyboard,
  SectionList,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, getTokenValue, useStyle } from 'tamagui';

import { useContactIndex, useContacts } from '../contexts/appDataContext';
import {
  useAlphabeticallySegmentedContacts,
  useSortedContacts,
} from '../hooks/contactSorters';
import { useSheetCoveredHeight } from '../hooks/useSheetCoveredHeight';
import { ContactRow } from './ContactRow';
import { ListEmptyState } from './ListEmptyState';
import { SearchBar } from './SearchBar';

export function ContactBook({
  autoFocus = false,
  searchable = false,
  searchPlaceholder = '',
  onSelect,
  multiSelect = false,
  appearance = 'block',
  immutableIds = [],
  disabledIds = [],
  disabledReason,
  onSelectedChange,
  onScrollChange,
  explanationComponent,
  quickActions,
  height,
  width,
  minHeight,
  maxHeight,
}: {
  autoFocus?: boolean;
  immutableIds?: string[];
  disabledIds?: string[];
  disabledReason?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  onSelect?: (contactId: string) => void;
  multiSelect?: boolean;
  /**
   * `block` draws each section as a grey card under its heading, for full
   * screens. `plain` draws one run of rows straight on the surface, with no
   * headings, for pickers inside a sheet.
   */
  appearance?: 'block' | 'plain';
  onSelectedChange?: (selected: string[]) => void;
  onScrollChange?: (scrolling: boolean) => void;
  explanationComponent?: React.ReactElement;
  quickActions?: React.ReactElement;
  height?: number;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
}) {
  const contacts = useContacts();
  const contactsForBook = useMemo(
    () => contacts?.filter((contact) => contact.isContact) ?? [],
    [contacts]
  );
  const immutableSet = useMemo(() => new Set(immutableIds), [immutableIds]);
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);
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
  const isPlain = appearance === 'plain';
  const sections = useMemo(() => {
    if (showSearchResults) {
      const label = `Contacts matching ‘${query}’`;
      return queryContacts?.length ? [{ label, data: queryContacts }] : [];
    } else if (isPlain) {
      const data = segmentedContacts.flatMap((section) => section.data);
      return data.length ? [{ label: 'Contacts', data }] : [];
    } else {
      return segmentedContacts;
    }
  }, [showSearchResults, query, queryContacts, segmentedContacts, isPlain]);

  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const handleSelect = useCallback(
    (contactId: string) => {
      if (immutableSet.has(contactId) || disabledSet.has(contactId)) {
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
    [
      immutableSet,
      disabledSet,
      multiSelect,
      onSelect,
      onSelectedChange,
      selected,
    ]
  );

  useEffect(() => {
    const next = selectedRef.current.filter((id) => !disabledSet.has(id));
    if (next.length !== selectedRef.current.length) {
      setSelected(next);
      onSelectedChange?.(next);
    }
  }, [disabledSet, onSelectedChange]);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<db.Contact, { label: string }>) => {
      const isSelected = !!selected?.includes(item.id);
      const isDisabled = disabledSet.has(item.id);
      return (
        <ContactRow
          backgroundColor={isPlain ? undefined : '$secondaryBackground'}
          key={item.id}
          contact={item}
          immutable={immutableSet.has(item.id)}
          disabled={isDisabled}
          disabledReason={isDisabled ? disabledReason : undefined}
          selectable={multiSelect}
          selected={isSelected}
          onPress={handleSelect}
          pressStyle={{
            backgroundColor: isPlain ? '$secondaryBackground' : '$shadow',
          }}
        />
      );
    },
    [
      isPlain,
      selected,
      immutableSet,
      disabledSet,
      disabledReason,
      multiSelect,
      handleSelect,
    ]
  );

  const onTouchStart = useCallback(() => {
    onScrollChange?.(true);
  }, [onScrollChange]);

  const onTouchEnd = useCallback(
    () => onScrollChange?.(false),
    [onScrollChange]
  );

  const insets = useSafeAreaInsets();

  // In a sheet the rows keep their place under the keyboard, so the list needs
  // that much more room to scroll its last rows clear of it.
  const coveredHeight = useSheetCoveredHeight();
  const contentContainerStyle = useStyle({
    paddingBottom: insets.bottom + coveredHeight,
    paddingTop: '$s',
  }) as StyleProp<ViewStyle>;

  const scrollIndicatorInsets = useStyle({
    bottom: insets.bottom,
    top: '$xl',
  }) as Insets;

  const isWindowNarrow = useIsWindowNarrow();
  // The plain list is the bare one: it draws no section headings.
  const List = isPlain
    ? SectionList<db.Contact, { label: string }>
    : BlockSectionList;

  const listStyle = useMemo(() => {
    if (!isWindowNarrow) {
      return {
        flex: 1,
        paddingTop: getTokenValue('$l'),
        overflow: 'scroll' as const,
      };
    }
    return { flex: 1 };
  }, [isWindowNarrow]);

  return (
    <View
      flex={1}
      height={height || '100%'}
      width={width || '100%'}
      display={'flex'}
      minHeight={minHeight}
      maxHeight={maxHeight}
      flexDirection={'column'}
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
            debounceTime={100}
            onChangeQuery={setQuery}
            placeholder={searchPlaceholder ?? ''}
            inputProps={{
              spellCheck: false,
              autoCapitalize: 'none',
              autoComplete: 'off',
              returnKeyType: 'search',
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
          <List
            ListHeaderComponent={!showSearchResults ? quickActions : null}
            ListEmptyComponent={
              showSearchResults ? (
                <ListEmptyState
                  title="No contacts found"
                  subtitle="Check the spelling, or enter a full ID"
                />
              ) : (
                <ListEmptyState
                  title="No Contacts"
                  subtitle="Your contact book is empty"
                />
              )
            }
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
