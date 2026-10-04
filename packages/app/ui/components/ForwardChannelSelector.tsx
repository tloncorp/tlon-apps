import {
  FlashList,
  type FlashListRef,
  type ListRenderItem,
} from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { View, XStack, getTokenValue, isWeb } from 'tamagui';

import { useFilteredChannelChats } from '../../hooks/useFilteredChannelChats';
import { ForwardChannelListItem } from './ForwardChannelListItem';
import { ListEmptyState } from './ListEmptyState';
import { SearchBar } from './SearchBar';

type ForwardChannelSelectorProps = {
  // Null clears the selection, when a search hides the chosen row.
  onChannelSelected: (channel: db.Channel | null) => void;
  channelFilter?: (channel: db.Channel) => boolean;
};

type ChannelChat = db.Chat & { type: 'channel' };

const ITEM_H = 76;
const LIST_HEIGHT_RATIO = 0.68;
const SEARCH_INPUT_PROPS = {
  spellCheck: false,
  autoCapitalize: 'none',
  autoComplete: 'off',
} as const;
const NATIVE_LIST_FRAME_STYLE = { flex: 1 } as const;
// A search swaps the whole list, so there is no row worth keeping in place.
const MAINTAIN_VISIBLE_CONTENT_POSITION = { disabled: true } as const;
const getItemType = (chat: ChannelChat) =>
  chat.channel.type === 'dm' || chat.channel.type === 'groupDm'
    ? 'dm'
    : chat.channel.group
      ? 'group'
      : 'channel';

export function ForwardChannelSelector({
  onChannelSelected,
  channelFilter,
}: ForwardChannelSelectorProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlashListRef<ChannelChat>>(null);
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );

  const { channelChats, isSearching } = useFilteredChannelChats({
    mode: 'snapshot',
    searchQuery: query,
    channelFilter,
  });

  const handleQueryChanged = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      setSelectedChannelId(null);
      onChannelSelected(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [onChannelSelected]
  );

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
      padding: getTokenValue('$xl', 'size'),
      paddingBottom: 100,
    }),
    []
  );

  // A native sheet bounds its content, so the list fills what is left above
  // the footer and the keyboard. A web dialog sizes to its content, so the
  // list needs a height of its own there.
  const listFrameStyle = useMemo(
    () =>
      isWeb
        ? {
            width: screenWidth,
            height: Math.floor(screenHeight * LIST_HEIGHT_RATIO),
          }
        : NATIVE_LIST_FRAME_STYLE,
    [screenWidth, screenHeight]
  );

  return (
    <>
      <XStack paddingHorizontal="$xl">
        <SearchBar
          placeholder="Search channels"
          onChangeQuery={handleQueryChanged}
          debounceTime={0}
          inputProps={SEARCH_INPUT_PROPS}
        />
      </XStack>

      <View style={listFrameStyle}>
        {isSearching && channelChats.length === 0 ? (
          <ListEmptyState
            title="No results found"
            subtitle="Try a different name"
          />
        ) : (
          <FlashList<ChannelChat>
            ref={listRef}
            data={channelChats}
            maintainVisibleContentPosition={MAINTAIN_VISIBLE_CONTENT_POSITION}
            extraData={highlightedChannelId}
            contentContainerStyle={contentContainerStyle}
            getItemType={getItemType}
            keyExtractor={(chat) => chat.channel.id}
            renderItem={renderItem}
            drawDistance={ITEM_H * 8}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
          />
        )}
      </View>
    </>
  );
}
