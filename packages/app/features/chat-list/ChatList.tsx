import { FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import { Pressable, Text } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getTokenValue } from 'tamagui';

import { SectionedChatData } from '../../hooks/useFilteredChats';
import { usePinnedChatOrdering } from '../../hooks/usePinnedChatOrdering';
import { useRenderCount } from '../../hooks/useRenderCount';
import {
  ChatListItem,
  InteractableChatListItem,
  SectionListHeader,
  useChatOptions,
} from '../../ui';
import {
  ChatListItemData,
  PINNED_SECTION_TITLE,
  buildChatListFlashListProps,
  getChatKey,
  getItemType,
  isSectionHeader,
  splitPinnedSection,
} from './ChatList.helpers';
import { SortablePinnedChats } from './SortablePinnedChats';

export type { ChatListItemData } from './ChatList.helpers';
export { getChatKey, getItemType, isSectionHeader } from './ChatList.helpers';

export const ChatList = React.memo(function ChatListComponent({
  data,
  allPinnedChats,
  onPressItem,
  onLoad,
  disableScrollAnchoring,
  scrollerTestID,
}: {
  data: SectionedChatData;
  // Full unfiltered pinned set (for filtered-tab full-order reconstruction). If
  // omitted, the visible pinned subset is used (correct for full-set views).
  allPinnedChats?: db.Chat[];
  onPressItem?: (chat: db.Chat) => void;
  onLoad?: () => void;
  disableScrollAnchoring?: boolean;
  scrollerTestID?: string;
}) {
  // The pinned section renders as the FlashList ListHeaderComponent (sortable),
  // and only the non-pinned sections feed the virtualized list (TLON-5948 §5.5).
  const { pinned, rest } = useMemo(() => splitPinnedSection(data), [data]);

  // Sort mode is owned here so a single toggle in the pinned header serves every
  // surface (mobile, Home, Messages) with no per-call-site wiring.
  const [isSortMode, setIsSortMode] = useState(false);
  // Force-exit sort mode when the pinned section disappears (search, or the last
  // pin removed mid-sort).
  useEffect(() => {
    if (pinned.length === 0 && isSortMode) {
      setIsSortMode(false);
    }
  }, [pinned.length, isSortMode]);

  const { sortableItems, handleReorder } = usePinnedChatOrdering({
    allPinned: allPinnedChats ?? pinned,
    visiblePinned: pinned,
  });

  const flashListProps = useMemo(
    () => buildChatListFlashListProps({ data: rest, disableScrollAnchoring }),
    [rest, disableScrollAnchoring]
  );
  const listItems: ChatListItemData[] = flashListProps.data;

  const { open } = useChatOptions();
  const handleLongPress = useCallback(
    (item: db.Chat) => {
      if (!item.isPending) {
        open(item.id, item.type);
      }
    },
    [open]
  );

  // removed the use of useStyle here because it was causing FlashList to
  // peg the CPU and freeze the app on web
  // see: https://github.com/Shopify/flash-list/pull/852
  const contentContainerStyle = {
    padding: getTokenValue('$l', 'size'),
    paddingBottom: 100, // bottom nav height + some cushion
  };

  const listItemHoverStyle = useMemo(
    () => ({ backgroundColor: '$secondaryBackground' }),
    []
  );

  // A single interactive chat row, shared by the virtualized rest-list and the
  // non-sort-mode pinned block in the header.
  const renderChat = useCallback(
    (item: db.Chat) => {
      if (item.type === 'channel' && !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            hoverStyle={listItemHoverStyle}
            testID={`ChatListItem-${item.channel.title ?? item.channel.id}-${item.pin ? 'pinned' : 'unpinned'}`}
          />
        );
      } else if (item.type === 'group' && !item.isPending) {
        return (
          <InteractableChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            hoverStyle={listItemHoverStyle}
            testID={`ChatListItem-${item.group.title ?? item.group.id}-${item.pin ? 'pinned' : 'unpinned'}`}
          />
        );
      } else {
        return (
          <ChatListItem
            model={item}
            onPress={onPressItem}
            onLongPress={handleLongPress}
            disableOptions={item.isPending}
            hoverStyle={listItemHoverStyle}
          />
        );
      }
    },
    [onPressItem, handleLongPress, listItemHoverStyle]
  );

  const renderItem: ListRenderItem<ChatListItemData> = useCallback(
    ({ item }) => {
      if (isSectionHeader(item)) {
        return (
          <SectionListHeader>
            <SectionListHeader.Text>{item.title}</SectionListHeader.Text>
          </SectionListHeader>
        );
      }
      return renderChat(item);
    },
    [renderChat]
  );

  // The pinned section header + rows, rendered above the virtualized list.
  const pinnedHeader = useMemo(() => {
    if (pinned.length === 0) {
      return null;
    }
    return (
      <>
        <SectionListHeader
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <SectionListHeader.Text>
            {PINNED_SECTION_TITLE}
          </SectionListHeader.Text>
          <Pressable
            onPress={() => setIsSortMode((v) => !v)}
            testID="PinnedSortToggle"
          >
            <Text size="$label/s" color="$positiveActionText">
              {isSortMode ? 'Done' : 'Sort'}
            </Text>
          </Pressable>
        </SectionListHeader>
        {isSortMode ? (
          <SortablePinnedChats
            items={sortableItems}
            onReorder={handleReorder}
          />
        ) : (
          pinned.map((chat) => (
            <React.Fragment key={getChatKey(chat)}>
              {renderChat(chat)}
            </React.Fragment>
          ))
        )}
      </>
    );
  }, [pinned, isSortMode, sortableItems, handleReorder, renderChat]);

  useRenderCount('ChatList');

  return (
    <FlashList
      data={listItems}
      contentContainerStyle={contentContainerStyle}
      keyExtractor={getChatKey}
      renderItem={renderItem}
      getItemType={getItemType}
      ListHeaderComponent={pinnedHeader}
      onLoad={onLoad ? () => onLoad() : undefined}
      testID={scrollerTestID}
      maintainVisibleContentPosition={
        flashListProps.maintainVisibleContentPosition
      }
    />
  );
}, isEqual);
