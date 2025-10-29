import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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
import { CSSProperties, useCallback, useEffect, useState } from 'react';
import { View } from 'tamagui';

import {
  OrderableChannelNavItem,
  OrderableChannelSection,
  useChannelOrdering,
} from '../../../hooks/useSortableChannelNav';
import {
  Channel,
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
  const [activeId, setActiveId] = useState<string | null>(null);

  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
  });

  const [localItems, setLocalItems] =
    useState<OrderableChannelNavItem[]>(sortableNavItems);

  useEffect(() => {
    setLocalItems(sortableNavItems);
  }, [sortableNavItems]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

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

      handleActiveItemDropped({
        fromIndex: activeIndex,
        toIndex: overIndex,
        indexToKey,
      });
    },
    [localItems, handleActiveItemDropped]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const draggableIds = localItems.map((item) => item.id);

  const activeItem = activeId
    ? localItems.find((item) => item.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ManageChannelsProvider
        goBack={goBack}
        group={group}
        createNavSection={createNavSection}
        groupNavSectionsWithChannels={groupNavSectionsWithChannels}
        updateNavSection={updateNavSection}
        deleteNavSection={deleteNavSection}
      >
        <ManageChannelsContent
          localItems={localItems}
          goToEditChannel={goToEditChannel}
          draggableIds={draggableIds}
        />
      </ManageChannelsProvider>
      <DragOverlay>
        {activeItem ? (
          <View
            shadowColor="$shadow"
            shadowOffset={{ width: 0, height: 8 }}
            shadowOpacity={0.35}
            shadowRadius={24}
            borderRadius="$xl"
          >
            {activeItem.type === 'channel' && (
              <ChannelItem
                channel={activeItem.channel as Channel}
                onEdit={() => {}}
                index={activeItem.channelIndex}
              />
            )}
            {activeItem.type === 'section-header' && (
              <SectionHeader
                index={activeItem.sectionIndex}
                section={activeItem.section}
                editSection={() => {}}
                deleteSection={() => {}}
                setShowAddSection={() => {}}
                setShowCreateChannel={() => {}}
                isEmpty={activeItem.isEmpty}
                isDefault={activeItem.isDefault}
              />
            )}
          </View>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: 'grab',
    width: '100%',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableSectionHeader({
  item,
  editSection,
  deleteSection,
  setShowAddSection,
  setShowCreateChannel,
}: {
  item: Extract<OrderableChannelNavItem, { type: 'section-header' }>;
  editSection: (section: OrderableChannelSection) => void;
  deleteSection: (sectionId: string) => void;
  setShowAddSection: (value: boolean) => void;
  setShowCreateChannel: (value: boolean) => void;
}) {
  return (
    <SortableItem id={item.id}>
      <SectionHeader
        index={item.sectionIndex}
        section={item.section}
        editSection={editSection}
        deleteSection={deleteSection}
        setShowAddSection={setShowAddSection}
        setShowCreateChannel={setShowCreateChannel}
        isEmpty={item.isEmpty}
        isDefault={item.isDefault}
      />
    </SortableItem>
  );
}

function SortableChannelItem({
  item,
  onEdit,
}: {
  item: Extract<OrderableChannelNavItem, { type: 'channel' }>;
  onEdit: () => void;
}) {
  return (
    <SortableItem id={item.id}>
      <ChannelItem
        channel={item.channel as Channel}
        onEdit={onEdit}
        index={item.channelIndex}
      />
    </SortableItem>
  );
}

function ManageChannelsContent({
  localItems,
  goToEditChannel,
  draggableIds,
}: {
  localItems: OrderableChannelNavItem[];
  goToEditChannel: (channelId: string) => void;
  draggableIds: string[];
}) {
  const {
    setEditSection,
    handleDeleteSection,
    setShowAddSection,
    setShowCreateChannel,
  } = useManageChannelsContext();

  return (
    <SortableContext
      items={draggableIds}
      strategy={verticalListSortingStrategy}
    >
      <div style={{ width: '100%' }}>
        {localItems.map((item) => {
          if (item.type === 'section-header') {
            return (
              <SortableSectionHeader
                key={item.id}
                item={item}
                editSection={setEditSection}
                deleteSection={handleDeleteSection}
                setShowAddSection={setShowAddSection}
                setShowCreateChannel={setShowCreateChannel}
              />
            );
          }

          if (item.type === 'channel') {
            return (
              <SortableChannelItem
                key={item.id}
                item={item}
                onEdit={() => goToEditChannel(item.channel.id)}
              />
            );
          }

          return null;
        })}
      </div>
    </SortableContext>
  );
}
