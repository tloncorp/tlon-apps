import { useCallback } from 'react';
import Sortable, { SortableGridRenderItem } from 'react-native-sortables';

import {
  OrderableChannelNavItem,
  useChannelOrdering,
} from '../../../hooks/useSortableChannelNav';
import {
  ChannelItem,
  EmptySection,
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
  moveChannelWithinNavSection,
  moveChannelToNavSection,
  createNavSection,
  deleteNavSection,
  updateNavSection,
}: ManageChannelsScreenViewProps) {
  return (
    <ManageChannelsProvider
      goBack={goBack}
      group={group}
      createNavSection={createNavSection}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      updateNavSection={updateNavSection}
      deleteNavSection={deleteNavSection}
    >
      <ManageChannelsContent
        groupNavSectionsWithChannels={groupNavSectionsWithChannels}
        goToEditChannel={goToEditChannel}
        moveChannelWithinNavSection={moveChannelWithinNavSection}
        moveChannelToNavSection={moveChannelToNavSection}
      />
    </ManageChannelsProvider>
  );
}

function ManageChannelsContent({
  groupNavSectionsWithChannels,
  goToEditChannel,
  moveChannelWithinNavSection,
  moveChannelToNavSection,
}: {
  groupNavSectionsWithChannels: ManageChannelsScreenViewProps['groupNavSectionsWithChannels'];
  goToEditChannel: (channelId: string) => void;
  moveChannelWithinNavSection: ManageChannelsScreenViewProps['moveChannelWithinNavSection'];
  moveChannelToNavSection: ManageChannelsScreenViewProps['moveChannelToNavSection'];
}) {
  const {
    setEditSection,
    handleDeleteSection,
    setShowAddSection,
    setShowCreateChannel,
  } = useManageChannelsContext();

  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    moveChannelWithinNavSection,
    moveChannelToNavSection,
  });

  const renderItem: SortableGridRenderItem<OrderableChannelNavItem> =
    useCallback(
      ({ item }) => {
        if (item.type === 'section-header') {
          return (
            <SectionHeader
              index={item.sectionIndex}
              section={item.section}
              editSection={setEditSection}
              deleteSection={handleDeleteSection}
              setShowAddSection={setShowAddSection}
              setShowCreateChannel={setShowCreateChannel}
              isEmpty={item.isEmpty}
              isDefault={item.isDefault}
            />
          );
        }

        if (item.type === 'empty-section') {
          return <EmptySection />;
        }

        if (item.type === 'channel') {
          return (
            <Sortable.Handle>
              <ChannelItem
                channel={item.channel}
                index={item.channelIndex}
                onEdit={() => goToEditChannel(item.channel.id)}
              />
            </Sortable.Handle>
          );
        }

        return null;
      },
      [
        setEditSection,
        handleDeleteSection,
        setShowAddSection,
        setShowCreateChannel,
        goToEditChannel,
      ]
    );

  return (
    <Sortable.Grid
      columns={1}
      data={sortableNavItems}
      renderItem={renderItem}
      activeItemScale={1.05}
      enableActiveItemSnap={false}
      customHandle
      onActiveItemDropped={handleActiveItemDropped}
    />
  );
}
