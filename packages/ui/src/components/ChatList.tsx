import { ContentStyle, FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import Fuse from 'fuse.js';
import { debounce } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Text, View, YStack, getTokenValue, useStyle } from 'tamagui';

import { interactionWithTiming } from '../utils/animation';
import { TextInputWithIconAndButton } from './Form';
import { ChatListItem, InteractableChatListItem } from './ListItem';
import Pressable from './Pressable';
import { SectionListHeader } from './SectionList';
import { Tabs } from './Tabs';

export type Chat = db.Channel | db.Group;

export type TabName = 'all' | 'groups' | 'messages';

type SectionHeaderData = { type: 'sectionHeader'; title: string };
type ChatListItemData = Chat | SectionHeaderData;

export const ChatList = React.memo(function ChatListComponent({
  pinned,
  unpinned,
  pendingChats,
  onLongPressItem,
  onPressItem,
  onPressMenuButton,
  activeTab,
  setActiveTab,
  showSearchInput,
  searchQuery,
  onSearchQueryChange,
  onSearchToggle,
}: store.CurrentChats & {
  pendingChats: store.PendingChats;
  onPressItem?: (chat: Chat) => void;
  onLongPressItem?: (chat: Chat) => void;
  onPressMenuButton?: (chat: Chat) => void;
  onSectionChange?: (title: string) => void;
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  showSearchInput: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchToggle: () => void;
}) {
  const displayData = useFilteredChats({
    pinned,
    unpinned,
    pending: pendingChats,
    searchQuery,
    activeTab,
  });

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

  const contentContainerStyle = useStyle(
    {
      padding: '$l',
      paddingBottom: 100, // bottom nav height + some cushion
    },
    { resolveValues: 'value' }
  ) as ContentStyle;

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
        return (
          <SectionListHeader>
            <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
          </SectionListHeader>
        );
      } else if (logic.isChannel(item)) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
            onPressMenuButton={onPressMenuButton}
          />
        );
      } else {
        return (
          <ChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        );
      }
    },
    [onPressItem, onLongPressItem, onPressMenuButton]
  );

  const handlePressTryAll = useCallback(() => {
    setActiveTab('all');
  }, [setActiveTab]);

  const handlePressClear = useCallback(() => {
    onSearchQueryChange('');
  }, [onSearchQueryChange]);

  const handlePressClose = useCallback(() => {
    onSearchToggle();
  }, [onSearchToggle]);

  return (
    <>
      <ChatListTabs onPressTab={setActiveTab} activeTab={activeTab} />
      <ChatListSearch
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        isOpen={showSearchInput}
        onPressClear={handlePressClear}
        onPressClose={handlePressClose}
      />
      {searchQuery !== '' && !displayData[0]?.data.length ? (
        <SearchResultsEmpty
          activeTab={activeTab}
          onPressClear={handlePressClear}
          onPressTryAll={handlePressTryAll}
        />
      ) : (
        <FlashList
          data={listItems}
          contentContainerStyle={contentContainerStyle}
          keyExtractor={getChatKey}
          renderItem={renderItem}
          getItemType={getItemType}
          estimatedItemSize={getTokenValue('$6xl', 'size')}
        />
      )}
    </>
  );
});

function getItemType(item: ChatListItemData) {
  return isSectionHeader(item)
    ? 'sectionHeader'
    : logic.isGroup(item)
      ? 'group'
      : logic.isChannel(item)
        ? item.type === 'dm' ||
          item.type === 'groupDm' ||
          item.pin?.type === 'channel'
          ? 'channel'
          : 'groupAdapter'
        : 'default';
}

function isSectionHeader(data: ChatListItemData): data is SectionHeaderData {
  return 'type' in data && data.type === 'sectionHeader';
}

function getChatKey(chatItem: ChatListItemData) {
  if (!chatItem || typeof chatItem !== 'object') {
    return 'invalid-item';
  }

  if (isSectionHeader(chatItem)) {
    return chatItem.title;
  }

  if (logic.isGroup(chatItem)) {
    return chatItem.id;
  }
  return `${chatItem.id}-${chatItem.pin?.itemId ?? ''}`;
}

function ChatListTabs({
  activeTab,
  onPressTab,
}: {
  activeTab: TabName;
  onPressTab: (tab: TabName) => void;
}) {
  return (
    <Tabs>
      <Tabs.Tab name="all" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title active={activeTab === 'all'}>All</Tabs.Title>
      </Tabs.Tab>
      <Tabs.Tab name="groups" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title active={activeTab === 'groups'}>Groups</Tabs.Title>
      </Tabs.Tab>
      <Tabs.Tab name="messages" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title active={activeTab === 'messages'}>Messages</Tabs.Title>
      </Tabs.Tab>
    </Tabs>
  );
}

