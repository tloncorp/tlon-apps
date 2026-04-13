import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

export function ForwardChannelSelector({
  isOpen,
  onChannelSelected,
  channelFilter,
}: ForwardChannelSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const { channelChats, isSearching } = useFilteredChannelChats({
    searchQuery: query,
    channelFilter,
  });
  const handleQueryChanged = useCallback((newQuery: string) => {
    setQuery(newQuery);
    // Reset any explicit row selection when the result set changes.
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
    ({ item }: { item: ChannelChat }) => (
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

  return (
    <>
      <XStack paddingHorizontal="$xl">
        <SearchBar
          placeholder="Search channels"
          onChangeQuery={handleQueryChanged}
          debounceTime={0}
        ></SearchBar>
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
              keyExtractor={(chat) => chat.channel.id}
              renderItem={renderItem}
              renderScrollComponent={(props) => (
                <ActionSheet.ScrollableContent
                  {...(props as ComponentProps<
                    typeof ActionSheet.ScrollableContent
                  >)}
                />
              )}
              keyboardShouldPersistTaps="always"
            />
          )}
        </View>
      ) : null}
    </>
  );
}
