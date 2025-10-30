import { Icon } from '@tloncorp/ui';
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
      updateGroupNavigation={updateGroupNavigation}
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
  const { setSectionMenuSection, isEditMode } = useManageChannelsContext();

  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
  });

  const renderItem: SortableGridRenderItem<SortableListItem> = useCallback(
    ({ item }) => {
      if (item.type === 'section-header') {
        return (
          <SectionHeader
            index={item.sectionIndex}
            section={item.section}
            isDefault={item.isDefault}
            isEditMode={isEditMode}
            dragHandle={
              <Sortable.Handle>
                <Icon color="$tertiaryText" type="Dragger" size="$m" />
              </Sortable.Handle>
            }
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
          <ChannelItem
            channel={item.channel}
            index={item.channelIndex}
            onEdit={() => goToEditChannel(item.channel.id)}
            isEditMode={isEditMode}
            dragHandle={
              <Sortable.Handle>
                <Icon color="$tertiaryText" type="Dragger" size="$m" />
              </Sortable.Handle>
            }
          />
        );
      }

      return null;
    },
    [setSectionMenuSection, goToEditChannel, isEditMode]
  );

  return (
    <Sortable.Grid
      columns={1}
      data={sortableNavItems}
      renderItem={renderItem}
      activeItemScale={1.05}
      enableActiveItemSnap={false}
      customHandle
      sortEnabled={isEditMode}
      onActiveItemDropped={handleActiveItemDropped}
    />
  );
}
