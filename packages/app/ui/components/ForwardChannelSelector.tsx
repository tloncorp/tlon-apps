import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Text, View, XStack, getTokenValue } from 'tamagui';

import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useResolvedChats } from '../../hooks/useResolvedChats';
import { ActionSheet } from './ActionSheet';
import { ForwardChannelListItem } from './ForwardChannelListItem';
import { SearchBar } from './SearchBar';

type ForwardChannelSelectorProps = {
  isOpen: boolean;
  onChannelSelected: (channel: db.Channel) => void;
  channelFilter?: (channel: db.Channel) => boolean;
};

export function ForwardChannelSelector({
  isOpen,
  onChannelSelected,
  channelFilter,
}: ForwardChannelSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const { data: chats } = store.useCurrentChats();
  const resolvedChats = useResolvedChats(chats);
  const filteredChatsConfig = useMemo(
    () => ({
      ...resolvedChats,
      pending: [],
      searchQuery: query,
      activeTab: 'channels' as const,
    }),
    [resolvedChats, query]
  );
  const displayData = useFilteredChats(filteredChatsConfig);

  const channels = useMemo(() => {
    const allChats = displayData.flatMap((section) => section.data);

    // TODO: Move this closer to the query if this list gets big. For now,
    // keep the filtering here for the share-target picker.
    return allChats
      .flatMap((chat) => (chat.type === 'channel' ? [chat.channel] : []))
      .filter((channel) => (channelFilter ? channelFilter(channel) : true));
  }, [channelFilter, displayData]);

  const handleQueryChanged = useCallback((newQuery: string) => {
    setQuery(newQuery);
    // Reset explicit row selection on a new query so top result is highlighted.
    setSelectedChannelId(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedChannelId(null);
    }
  }, [isOpen]);

  const highlightedChannelId = useMemo(() => {
    if (!channels.length) {
      return null;
    }
    if (selectedChannelId && channels.some((c) => c.id === selectedChannelId)) {
      return selectedChannelId;
    }
    return channels[0].id;
  }, [channels, selectedChannelId]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      setSelectedChannelId(channel.id);
      onChannelSelected(channel);
    },
    [onChannelSelected]
  );

  const renderItem: ListRenderItem<db.Channel> = useCallback(
    ({ item }: { item: db.Channel }) => (
      <ForwardChannelListItem
        channel={item}
        selected={highlightedChannelId === item.id}
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

  const isSearching = query.trim() !== '';

  return (
    <>
      <XStack paddingHorizontal="$xl">
        <SearchBar
          placeholder="Search channels"
          onChangeQuery={handleQueryChanged}
        ></SearchBar>
      </XStack>

      {isOpen ? (
        <View flex={1}>
          {isSearching && channels.length === 0 ? (
            <Text color="$tertiaryText" textAlign="center" fontFamily="$body">
              No results found
            </Text>
          ) : (
            <FlashList<db.Channel>
              data={channels}
              contentContainerStyle={contentContainerStyle}
              keyExtractor={(channel) => channel.id}
              renderItem={renderItem}
              estimatedItemSize={72}
              renderScrollComponent={(props) => (
                <ActionSheet.ScrollableContent
                  {...(props as ComponentProps<
                    typeof ActionSheet.ScrollableContent
                  >)}
                />
              )}
            />
          )}
        </View>
      ) : null}
    </>
  );
}
