import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useIsWindowNarrow } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useCallback } from 'react';
import Sortable, { SortableGridRenderItem } from 'react-native-sortables';

import {
  SortableListItem,
  useChannelOrdering,
} from '../../../hooks/useSortableChannelNav';
import { useManageChannelsScrollRef } from './ManageChannelsScrollContainer';
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
  onGoBack,
  goToChannelDetails,
  createNavSection,
  deleteNavSection,
  updateNavSection,
  updateGroupNavigation,
  createdRoleId,
}: ManageChannelsScreenViewProps) {
  return (
    <ManageChannelsProvider
      onGoBack={onGoBack}
      group={group}
      createNavSection={createNavSection}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      updateNavSection={updateNavSection}
      deleteNavSection={deleteNavSection}
      updateGroupNavigation={updateGroupNavigation}
      createdRoleId={createdRoleId}
    >
      <ManageChannelsContent
        groupNavSectionsWithChannels={groupNavSectionsWithChannels}
        goToChannelDetails={goToChannelDetails}
        updateGroupNavigation={updateGroupNavigation}
      />
    </ManageChannelsProvider>
  );
}

function ManageChannelsContent({
  groupNavSectionsWithChannels,
  goToChannelDetails,
  updateGroupNavigation,
}: {
  groupNavSectionsWithChannels: ManageChannelsScreenViewProps['groupNavSectionsWithChannels'];
  goToChannelDetails: (channelId: string) => void;
  updateGroupNavigation: ManageChannelsScreenViewProps['updateGroupNavigation'];
}) {
  const { setSectionMenuSection, isEditMode } = useManageChannelsContext();
  const scrollableRef = useManageChannelsScrollRef();

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
                <Icon color="$tertiaryText" type="Sorter" size="$m" />
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
            onEdit={() => goToChannelDetails(item.channel.id)}
            isEditMode={isEditMode}
            dragHandle={
              <Sortable.Handle>
                <Icon color="$tertiaryText" type="Sorter" size="$m" />
              </Sortable.Handle>
            }
          />
        );
      }

      return null;
    },
    [setSectionMenuSection, goToChannelDetails, isEditMode]
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
      dragActivationDelay={0}
      onActiveItemDropped={handleActiveItemDropped}
      scrollableRef={scrollableRef}
    />
  );
}
