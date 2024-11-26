import { FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import Fuse from 'fuse.js';
import { debounce, get } from 'lodash';
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
import { Text, View, YStack, getTokenValue } from 'tamagui';

import { useCalm } from '../contexts';
import { interactionWithTiming } from '../utils/animation';
import { TextInputWithIconAndButton } from './Form';
import { ChatListItem, InteractableChatListItem } from './ListItem';
import Pressable from './Pressable';
import { SectionListHeader } from './SectionList';
import { Tabs } from './Tabs';

export type TabName = 'all' | 'groups' | 'messages';

type SectionHeaderData = { type: 'sectionHeader'; title: string };
type ChatListItemData = db.Chat | SectionHeaderData;

export const ChatList = React.memo(function ChatListComponent({
  pinned,
  unpinned,
  pending,
  onLongPressItem,
  onPressItem,
  activeTab,
  setActiveTab,
  showSearchInput,
  searchQuery,
  onSearchQueryChange,
  onSearchToggle,
}: db.GroupedChats & {
  onPressItem?: (chat: db.Chat) => void;
  onLongPressItem?: (chat: db.Chat) => void;
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
    pending,
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

  // removed the use of useStyle here because it was causing FlashList to
  // peg the CPU and freeze the app on web
  // see: https://github.com/Shopify/flash-list/pull/852
  const contentContainerStyle = {
    padding: getTokenValue('$l', 'size'),
    paddingBottom: 100, // bottom nav height + some cushion
  };

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
        return (
          <SectionListHeader>
            <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
          </SectionListHeader>
        );
      } else if (item.type === 'channel' || !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
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
    [onPressItem, onLongPressItem]
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
  return isSectionHeader(item) ? 'sectionHeader' : item.type;
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
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
  searchQuery: string;
  activeTab: TabName;
}) {
  const performSearch = useChatSearch({ pinned, unpinned, pending });
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const searchResults = useMemo(
    () => performSearch(debouncedQuery),
    [debouncedQuery, performSearch]
  );

  return useMemo(() => {
    const isSearching = searchQuery && searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: filterChats(pinned, activeTab),
      };
      const allSection = {
        title: 'All',
        data: [
          ...filterPendingChats(pending, activeTab),
          ...filterChats(unpinned, activeTab),
        ],
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

function filterPendingChats(pending: db.Chat[], activeTab: TabName) {
  if (activeTab === 'all') return pending;
  return pending.filter((chat) => {
    const isGroup = chat.type === 'group';
    return activeTab === 'groups' ? isGroup : !isGroup;
  });
}

function filterChats(chats: db.Chat[], activeTab: TabName) {
  if (activeTab === 'all') return chats;
  return chats.filter((chat) => {
    const isGroup = chat.type === 'group';
    return activeTab === 'groups' ? isGroup : !isGroup;
  });
}

function useChatSearch({
  pinned,
  unpinned,
  pending,
}: {
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
}) {
  const { disableNicknames } = useCalm();

  const fuse = useMemo(() => {
    const allData = [...pinned, ...unpinned, ...pending];
    return new Fuse(allData, {
      keys: [
        {
          name: 'title',
          getFn: (chat: db.Chat) => {
            const title = getChatTitle(chat, disableNicknames);
            return Array.isArray(title)
              ? title.map(normalizeString)
              : normalizeString(title);
          },
        },
      ],
    });
  }, [pinned, unpinned, pending, disableNicknames]);

  function normalizeString(str: string) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  const performSearch = useCallback(
    (query: string) => {
      // necessary for web, otherwise fuse.search will throw
      // an error
      if (!query) return [];
      return fuse.search(query).map((result) => result.item);
    },
    [fuse]
  );

  return performSearch;
}

function getChatTitle(
  chat: db.Chat,
  disableNicknames: boolean
): string | string[] {
  if (chat.type === 'channel') {
    if (chat.channel.title) {
      return chat.channel.title;
    } else if (chat.channel.members) {
      return chat.channel.members
        .map((member) => {
          const nickname = member.contact
            ? (member.contact as db.Contact).nickname
            : null;
          return nickname && !disableNicknames ? nickname : member.contactId;
        })
        .join(', ');
    } else {
      return [];
    }
  } else {
    if (chat.group.title) {
      return chat.group.title;
    } else {
      return [];
    }
  }
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
