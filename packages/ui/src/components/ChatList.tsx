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
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  SectionListData,
  SectionListRenderItemInfo,
  StyleProp,
  ViewStyle,
  ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Text, View, YStack, useStyle } from 'tamagui';

import { interactionWithTiming } from '../utils/animation';
import { TextInputWithIcon } from './Form';
import { ChatListItem, InteractableChatListItem } from './ListItem';
import Pressable from './Pressable';
import { SectionListHeader } from './SectionList';
import { Tabs } from './Tabs';

export type Chat = db.Channel | db.Group;

export type TabName = 'all' | 'groups' | 'messages';

type ChatListItemData = Chat;
type ChatListSectionData = SectionListData<
  Chat,
  { title: string; data: ChatListItemData[] }
>;

export const ChatList = React.memo(function ChatListComponent({
  pinned,
  unpinned,
  pendingChats,
  onLongPressItem,
  onPressItem,
  onPressMenuButton,
  onSectionChange,
  activeTab,
  setActiveTab,
  showSearchInput,
  searchQuery,
  onSearchQueryChange,
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
}) {
  const displayData = useFilteredChats({
    pinned,
    unpinned,
    pending: pendingChats,
    searchQuery,
    activeTab,
  });

  const contentContainerStyle = useStyle(
    {
      gap: '$s',
      padding: '$l',
      paddingBottom: 100, // bottom nav height + some cushion
    },
    { resolveValues: 'value' }
  ) as StyleProp<ViewStyle>;

  const renderItem = useCallback(
    ({
      item,
    }: SectionListRenderItemInfo<ChatListItemData, ChatListSectionData>) => {
      const itemModel = item as Chat;

      if (logic.isChannel(itemModel)) {
        return (
          <InteractableChatListItem
            model={itemModel}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
            onPressMenuButton={onPressMenuButton}
          />
        );
      } else {
        return (
          <ChatListItem
            model={itemModel}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        );
      }
    },
    [onPressItem, onLongPressItem, onPressMenuButton]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ChatListSectionData }) => {
      return (
        <SectionListHeader>
          <SectionListHeader.Text>{section.title}</SectionListHeader.Text>
        </SectionListHeader>
      );
    },
    []
  );

  const isAtTopRef = useRef(true);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        return;
      }

      if (!isAtTopRef.current) {
        const { section } = viewableItems[0];
        if (section) {
          onSectionChange?.(section.title);
        }
      }
    }
  ).current;

  const handleScroll = useRef(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const atTop = event.nativeEvent.contentOffset.y === 0;
      if (atTop !== isAtTopRef.current) {
        isAtTopRef.current = atTop;
        if (atTop) {
          onSectionChange?.('Home');
        }
      }
    }
  ).current;

  const handlePressTryAll = useCallback(() => {
    setActiveTab('all');
  }, [setActiveTab]);

  const handlePressClear = useCallback(() => {
    onSearchQueryChange('');
  }, [onSearchQueryChange]);

  return (
    <>
      <ChatListTabs onPressTab={setActiveTab} activeTab={activeTab} />
      <ChatListSearch
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        isOpen={showSearchInput}
      />
      {searchQuery !== '' && !displayData[0]?.data.length ? (
        <SearchResultsEmpty
          activeTab={activeTab}
          onPressClear={handlePressClear}
          onPressTryAll={handlePressTryAll}
        />
      ) : (
        <SectionList
          sections={displayData}
          contentContainerStyle={contentContainerStyle}
          keyExtractor={getChatKey}
          stickySectionHeadersEnabled={false}
          renderItem={renderItem}
          maxToRenderPerBatch={6}
          initialNumToRender={11}
          windowSize={2}
          viewabilityConfig={{
            minimumViewTime: 0,
            itemVisiblePercentThreshold: 0,
            waitForInteraction: false,
          }}
          renderSectionHeader={renderSectionHeader}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={activeTab === 'all' ? handleScroll : undefined}
        />
      )}
    </>
  );
});

function getChatKey(item: unknown) {
  const chatItem = item as Chat;

  if (!chatItem || typeof chatItem !== 'object' || !chatItem.id) {
    return 'invalid-item';
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
}: {
  query: string;
  onQueryChange: (query: string) => void;
  isOpen: boolean;
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
          <TextInputWithIcon
            icon="Search"
            placeholder="Find by name"
            value={query}
            onChangeText={onQueryChange}
            spellCheck={false}
            autoCorrect={false}
            autoCapitalize="none"
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
