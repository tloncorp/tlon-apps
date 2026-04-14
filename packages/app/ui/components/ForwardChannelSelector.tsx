import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWindowDimensions } from 'react-native';
import { Text, View, XStack, getTokenValue } from 'tamagui';

import { useChatSearch } from '../../hooks/useChatSearch';
import { useFilteredChannelChats } from '../../hooks/useFilteredChannelChats';
import { useCalm } from '../../ui';
import { ActionSheet } from './ActionSheet';
import { ForwardChannelListItem } from './ForwardChannelListItem';
import { SearchBar } from './SearchBar';

type ForwardChannelSelectorProps = {
  isOpen: boolean;
  onChannelSelected: (channel: db.Channel) => void;
  channelFilter?: (channel: db.Channel) => boolean;
};

type ChannelChat = db.Chat & { type: 'channel' };

const ITEM_H = 76;

const getItemType = (chat: ChannelChat) =>
  chat.channel.type === 'dm' || chat.channel.type === 'groupDm'
    ? 'dm'
    : chat.channel.group
      ? 'group'
      : 'channel';

function useFrozenChannelChats({
  isOpen,
  channelFilter,
}: {
  isOpen: boolean;
  channelFilter?: (channel: db.Channel) => boolean;
}) {
  const { channelChats: liveChannelChats } = useFilteredChannelChats({
    searchQuery: '',
    channelFilter,
  });
  const liveChannelChatsRef = useRef(liveChannelChats);
  liveChannelChatsRef.current = liveChannelChats;
  const [frozenChannelChats, setFrozenChannelChats] =
    useState<ChannelChat[]>(liveChannelChats);

  useEffect(() => {
    if (isOpen) {
      setFrozenChannelChats(liveChannelChatsRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFrozenChannelChats((current) =>
      current.length < liveChannelChats.length
        ? liveChannelChatsRef.current
        : current
    );
  }, [isOpen, liveChannelChats.length]);

  return frozenChannelChats;
}

export function ForwardChannelSelector({
  isOpen,
  onChannelSelected,
  channelFilter,
}: ForwardChannelSelectorProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { disableNicknames } = useCalm();
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const frozenChannelChats = useFrozenChannelChats({ isOpen, channelFilter });
  const {
    isSearching,
    results: searchResults,
    allChats,
  } = useChatSearch({
    chats: frozenChannelChats,
    searchQuery: query,
    debounceMs: 0,
    disableNicknames,
  });
  const channelChats = isSearching ? searchResults : allChats;

  const handleQueryChanged = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedChannelId(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedChannelId(null);
    }
  }, [isOpen]);

  const highlightedChannelId = useMemo(() => {
    if (!selectedChannelId) {
      return null;
    }

    return channelChats.some((chat) => chat.channel.id === selectedChannelId)
      ? selectedChannelId
      : null;
  }, [channelChats, selectedChannelId]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      setSelectedChannelId(channel.id);
      onChannelSelected(channel);
    },
    [onChannelSelected]
  );

  const renderItem: ListRenderItem<ChannelChat> = useCallback(
    ({ item }) => (
      <ForwardChannelListItem
        channel={item.channel}
        selected={highlightedChannelId === item.channel.id}
        onPress={handleChannelSelected}
      />
    ),
    [handleChannelSelected, highlightedChannelId]
  );

  const contentContainerStyle = useMemo(
    () => ({
      padding: getTokenValue('$l', 'size'),
      paddingBottom: 100,
    }),
    []
  );

  const estimatedListSize = useMemo(
    () => ({
      width: screenWidth,
      height: Math.floor(screenHeight * 0.55),
    }),
    [screenWidth, screenHeight]
  );

  return (
    <>
      <XStack paddingHorizontal="$xl">
        <SearchBar
          placeholder="Search channels"
          onChangeQuery={handleQueryChanged}
          debounceTime={0}
        />
      </XStack>

      {isOpen ? (
        <View flex={1} minHeight={200}>
          {isSearching && channelChats.length === 0 ? (
            <Text color="$tertiaryText" textAlign="center" fontFamily="$body">
              No results found
            </Text>
          ) : (
            <FlashList<ChannelChat>
              data={channelChats}
              extraData={highlightedChannelId}
              contentContainerStyle={contentContainerStyle}
              getItemType={getItemType}
              keyExtractor={(chat) => chat.channel.id}
              overrideItemLayout={(layout) => {
                layout.size = ITEM_H;
              }}
              renderItem={renderItem}
              renderScrollComponent={(props) => (
                <ActionSheet.ScrollableContent
                  {...(props as ComponentProps<
                    typeof ActionSheet.ScrollableContent
                  >)}
                />
              )}
              drawDistance={ITEM_H * 8}
              estimatedItemSize={ITEM_H}
              estimatedListSize={estimatedListSize}
              keyboardShouldPersistTaps="always"
            />
          )}
        </View>
      ) : null}
    </>
  );
}
