import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Text, View, XStack, getTokenValue } from 'tamagui';

import { useFilteredChannelChats } from '../../hooks/useFilteredChannelChats';
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
    isOpen,
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
