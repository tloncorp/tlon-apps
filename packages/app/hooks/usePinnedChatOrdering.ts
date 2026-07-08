import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import {
  mergeVisibleOrderIntoFull,
  reorderVisible,
} from './usePinnedChatOrdering.helpers';

export {
  mergeVisibleOrderIntoFull,
  reorderVisible,
} from './usePinnedChatOrdering.helpers';

export type SortablePinnedItem = { id: string; chat: db.Chat };

/**
 * Shared, platform-agnostic ordering logic for the pinned ChatList section
 * (TLON-5948). Maps the visible (tab-filtered) pinned chats to sortable items
 * keyed by `pin.itemId`, and reconstructs the full global pin order from a
 * visible-subset reorder before persisting — so reordering in a filtered tab
 * never drops or relocates a pin the user can't see.
 *
 * - `allPinned`: the full unfiltered pinned set (sorted by `pin.index`).
 * - `visiblePinned`: the currently-visible (tab-filtered) pinned subset.
 */
export function usePinnedChatOrdering({
  allPinned,
  visiblePinned,
}: {
  allPinned: db.Chat[];
  visiblePinned: db.Chat[];
}) {
  // dnd/sortable item id is `pin.itemId` everywhere (round-13 #1).
  const sortableItems = useMemo<SortablePinnedItem[]>(
    () =>
      visiblePinned
        .filter((c) => c.pin != null)
        .map((c) => ({ id: c.pin!.itemId, chat: c })),
    [visiblePinned]
  );

  const visibleIds = useMemo(
    () => sortableItems.map((item) => item.id),
    [sortableItems]
  );

  const fullOrder = useMemo(
    () => allPinned.filter((c) => c.pin != null).map((c) => c.pin!.itemId),
    [allPinned]
  );

  // `newVisibleOrder` is the reordered visible `pin.itemId`s straight from dnd.
  // The merged full order is written optimistically; only the visible ids the
  // user reordered are sent to the backend (so hidden pins keep their server
  // slots — see store.reorderPinnedItems).
  const handleReorder = useCallback(
    async (newVisibleOrder: string[]): Promise<boolean> => {
      const newFull = mergeVisibleOrderIntoFull(
        fullOrder,
        visibleIds,
        newVisibleOrder
      );
      return store.reorderPinnedItems({
        optimisticOrder: newFull,
        backendOrder: newVisibleOrder,
      });
    },
    [fullOrder, visibleIds]
  );

  return { sortableItems, visibleIds, handleReorder };
}
