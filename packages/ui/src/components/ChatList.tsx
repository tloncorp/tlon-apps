import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import fuzzy from 'fuzzy';
import { debounce } from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
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
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { Text, View, YStack, useStyle } from '../core';
import { Icon } from './Icon';
import { Input } from './Input';
import { ChatListItem, SwipableChatListItem } from './ListItem';
import Pressable from './Pressable';
import { SectionListHeader } from './SectionList';
import { Tabs } from './Tabs';

const DEBOUNCE_DELAY = 200;

export type Chat = db.Channel | db.Group;

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

export function ChatList({
  pinned,
  unpinned,
  pendingChats,
  onLongPressItem,
  onPressItem,
  onSectionChange,
  activeTab,
  setActiveTab,
}: store.CurrentChats & {
  onPressItem?: (chat: Chat) => void;
  onLongPressItem?: (chat: Chat) => void;
  onSectionChange?: (title: string) => void;
  activeTab: 'all' | 'groups' | 'messages';
  setActiveTab: (tab: 'all' | 'groups' | 'messages') => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const scrollY = useSharedValue(0);
  const filterVisible = useSharedValue(false);
  const filteredData = useMemo(() => {
    const filteredPinned = pinned.filter((c) => {
      if (logic.isGroupChannelId(c.id)) {
        return activeTab === 'all' || activeTab === 'groups';
      }
      return activeTab === 'all' || activeTab === 'messages';
    });

    const filteredUnpinned = unpinned.filter((c) => {
      if (logic.isGroupChannelId(c.id)) {
        return activeTab === 'all' || activeTab === 'groups';
      }
      return activeTab === 'all' || activeTab === 'messages';
    });

    return {
      filteredPinned,
      filteredUnpinned,
    };
  }, [activeTab, pinned, unpinned]);

  const sectionedData = useMemo(() => {
    const { filteredPinned, filteredUnpinned } = filteredData;
    if (filteredPinned.length === 0) {
      return [{ title: 'All', data: [...pendingChats, ...filteredUnpinned] }];
    }

    return [
      { title: 'Pinned', data: filteredPinned },
      { title: 'All', data: [...pendingChats, ...filteredUnpinned] },
    ];
  }, [filteredData, pendingChats]);

  const extractForFuzzy = useCallback((item: db.ChannelWithContact) => {
    if (logic.isGroupChannelId(item.id)) {
      return item.group?.title || '';
    }
    if (item.type === 'dm' && item.contact) {
      return item.contact.nickname || item.id;
    }
    if (item.type === 'groupDm') {
      return (item.members || [])
        .map((m) => m.contact?.nickname || m.contact?.id || '')
        .join(' ');
    }
    return item.id;
  }, []);

  const debouncedFuzzySearch = useMemo(
    () =>
      debounce((query) => {
        const results = fuzzy.filter(
          query.trim(),
          [...filteredData.filteredPinned, ...filteredData.filteredUnpinned],
          { extract: extractForFuzzy }
        );
        return results.map((result) => result.original);
      }, DEBOUNCE_DELAY),
    [filteredData, extractForFuzzy]
  );

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === '') {
      return sectionedData;
    }
    const results = debouncedFuzzySearch(searchQuery);

    return results && results.length > 0
      ? [
          {
            title: 'Search',
            data: results,
          },
        ]
      : [{ title: 'Search', data: [] }];
  }, [searchQuery, sectionedData, debouncedFuzzySearch]);

  const contentContainerStyle = useStyle(
    {
      gap: '$s',
      paddingHorizontal: '$l',
    },
    { resolveValues: 'value' }
  ) as StyleProp<ViewStyle>;

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<unknown, unknown>) => {
      const itemModel = item as Chat;
      const baseListItem = (
        <ChatListItem
          model={itemModel}
          onPress={onPressItem}
          onLongPress={onLongPressItem}
        />
      );
      return logic.isChannel(itemModel) ? (
        <SwipableChatListItem model={itemModel}>
          {baseListItem}
        </SwipableChatListItem>
      ) : (
        baseListItem
      );
    },
    [onPressItem, onLongPressItem]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<unknown, unknown> }) => {
      const sectionItem = section as SectionListData<Chat, { title: string }>;
      return (
        <SectionListHeader>
          <SectionListHeader.Text>{sectionItem.title}</SectionListHeader.Text>
        </SectionListHeader>
      );
    },
    []
  );

  const viewabilityConfig = {
    minimumViewTime: 0,
    itemVisiblePercentThreshold: 0,
    waitForInteraction: false,
  };

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

  const FILTER_HEIGHT =
    getTokenValue('$6xl', 'size') + getTokenValue('$4xl', 'size');
  const HEADER_HEIGHT = getTokenValue('$4xl', 'size');
  const SNAP_THRESHOLD = FILTER_HEIGHT / 2;

  const { top } = useSafeAreaInsets();
  const filterStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [-FILTER_HEIGHT, 0],
      [0, -FILTER_HEIGHT],
      Extrapolation.CLAMP
    );

    return {
      height: FILTER_HEIGHT,
      transform: [{ translateY: filterVisible.value ? 0 : translateY }],
      position: 'absolute',
      top: top + HEADER_HEIGHT,
      left: 0,
      right: 0,
      zIndex: 40,
    };
  });

  const listStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: filterVisible.value ? FILTER_HEIGHT : 0 }],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!filterVisible.value) {
        scrollY.value = event.contentOffset.y;
      }
    },
    onEndDrag: (event) => {
      if (event.contentOffset.y < -SNAP_THRESHOLD && !filterVisible.value) {
        filterVisible.value = true;
        scrollY.value = withSpring(-FILTER_HEIGHT);
      } else if (
        event.contentOffset.y > -SNAP_THRESHOLD &&
        filterVisible.value
      ) {
        filterVisible.value = false;
        scrollY.value = withSpring(0);
      }
    },
  });

  const getChannelKey = useCallback((item: unknown) => {
    const chatItem = item as Chat;

    if (!chatItem || typeof chatItem !== 'object' || !chatItem.id) {
      return 'invalid-item';
    }

    if (logic.isGroup(chatItem)) {
      return chatItem.id;
    }
    return `${chatItem.id}-${chatItem.pin?.itemId ?? ''}`;
  }, []);

  return (
    <>
      <Animated.View style={filterStyle}>
        <YStack gap="$m">
          <View paddingHorizontal="$l">
            <Input>
              <Input.Icon>
                <Icon type="Search" />
              </Input.Icon>
              <Input.Area
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Find by name"
                spellCheck={false}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </Input>
          </View>
          <Tabs>
            <Tabs.Tab
              name="all"
              activeTab={activeTab}
              onTabPress={() => setActiveTab('all')}
            >
              <Tabs.Title active={activeTab === 'all'}>All</Tabs.Title>
            </Tabs.Tab>
            <Tabs.Tab
              name="groups"
              activeTab={activeTab}
              onTabPress={() => setActiveTab('groups')}
            >
              <Tabs.Title active={activeTab === 'groups'}>Groups</Tabs.Title>
            </Tabs.Tab>
            <Tabs.Tab
              name="messages"
              activeTab={activeTab}
              onTabPress={() => setActiveTab('messages')}
            >
              <Tabs.Title active={activeTab === 'messages'}>
                Messages
              </Tabs.Title>
            </Tabs.Tab>
          </Tabs>
        </YStack>
      </Animated.View>
      <Animated.View style={listStyle}>
        {searchQuery !== '' && searchResults.length === 0 ? (
          <YStack
            gap="$l"
            alignItems="center"
            justifyContent="center"
            paddingHorizontal="$l"
            paddingVertical="$m"
          >
            <Text>No results found.</Text>
            {activeTab !== 'all' && (
              <Pressable onPress={() => setActiveTab('all')}>
                <Text textDecorationLine="underline">Try in All?</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setSearchQuery('')}>
              <Text color="$positiveActionText">Clear search</Text>
            </Pressable>
          </YStack>
        ) : (
          <AnimatedSectionList
            sections={
              searchQuery && searchResults ? searchResults : sectionedData
            }
            contentContainerStyle={contentContainerStyle}
            keyExtractor={getChannelKey}
            stickySectionHeadersEnabled={false}
            renderItem={renderItem}
            maxToRenderPerBatch={6}
            initialNumToRender={11}
            windowSize={2}
            viewabilityConfig={viewabilityConfig}
            renderSectionHeader={renderSectionHeader}
            onViewableItemsChanged={onViewableItemsChanged}
            onScroll={scrollHandler}
            onMomentumScrollEnd={activeTab === 'all' ? handleScroll : undefined}
            scrollEventThrottle={16}
          />
        )}
      </Animated.View>
    </>
  );
}
