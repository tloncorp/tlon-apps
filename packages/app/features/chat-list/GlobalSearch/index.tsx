import { FlashList, ListRenderItem } from '@shopify/flash-list';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatListItem,
  LoadingSpinner,
  SectionListHeader,
  Text,
  TextInput,
  TextInputRef,
  View,
  XStack,
  YStack,
  useGlobalSearch,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { getTokenValue } from 'tamagui';

import { TabName, useFilteredChats } from '../../../hooks/useFilteredChats';
import {
  ChatListItemData,
  getChatKey,
  getItemType,
  isSectionHeader,
} from '../ChatList';

export interface GlobalSearchProps {
  navigateToGroup: (id: string) => void;
  navigateToChannel: (channel: db.Channel) => void;
}

export function GlobalSearch({
  navigateToGroup,
  navigateToChannel,
}: GlobalSearchProps) {
  const { isOpen, setIsOpen } = useGlobalSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<TextInputRef>(null);
  const listRef = useRef<FlashList<ChatListItemData>>(null);
  const groupsQuery = store.useGroups({});
  const contactsQuery = store.useContacts();

  const isLoading = groupsQuery.isLoading || contactsQuery.isLoading;
  const hasError = groupsQuery.error || contactsQuery.error;

  const { data: chats } = store.useCurrentChats({
    enabled: isOpen,
  });

  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
    };
  }, [chats]);

  const filteredChatsConfig = useMemo(
    () => ({
      pinned: resolvedChats.pinned,
      unpinned: resolvedChats.unpinned,
      pending: [],
      searchQuery,
      activeTab: 'all' as TabName,
    }),
    [resolvedChats, searchQuery, selectedIndex] // We need to include selectedIndex to trigger re-render when it changes
  );

  const displayData = useFilteredChats(filteredChatsConfig);

  const listItems: ChatListItemData[] = useMemo(
    () =>
      displayData.flatMap((section) => {
        return [
          { title: section.title, type: 'sectionHeader' },
          ...section.data,
        ];
      }),
    [displayData]
  );

  // Find first non-header item when search query changes
  // Only reset selection when search query changes
  useEffect(() => {
    const firstItemIndex = listItems.findIndex(
      (item) => !isSectionHeader(item)
    );
    if (firstItemIndex >= 0) {
      setSelectedIndex(firstItemIndex);
    }
  }, [searchQuery]); // Only run when search query changes

  const sizeRefs = useRef({
    sectionHeader: 28,
    chatListItem: 72,
  });

  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    sizeRefs.current.sectionHeader = e.nativeEvent.layout.height;
  }, []);

  const handleItemLayout = useCallback((e: LayoutChangeEvent) => {
    sizeRefs.current.chatListItem = e.nativeEvent.layout.height;
  }, []);

  const handleOverrideLayout = useCallback(
    (layout: { span?: number; size?: number }, item: ChatListItemData) => {
      layout.size = isSectionHeader(item)
        ? sizeRefs.current.sectionHeader
        : sizeRefs.current.chatListItem;
    },
    []
  );

  const onPressItem = useCallback(
    async (item: db.Chat) => {
      if (item.type === 'group') {
        navigateToGroup(item.group.id);
      } else {
        navigateToChannel(item.channel);
      }

      setIsOpen(false);
    },
    [navigateToGroup, navigateToChannel, setIsOpen]
  );

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
        return (
          <SectionListHeader onLayout={handleHeaderLayout}>
            <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
          </SectionListHeader>
        );
      } else {
        return (
          <ChatListItem
            model={item}
            onPress={onPressItem}
            onLayout={handleItemLayout}
            // We're rendering the ChatListItem outside of the ChatOptionsProvider, so we need to disable the options
            disableOptions
            backgroundColor={
              listItems[selectedIndex] === item
                ? '$secondaryBackground'
                : undefined
            }
          />
        );
      }
    },
    [
      handleHeaderLayout,
      onPressItem,
      handleItemLayout,
      listItems,
      selectedIndex,
    ]
  );

  const handleNavigationKey = useCallback(
    (key: string) => {
      let nextIndex = selectedIndex;
      const selectedItem = listItems[selectedIndex];

      switch (key) {
        case 'ArrowDown':
          nextIndex = selectedIndex + 1;
          while (
            nextIndex < listItems.length &&
            isSectionHeader(listItems[nextIndex])
          ) {
            nextIndex++;
          }
          if (nextIndex < listItems.length) {
            setSelectedIndex(nextIndex);
            listRef.current?.scrollToIndex({
              index: nextIndex,
              animated: true,
            });
          }
          break;
        case 'ArrowUp':
          nextIndex = selectedIndex - 1;
          while (nextIndex >= 0 && isSectionHeader(listItems[nextIndex])) {
            nextIndex--;
          }
          if (nextIndex >= 0) {
            setSelectedIndex(nextIndex);
            listRef.current?.scrollToIndex({
              index: nextIndex,
              animated: true,
            });
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
          if (selectedItem && !isSectionHeader(selectedItem)) {
            onPressItem(selectedItem);
          }
          break;
      }
    },
    [selectedIndex, listItems, onPressItem, setIsOpen]
  );

  const contentContainerStyle = useMemo(
    () => ({
      padding: getTokenValue('$l', 'size'),
      paddingBottom: 100, // bottom nav height + some cushion
    }),
    []
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      const metaKey = (e.nativeEvent as any).metaKey;
      const ctrlKey = (e.nativeEvent as any).ctrlKey;

      if ((metaKey || ctrlKey) && key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(false);
      } else if (
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === 'Enter' ||
        key === 'Escape'
      ) {
        e.preventDefault();
        handleNavigationKey(key);
      }
    },
    [handleNavigationKey, setIsOpen]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(!isOpen);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      } else if (isOpen) {
        // Handle navigation keys
        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowUp':
          case 'Enter':
            event.preventDefault();
            handleNavigationKey(event.key);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNavigationKey, setIsOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <View
        // eslint-disable-next-line
        onPress={() => {
          setIsOpen(false);
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50,
        }}
      />

      <YStack
        position="absolute"
        top="20%"
        left="50%"
        borderRadius="$l"
        zIndex={51}
        backgroundColor="$background"
        transform="translateX(-50%)"
        padding="$l"
        width="90%"
        maxWidth={600}
        gap="$l"
      >
        <TextInput
          ref={inputRef}
          placeholder={`Navigate to groups, DMs, or channels (${
            navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'
          })`}
          icon="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onKeyPress={handleKeyPress}
          rightControls={
            <TextInput.InnerButton
              label="Close"
              onPress={() => setIsOpen(false)}
            />
          }
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <YStack gap="$m" style={{ maxHeight: 400, overflowY: 'scroll' }}>
          {isLoading ? (
            <XStack justifyContent="center" padding="$m">
              <LoadingSpinner />
            </XStack>
          ) : hasError ? (
            <Text color="$red" textAlign="center" fontFamily="$body">
              Error loading results. Please try again.
            </Text>
          ) : searchQuery !== '' && !displayData[0]?.data.length ? (
            <Text color="$gray11" textAlign="center" fontFamily="$body">
              No results found
            </Text>
          ) : (
            <FlashList
              ref={listRef}
              data={listItems}
              contentContainerStyle={contentContainerStyle}
              keyExtractor={getChatKey}
              renderItem={renderItem}
              getItemType={getItemType}
              estimatedItemSize={sizeRefs.current.chatListItem}
              overrideItemLayout={handleOverrideLayout}
            />
          )}
        </YStack>

        <XStack
          justifyContent="center"
          gap="$m"
          paddingTop="$xs"
          borderTopWidth={1}
          borderColor="$gray3"
        >
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              ↑↓
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to navigate
            </Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              enter
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to select
            </Text>
          </XStack>
          <XStack gap="$xs" alignItems="center">
            <Text color="$primaryText" fontFamily="$body">
              esc
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              or
            </Text>
            <Text color="$primaryText" fontFamily="$body">
              {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
            </Text>
            <Text color="$secondaryText" fontFamily="$body">
              to close
            </Text>
          </XStack>
        </XStack>
      </YStack>
    </>
  );
}