const ChatListSearch = React.memo(function ChatListSearchComponent({
  isOpen,
  query,
  onQueryChange,
  onPressClear,
  onPressClose,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  isOpen: boolean;
  onPressClear: () => void;
  onPressClose: () => void;
}) {
  const [contentHeight, setContentHeight] = useState(0);

  const openProgress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    if (isOpen) {
      openProgress.value = interactionWithTiming(1, {
        easing: Easing.inOut(Easing.quad),
        duration: 200,
      });
    } else {
      openProgress.value = interactionWithTiming(0, {
        easing: Easing.inOut(Easing.quad),
        duration: 200,
      });
    }
  }, [isOpen, openProgress]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      overflow: 'hidden',
      height: contentHeight * openProgress.value,
      opacity: openProgress.value,
    };
  }, [openProgress, contentHeight]);

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);

  return (
    <Animated.View style={containerStyle}>
      <YStack
        onLayout={handleContentLayout}
        flexShrink={0}
        backgroundColor="$background"
        gap="$m"
        position="absolute"
        top={0}
        left={0}
        right={0}
      >
        <View paddingHorizontal="$l" paddingTop="$xl">
          <TextInputWithIconAndButton
            icon="Search"
            placeholder="Find by name"
            value={query}
            onChangeText={onQueryChange}
            spellCheck={false}
            autoCorrect={false}
            autoCapitalize="none"
            buttonText={query !== '' ? 'Clear' : 'Close'}
            onButtonPress={query !== '' ? onPressClear : onPressClose}
          />
        </View>
      </YStack>
    </Animated.View>
  );
});

function useFilteredChats({
  pinned,
  unpinned,
  pending,
  searchQuery,
  activeTab,
}: {
  pinned: Chat[];
  unpinned: Chat[];
  pending: Chat[];
  searchQuery: string;
  activeTab: TabName;
}) {
  const performSearch = useChatSearch({ pinned, unpinned });
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const searchResults = useMemo(
    () => performSearch(debouncedQuery),
    [debouncedQuery, performSearch]
  );

  return useMemo(() => {
    const isSearching = searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: filterChats(pinned, activeTab),
      };
      const allSection = {
        title: 'All',
        data: [...pending, ...filterChats(unpinned, activeTab)],
      };
      return pinnedSection.data.length
        ? [pinnedSection, allSection]
        : [allSection];
    } else {
      return [
        {
          title: 'Search results',
          data: filterChats(searchResults, activeTab),
        },
      ];
    }
  }, [activeTab, pending, searchQuery, searchResults, unpinned, pinned]);
}

function filterChats(chats: Chat[], activeTab: TabName) {
  if (activeTab === 'all') return chats;
  return chats.filter((chat) => {
    const isGroupChannel = logic.isGroupChannelId(chat.id);
    return activeTab === 'groups' ? isGroupChannel : !isGroupChannel;
  });
}

function useChatSearch({
  pinned,
  unpinned,
}: {
  pinned: Chat[];
  unpinned: Chat[];
}) {
  const fuse = useMemo(() => {
    const allData = [...pinned, ...unpinned];
    return new Fuse(allData, {
      keys: [
        'id',
        'group.title',
        'contact.nickname',
        'members.contact.nickname',
        'members.contact.id',
      ],
      threshold: 0.3,
    });
  }, [pinned, unpinned]);

  const performSearch = useCallback(
    (query: string) => {
      return fuse.search(query).map((result) => result.item);
    },
    [fuse]
  );

  return performSearch;
}

function useDebouncedValue<T>(input: T, delay: number) {
  const [value, setValue] = useState<T>(input);
  const debouncedSetValue = useMemo(
    () => debounce(setValue, delay, { leading: true }),
    [delay]
  );
  useLayoutEffect(() => {
    debouncedSetValue(input);
  }, [debouncedSetValue, input]);
  return value;
}

function SearchResultsEmpty({
  activeTab,
  onPressClear,
  onPressTryAll,
}: {
  activeTab: TabName;
  onPressTryAll: () => void;
  onPressClear: () => void;
}) {
  return (
    <YStack
      gap="$l"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$l"
      paddingVertical="$m"
    >
      <Text>No results found.</Text>
      {activeTab !== 'all' && (
        <Pressable onPress={onPressTryAll}>
          <Text textDecorationLine="underline">Try in All?</Text>
        </Pressable>
      )}
      <Pressable onPress={onPressClear}>
        <Text color="$positiveActionText">Clear search</Text>
      </Pressable>
    </YStack>
  );
}
