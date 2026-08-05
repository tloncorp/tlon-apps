import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@tloncorp/ui';
import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View } from 'tamagui';

import type { SortablePinnedItem } from '../../hooks/usePinnedChatOrdering';
import { ChatListItem } from '../../ui';

// The dnd item id is the `pin.itemId` (TLON-5948), so reordered ids are
// persistable as-is. The `data-testid` lives on the raw `div` wrapper so
// Playwright's `getByTestId` can anchor order assertions per row.
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: '100%',
  };

  const dragHandleProps = {
    ref: setActivatorNodeRef,
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`PinnedSortable-${id}`}>
      {children(dragHandleProps)}
    </div>
  );
}

export function SortablePinnedChats({
  items,
  onReorder,
}: {
  items: SortablePinnedItem[];
  // Receives the reordered visible `pin.itemId`s; resolves false on a failed
  // (and locally reconciled) persistence so we can reset the optimistic order.
  onReorder: (newVisibleOrder: string[]) => Promise<boolean>;
}) {
  const [localItems, setLocalItems] = useState<SortablePinnedItem[]>(items);
  // Serializes reorders: a drop while one is still persisting is ignored, so
  // there's at most one poke in flight (no overlapping-reorder hazard). A ref,
  // not state, so it can't change the size of dnd-kit's sensor dep array.
  const isReorderingRef = useRef(false);
  // Ignore incoming prop updates while a just-dropped order is being persisted,
  // so a transient prop change can't clobber the optimistic order.
  const isUpdatingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when an `items` change is dropped because the guard is up. The effect
  // can't replay it on its own (it already ran for that value), so the guard
  // clearer applies `latestItemsRef.current` instead — otherwise sort mode could
  // stay stuck on stale rows after a tab switch / pin add-remove / DB update that
  // lands during the in-flight reorder or the success delay.
  const ignoredUpdateRef = useRef(false);
  // Always hold the latest props so the failure reset uses the reconciled order,
  // not the (stale) props captured when the drag started.
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

  useEffect(() => {
    if (isUpdatingRef.current) {
      ignoredUpdateRef.current = true;
      return;
    }
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Constant-size sensor array — never swap it for `[]`, or dnd-kit's internal
  // useEffect dep array changes size between renders (React warning).
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      // Ignore a drop while a reorder is still in flight (serialize).
      if (isReorderingRef.current) {
        return;
      }
      const from = localItems.findIndex((item) => item.id === active.id);
      const to = localItems.findIndex((item) => item.id === over.id);
      if (from === -1 || to === -1) {
        return;
      }

      const reordered = arrayMove(localItems, from, to);
      setLocalItems(reordered);
      isUpdatingRef.current = true;
      isReorderingRef.current = true;
      try {
        const ok = await onReorder(reordered.map((item) => item.id));
        if (!ok) {
          // Reset to the latest (reconciled) props and clear the guard now so
          // neither the reset nor a follow-up reconciled prop is swallowed. This
          // already applies the latest props, so any ignored update is satisfied.
          setLocalItems(latestItemsRef.current);
          isUpdatingRef.current = false;
          ignoredUpdateRef.current = false;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        } else {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            isUpdatingRef.current = false;
            timeoutRef.current = null;
            // Replay any prop update the effect dropped while the guard was up,
            // so the list converges to the latest order instead of stale rows.
            if (ignoredUpdateRef.current) {
              ignoredUpdateRef.current = false;
              setLocalItems(latestItemsRef.current);
            }
          }, 500);
        }
      } finally {
        isReorderingRef.current = false;
      }
    },
    [localItems, onReorder]
  );

  const draggableIds = localItems.map((item) => item.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={draggableIds}
        strategy={verticalListSortingStrategy}
      >
        {localItems.map((item) => (
          <SortableRow key={item.id} id={item.id}>
            {(dragHandleProps) => (
              <View flexDirection="row" alignItems="center" width="100%">
                <View flex={1}>
                  {/* In sort mode: no press handler (suppress navigation) and
                      disableOptions (suppress hover-overflow + contextmenu). */}
                  <ChatListItem model={item.chat} disableOptions />
                </View>
                <View
                  {...dragHandleProps}
                  cursor="grab"
                  paddingHorizontal="$m"
                  testID={`PinnedDragHandle-${item.id}`}
                >
                  <Icon color="$tertiaryText" type="Sorter" size="$m" />
                </View>
              </View>
            )}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}
