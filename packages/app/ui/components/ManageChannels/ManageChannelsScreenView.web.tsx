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
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { View, YStack } from 'tamagui';

import {
  SortableListItem,
  useChannelOrdering,
} from '../../../hooks/useSortableChannelNav';
import {
  ChannelItem,
  ManageChannelsProvider,
  ManageChannelsScreenViewProps,
  SectionHeader,
  useManageChannelsContext,
} from './ManageChannelsShared';

export function ManageChannelsScreenView({
  group,
  groupNavSectionsWithChannels,
  goBack,
  goToEditChannel,
  createNavSection,
  deleteNavSection,
  updateNavSection,
  updateGroupNavigation,
}: ManageChannelsScreenViewProps) {
  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
  });

  const [localItems, setLocalItems] =
    useState<SortableListItem[]>(sortableNavItems);

  const isUpdatingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isUpdatingRef.current) {
      return;
    }
    setLocalItems(sortableNavItems);
  }, [sortableNavItems]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  return (
    <ManageChannelsProvider
      goBack={goBack}
      group={group}
      createNavSection={createNavSection}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      updateNavSection={updateNavSection}
      deleteNavSection={deleteNavSection}
      updateGroupNavigation={updateGroupNavigation}
    >
      <ManageChannelsContent
        goToEditChannel={goToEditChannel}
        localItems={localItems}
        setLocalItems={setLocalItems}
        isUpdatingRef={isUpdatingRef}
        timeoutRef={timeoutRef}
        sensors={sensors}
        handleActiveItemDropped={handleActiveItemDropped}
      />
    </ManageChannelsProvider>
  );
}

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: any) => React.ReactNode;
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
    <div ref={setNodeRef} style={style}>
      {children(dragHandleProps)}
    </div>
  );
}

function SortableSectionHeader({
  item,
  isEditMode,
  onOpenMenu,
}: {
  item: Extract<SortableListItem, { type: 'section-header' }>;
  isEditMode: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <SortableItem id={item.id}>
      {(dragHandleProps) => (
        <SectionHeader
          index={item.sectionIndex}
          section={item.section}
          isDefault={item.isDefault}
          isEditMode={isEditMode}
          dragHandle={
            <View {...dragHandleProps} cursor="grab">
              <Icon color="$tertiaryText" type="Sorter" size="$m" />
            </View>
          }
          onOpenMenu={onOpenMenu}
        />
      )}
    </SortableItem>
  );
}

function SortableChannelItem({
  item,
  onEdit,
  isEditMode,
}: {
  item: Extract<SortableListItem, { type: 'channel' }>;
  onEdit: () => void;
  isEditMode: boolean;
}) {
  return (
    <SortableItem id={item.id}>
      {(dragHandleProps) => (
        <ChannelItem
          channel={item.channel}
          onEdit={onEdit}
          index={item.channelIndex}
          isEditMode={isEditMode}
          dragHandle={
            <View {...dragHandleProps} cursor="grab">
              <Icon color="$tertiaryText" type="Sorter" size="$m" />
            </View>
          }
        />
      )}
    </SortableItem>
  );
}

function ManageChannelsContent({
  goToEditChannel,
  localItems,
  setLocalItems,
  isUpdatingRef,
  timeoutRef,
  sensors,
  handleActiveItemDropped,
}: {
  goToEditChannel: (channelId: string) => void;
  localItems: SortableListItem[];
  setLocalItems: (items: SortableListItem[]) => void;
  isUpdatingRef: React.MutableRefObject<boolean>;
  timeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  sensors: ReturnType<typeof useSensors>;
  handleActiveItemDropped: ReturnType<
    typeof useChannelOrdering
  >['handleActiveItemDropped'];
}) {
  const { setSectionMenuSection, isEditMode } = useManageChannelsContext();

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeIndex = localItems.findIndex((item) => item.id === active.id);
      const overIndex = localItems.findIndex((item) => item.id === over.id);

      if (activeIndex === -1 || overIndex === -1) {
        return;
      }

      const reordered = arrayMove(localItems, activeIndex, overIndex);
      setLocalItems(reordered);

      const indexToKey = reordered.map((item) => item.id);

      isUpdatingRef.current = true;

      try {
        await handleActiveItemDropped({
          fromIndex: activeIndex,
          toIndex: overIndex,
          indexToKey,
        });
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          isUpdatingRef.current = false;
          timeoutRef.current = null;
        }, 500);
      }
    },
    [
      localItems,
      handleActiveItemDropped,
      setLocalItems,
      isUpdatingRef,
      timeoutRef,
    ]
  );

  const draggableIds = localItems.map((item) => item.id);
  const activeSensors = isEditMode ? sensors : [];

  return (
    <DndContext
      sensors={activeSensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={draggableIds}
        strategy={verticalListSortingStrategy}
      >
        <YStack width="100%" overflow="hidden" gap="$xs">
          {localItems.map((item) => {
            if (item.type === 'section-header') {
              return (
                <SortableSectionHeader
                  key={item.id}
                  item={item}
                  isEditMode={isEditMode}
                  onOpenMenu={() =>
                    setSectionMenuSection({
                      section: item.section,
                      isEmpty: item.isEmpty,
                    })
                  }
                />
              );
            }

            if (item.type === 'channel') {
              return (
                <SortableChannelItem
                  key={item.id}
                  item={item}
                  onEdit={() => goToEditChannel(item.channel.id)}
                  isEditMode={isEditMode}
                />
              );
            }

            return null;
          })}
        </YStack>
      </SortableContext>
    </DndContext>
  );
}
