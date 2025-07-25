import { FlashList, ListRenderItem } from '@shopify/flash-list';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutChangeEvent } from 'react-native';
import { getTokenValue } from 'tamagui';

import { TabName, useFilteredChats } from '../../hooks/useFilteredChats';
import { useResolvedChats } from '../../hooks/useResolvedChats';
import { ChatListItem, SectionListHeader, Text, View } from '../../ui';
import {
  ChatListItemData,
  getChatKey,
  getItemType,
  isSectionHeader,
} from './ChatList';

export interface FilteredChatListRef {
  selectNext: () => void;
  selectPrevious: () => void;
  selectChat: (chat: db.Chat) => void;
  pressSelected: () => void;
}

export const FilteredChatList = React.memo(
  React.forwardRef<
    FilteredChatListRef,
    {
      listType?: TabName;
      searchQuery: string;
      onPressItem: (item: db.Chat) => void;
      listProps?: Partial<ComponentProps<typeof FlashList>>;
    }
  >(function FilteredChatList(
    { searchQuery, listType, listProps, onPressItem },
    ref
  ) {
    const listRef = useRef<FlashList<ChatListItemData>>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const { data: chats } = store.useCurrentChats();
    const resolvedChats = useResolvedChats(chats);
    const filteredChatsConfig = useMemo(
      () => ({
        ...resolvedChats, // Use the resolved chats from the hook
        pending: [],
        searchQuery,
        activeTab: listType ?? 'all',
      }),
      // We need to include selectedIndex to trigger re-render when it changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [resolvedChats, searchQuery, selectedIndex]
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
      // Only run when search query changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const updateSelection = useCallback((index: number) => {
      setSelectedIndex(index);
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, []);

    useImperativeHandle(ref, () => ({
      selectNext: () => {
        let nextIndex = selectedIndex + 1;
        while (
          nextIndex < listItems.length &&
          isSectionHeader(listItems[nextIndex])
        ) {
          nextIndex++;
        }
        if (nextIndex < listItems.length) {
          updateSelection(nextIndex);
        }
      },
      selectPrevious: () => {
        let nextIndex = selectedIndex - 1;
        while (nextIndex >= 0 && isSectionHeader(listItems[nextIndex])) {
          nextIndex--;
        }
        if (nextIndex >= 0) {
          updateSelection(nextIndex);
        }
      },
      pressSelected: () => {
        const selectedItem = listItems[selectedIndex];
        if (selectedItem && !isSectionHeader(selectedItem)) {
          onPressItem(selectedItem);
        }
      },
      selectChat: (chat: db.Chat) => {
        const index = listItems.findIndex(
          (item) => item.type === chat.type && item.id === chat.id
        );
        if (index >= 0) {
          updateSelection(index);
        }
      },
    }));

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

    const activeSelectionStyles = useMemo(
      () => ({
        backgroundColor: '$positiveBackground',
        borderColor: '$positiveBorder',
      }),
      []
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
              disableOptimization
              model={item}
              onPress={onPressItem}
              onLayout={handleItemLayout}
              // We're rendering the ChatListItem outside of the ChatOptionsProvider, so we need to disable the options
              disableOptions
              showGroupTitle={true}
              borderWidth={'$2xs'}
              marginHorizontal={-1}
              {...(listItems[selectedIndex] === item
                ? activeSelectionStyles
                : {
                    borderColor: 'transparent',
                  })}
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
        activeSelectionStyles,
      ]
    );

    const contentContainerStyle = useMemo(
      () => ({
        padding: getTokenValue('$l', 'size'),
        paddingBottom: 100, // bottom nav height + some cushion
      }),
      []
    );

    return (
      <View flex={1}>
        {searchQuery !== '' && !displayData[0]?.data.length ? (
          <Text color="$tertiaryText" textAlign="center" fontFamily="$body">
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
            {...listProps}
          />
        )}
      </View>
    );
  })
);
