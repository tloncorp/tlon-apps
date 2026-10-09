import {
  FlashList,
  type FlashListRef,
  type ListRenderItem,
} from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { PlainSectionListHeader } from '@tloncorp/ui';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { View, XStack, getTokenValue, isWeb } from 'tamagui';

import { useFilteredChannelChats } from '../../hooks/useFilteredChannelChats';
import { useSheetCoveredHeight } from '../hooks/useSheetCoveredHeight';
import { ForwardChannelListItem } from './ForwardChannelListItem';
import { ListEmptyState } from './ListEmptyState';
import { SearchBar } from './SearchBar';

export type ForwardChannelChat = db.Chat & { type: 'channel' };

type ForwardChannelSelectorProps = {
  // Null clears the selection, when a search hides the chosen row.
  onChannelSelected: (channel: db.Channel | null) => void;
  channelFilter?: (channel: db.Channel) => boolean;
  channelChats?: ForwardChannelChat[];
};

type ChannelChat = ForwardChannelChat;
type SectionLabel = { label: string };
type Row = ChannelChat | SectionLabel;

const isSectionLabel = (row: Row): row is SectionLabel => 'label' in row;

const ITEM_H = 76;
const LIST_HEIGHT_RATIO = 0.68;
const SEARCH_INPUT_PROPS = {
  spellCheck: false,
  autoCapitalize: 'none',
  autoComplete: 'off',
  returnKeyType: 'search',
} as const;
const NATIVE_LIST_FRAME_STYLE = { flex: 1 } as const;
// A search swaps the whole list, so there is no row worth keeping in place.
const MAINTAIN_VISIBLE_CONTENT_POSITION = { disabled: true } as const;
const getItemType = (row: Row) =>
  isSectionLabel(row)
    ? 'label'
    : row.channel.type === 'dm' || row.channel.type === 'groupDm'
      ? 'dm'
      : row.channel.group
        ? 'group'
        : 'channel';
const getRowKey = (row: Row) =>
  isSectionLabel(row) ? `label:${row.label}` : row.channel.id;

export function ForwardChannelSelector({
  onChannelSelected,
  channelFilter,
  channelChats: channelChatsOverride,
}: ForwardChannelSelectorProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlashListRef<Row>>(null);
  const [query, setQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );

  const { channelChats, isSearching } = useFilteredChannelChats({
    mode: 'snapshot',
    searchQuery: query,
    channelFilter,
    channelChats: channelChatsOverride,
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

  // The list arrives pinned-first, then by recency. Say so when both kinds
  // are present, and say what a search matched, like the contact picker does.
  const rows = useMemo((): Row[] => {
    if (isSearching) {
      return channelChats.length > 0
        ? [{ label: `Chats matching ‘${query}’` }, ...channelChats]
        : [];
    }
    const pinned = channelChats.filter((chat) => chat.pin);
    if (pinned.length === 0 || pinned.length === channelChats.length) {
      return channelChats;
    }
    return [
      { label: 'Pinned' },
      ...pinned,
      { label: 'Recent' },
      ...channelChats.filter((chat) => !chat.pin),
    ];
  }, [channelChats, isSearching, query]);

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item }) =>
      isSectionLabel(item) ? (
        <PlainSectionListHeader>
          <PlainSectionListHeader.Text>
            {item.label}
          </PlainSectionListHeader.Text>
        </PlainSectionListHeader>
      ) : (
        <ForwardChannelListItem
          channel={item.channel}
          selected={highlightedChannelId === item.channel.id}
          onPress={handleChannelSelected}
        />
      ),
    [handleChannelSelected, highlightedChannelId]
  );

  // The rows keep their place under the sheet's footer and the keyboard, so
  // the list needs that much more room to scroll its last rows clear of them.
  const coveredHeight = useSheetCoveredHeight();
  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: getTokenValue('$xl', 'size'),
      paddingTop: getTokenValue('$s', 'size'),
      paddingBottom: 100 + coveredHeight,
    }),
    [coveredHeight]
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
      {/* The title's icon, the labels and the avatars share one line, a
          row's own padding in from here. The field reaches past that line by
          its corner radius, which is the same amount. The space above matches
          the contact pickers' gap between header and search. */}
      <XStack paddingHorizontal="$xl" paddingTop="$l">
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
          <FlashList<Row>
            ref={listRef}
            data={rows}
            maintainVisibleContentPosition={MAINTAIN_VISIBLE_CONTENT_POSITION}
            extraData={highlightedChannelId}
            contentContainerStyle={contentContainerStyle}
            getItemType={getItemType}
            keyExtractor={getRowKey}
            renderItem={renderItem}
            drawDistance={ITEM_H * 8}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
          />
        )}
      </View>
    </>
  );
}
