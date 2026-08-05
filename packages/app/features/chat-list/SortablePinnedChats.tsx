import { Icon } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import Sortable, { SortableGridRenderItem } from 'react-native-sortables';
import { View } from 'tamagui';

import type { SortablePinnedItem } from '../../hooks/usePinnedChatOrdering';
import { ChatListItem } from '../../ui';

/**
 * Native sortable pinned section (TLON-5948 phase 3), using
 * `react-native-sortables` per the Manage Channels precedent.
 *
 * Drag-reorder, gesture interaction, and the nesting inside the ChatList
 * `FlashList` ListHeaderComponent were confirmed on iOS + Android. `scrollableRef`
 * is intentionally omitted, so autoscroll won't engage for a pinned list taller
 * than the viewport — an accepted out-of-scope deviation (see execution-summary
 * "Punted"); wiring the FlashList scrollable through is the fallback if needed.
 *
 * The dnd item id is `pin.itemId` (so `indexToKey` is the persistable order),
 * rows render the plain `ChatListItem` (no `ReanimatedSwipeable` swipe) with
 * `disableOptions` and no press, and concurrent reorders are gated via
 * `sortEnabled` while one is persisting (the grid re-renders from `data`, so no
 * local optimistic mirror is needed).
 */
export function SortablePinnedChats({
  items,
  onReorder,
}: {
  items: SortablePinnedItem[];
  onReorder: (newVisibleOrder: string[]) => Promise<boolean>;
}) {
  const [isPersisting, setIsPersisting] = useState(false);
  // Bumped on a failed persist to force-remount `Sortable.Grid` so its internal
  // key order rebuilds from the (rolled-back) `items` prop. react-native-sortables
  // keeps its own `indexToKey` after a drag and won't rebuild on a prop change
  // alone, so a failed drop would otherwise stay on screen and seed later drags
  // from a non-authoritative order. Native analogue of the web false-result reset.
  const [resetKey, setResetKey] = useState(0);

  const renderItem: SortableGridRenderItem<SortablePinnedItem> = useCallback(
    ({ item }) => (
      <View flexDirection="row" alignItems="center" width="100%">
        <View flex={1}>
          <ChatListItem model={item.chat} disableOptions />
        </View>
        <Sortable.Handle>
          <View paddingHorizontal="$m" testID={`PinnedDragHandle-${item.id}`}>
            <Icon color="$tertiaryText" type="Sorter" size="$m" />
          </View>
        </Sortable.Handle>
      </View>
    ),
    []
  );

  const handleDropped = useCallback(
    async ({ indexToKey }: { indexToKey: string[] }) => {
      setIsPersisting(true);
      try {
        const ok = await onReorder(indexToKey);
        if (!ok) {
          // Persist failed (and the store reconciled/rolled back the DB). Rebuild
          // the grid's internal order from the authoritative `items` prop.
          setResetKey((k) => k + 1);
        }
      } finally {
        setIsPersisting(false);
      }
    },
    [onReorder]
  );

  return (
    <Sortable.Grid
      key={resetKey}
      columns={1}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      activeItemScale={1.05}
      enableActiveItemSnap={false}
      customHandle
      sortEnabled={!isPersisting}
      dragActivationDelay={0}
      onActiveItemDropped={handleDropped}
    />
  );
}
