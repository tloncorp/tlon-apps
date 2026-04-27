import { BottomSheetFlashList } from '@gorhom/bottom-sheet';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Text, View, XStack, getTokenValue } from 'tamagui';

import { useFilteredChannelChats } from '../../hooks/useFilteredChannelChats';
import { ForwardChannelListItem } from './ForwardChannelListItem';
import { SearchBar } from './SearchBar';

type ForwardChannelSelectorProps = {
  isOpen: boolean;
  onChannelSelected: (channel: db.Channel) => void;
  channelFilter?: (channel: db.Channel) => boolean;
};

type ChannelChat = db.Chat & { type: 'channel' };

const ITEM_H = 76;
const LIST_HEIGHT_RATIO = 0.68;
const ForwardSheetFlashList = (
  Platform.OS === 'web' ? FlashList : BottomSheetFlashList
) as typeof FlashList;

const getItemType = (chat: ChannelChat) =>
  chat.channel.type === 'dm' || chat.channel.type === 'groupDm'
    ? 'dm'
    : chat.channel.group
      ? 'group'
      : 'channel';

const overrideItemLayout = (layout: { span?: number; size?: number }) => {
  layout.size = ITEM_H;
};

export function ForwardChannelSelector({
  isOpen,
  onChannelSelected,
  channelFilter,
}: ForwardChannelSelectorProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );

  const { channelChats, isSearching } = useFilteredChannelChats({
    mode: isOpen ? 'snapshot' : 'live',
    searchQuery: query,
    channelFilter,
  });

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
      height: Math.floor(screenHeight * LIST_HEIGHT_RATIO),
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
        <View style={estimatedListSize}>
          {isSearching && channelChats.length === 0 ? (
            <Text color="$tertiaryText" textAlign="center" fontFamily="$body">
              No results found
            </Text>
          ) : (
            <ForwardSheetFlashList<ChannelChat>
              data={channelChats}
              extraData={highlightedChannelId}
              contentContainerStyle={contentContainerStyle}
              getItemType={getItemType}
              keyExtractor={(chat) => chat.channel.id}
              overrideItemLayout={overrideItemLayout}
              renderItem={renderItem}
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
