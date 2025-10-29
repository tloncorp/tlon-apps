import { useCallback } from 'react';
import Sortable, { SortableGridRenderItem } from 'react-native-sortables';

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
        updateGroupNavigation={updateGroupNavigation}
      />
    </ManageChannelsProvider>
  );
}

function ManageChannelsContent({
  groupNavSectionsWithChannels,
  goToEditChannel,
  updateGroupNavigation,
}: {
  groupNavSectionsWithChannels: ManageChannelsScreenViewProps['groupNavSectionsWithChannels'];
  goToEditChannel: (channelId: string) => void;
  updateGroupNavigation: ManageChannelsScreenViewProps['updateGroupNavigation'];
}) {
  const {
    setEditSection,
    handleDeleteSection,
    setShowAddSection,
    setShowCreateChannel,
  } = useManageChannelsContext();

  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
  });

  const renderItem: SortableGridRenderItem<SortableListItem> = useCallback(
    ({ item }) => {
      if (item.type === 'section-header') {
        return (
          <Sortable.Handle>
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
          </Sortable.Handle>
        );
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
