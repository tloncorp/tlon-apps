import { createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useDuplicateMembershipRepair } from '../../../hooks/useDuplicateMembershipRepair';
import { useChannelOrdering } from '../../../hooks/useSortableChannelNav';
import { getChannelTypeLabel } from '../../utils';
import { ListItem } from '../ListItem';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsMenuItem,
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../SettingsList';
import {
  ManageChannelsScreenViewProps,
  ManageChannelsSheets,
  defaultSectionTitle,
  useManageChannelsState,
} from './ManageChannelsShared';
import {
  type ChannelOrder,
  channelOrder,
  channelReorderItems,
  moveChannels as moveChannelsInOrder,
  navigationUpdate,
  reorder,
} from './channelReorder';

type ReorderMode = 'channels' | 'sections';

const logger = createDevLogger('ManageChannelsScreenView', false);

/**
 * The group's channels in its native list. A channel moves between sections
 * from its long-press menu, and a section is renamed, moved or deleted from
 * the menu beside its title. The header's reorder menu reorders either the
 * channels or the sections, as Discord's reorder screen does: SwiftUI only
 * drops a row back into the list it came from, so each is one list. Channels
 * are listed under their sections' names, and a channel joins the section it's
 * dropped under; dragging a name moves where its section starts, as Android
 * and web do.
 */
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
  const isWindowNarrow = useIsWindowNarrow();
  const state = useManageChannelsState({
    groupNavSectionsWithChannels,
    updateNavSection,
    deleteNavSection,
    updateGroupNavigation,
    createdRoleId,
  });
  const { isEditMode, setIsEditMode } = state;
  const [reorderMode, setReorderMode] = useState<ReorderMode>('channels');
  // Repairs a channel listed in two sections, as the other platforms do.
  const { duplicateChannelIds } = useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
    onDuplicatesDetected: useDuplicateMembershipRepair(group?.id),
  });

  const order: ChannelOrder = useMemo(
    () => channelOrder(groupNavSectionsWithChannels),
    [groupNavSectionsWithChannels]
  );

  const save = useCallback(
    (next: ChannelOrder) => {
      // Until that repair lands, the order isn't the backend's, so saving it
      // would settle the channel in whichever section came first.
      if (duplicateChannelIds.length > 0) {
        logger.warn(
          'skipping reorder save: duplicate channel memberships detected',
          { duplicateChannelIds }
        );
        return;
      }
      updateGroupNavigation(navigationUpdate(next));
    },
    [duplicateChannelIds, updateGroupNavigation]
  );

  const moveWithin = useCallback(
    (sectionIndex: number, from: number[], to: number) => {
      const next = [...order];
      next[sectionIndex] = {
        ...next[sectionIndex],
        channelIds: reorder(order[sectionIndex].channelIds, from, to),
      };
      save(next);
    },
    [order, save]
  );

  const reorderItems = useMemo(() => channelReorderItems(order), [order]);

  const moveChannels = useCallback(
    (from: number[], to: number) => {
      const next = moveChannelsInOrder(order, from, to);
      if (next) save(next);
    },
    [order, save]
  );

  const moveSections = useCallback(
    (from: number[], to: number) => save(reorder(order, from, to)),
    [order, save]
  );

  const sections = useMemo((): SettingsSectionModel[] => {
    if (isEditMode) {
      const channelsById = new Map(
        groupNavSectionsWithChannels.flatMap((section) =>
          section.channels.map((channel) => [channel.id, channel] as const)
        )
      );
      return reorderMode === 'sections'
        ? [
            {
              key: 'reorder-sections',
              footer: 'A section keeps its channels when it moves.',
              onMove: moveSections,
              rows: order.map((section) => ({
                key: section.sectionId,
                title: sectionName(section),
                value:
                  section.channelIds.length === 1
                    ? '1 channel'
                    : `${section.channelIds.length} channels`,
                testID: `SectionItem-${sectionName(section)}`,
              })),
            },
          ]
        : [
            {
              key: 'reorder-channels',
              footer: 'Drag a channel under a section to move it there.',
              onMove: moveChannels,
              rows: reorderItems.flatMap((item): SettingsRowModel[] => {
                if (item.kind === 'heading') {
                  const section = order.find(
                    (candidate) => candidate.sectionId === item.sectionId
                  );
                  return section
                    ? [
                        {
                          key: `heading-${item.sectionId}`,
                          title: sectionName(section),
                          heading: true,
                        },
                      ]
                    : [];
                }
                const channel = channelsById.get(item.id);
                return channel
                  ? [
                      {
                        key: channel.id,
                        title: channel.title ?? '',
                        subtitle: getChannelTypeLabel(channel.type),
                        leading: channelIcon(channel),
                        testID: `ChannelItem-${channel.title}`,
                      },
                    ]
                  : [];
              }),
            },
          ];
    }

    const movable = order
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.sectionId !== 'default');

    return groupNavSectionsWithChannels.map((navSection, sectionIndex) => {
      const isDefault = navSection.sectionId === 'default';
      const place = movable.findIndex(({ index }) => index === sectionIndex);
      const swapWith = (offset: number) => {
        const other = movable[place + offset]?.index;
        if (other === undefined) return;
        const next = [...order];
        [next[sectionIndex], next[other]] = [next[other], next[sectionIndex]];
        save(next);
      };
      const titleMenu: SettingsMenuItem[] = isDefault
        ? []
        : [
            {
              key: 'rename',
              title: 'Rename',
              systemImage: 'pencil',
              onPress: () =>
                state.setEditSection({
                  id: navSection.sectionId,
                  title: navSection.title ?? '',
                  channels: [],
                }),
            },
            ...(place > 0
              ? [
                  {
                    key: 'up',
                    title: 'Move up',
                    systemImage: 'arrow.up',
                    onPress: () => swapWith(-1),
                  },
                ]
              : []),
            ...(place < movable.length - 1
              ? [
                  {
                    key: 'down',
                    title: 'Move down',
                    systemImage: 'arrow.down',
                    onPress: () => swapWith(1),
                  },
                ]
              : []),
            {
              key: 'delete',
              title: 'Delete section',
              systemImage: 'trash',
              destructive: true,
              onPress: () => state.handleDeleteSection(navSection.sectionId),
            },
          ];

      return {
        key: navSection.sectionId,
        // The default bucket only needs naming beside real sections.
        title: isDefault
          ? groupNavSectionsWithChannels.length > 1
            ? defaultSectionTitle
            : undefined
          : (navSection.title ?? undefined),
        titleMenu,
        rows:
          navSection.channels.length === 0
            ? [{ key: 'empty', title: 'No channels yet', disabled: true }]
            : navSection.channels.map((channel, channelIndex) => ({
                key: channel.id,
                title: channel.title ?? '',
                subtitle: getChannelTypeLabel(channel.type),
                leading: channelIcon(channel),
                onPress: () => goToChannelDetails(channel.id),
                contextActions: [
                  {
                    key: 'settings',
                    title: 'Channel settings',
                    systemImage: 'gearshape',
                    onPress: () => goToChannelDetails(channel.id),
                  },
                  ...(channelIndex > 0
                    ? [
                        {
                          key: 'up',
                          title: 'Move up',
                          systemImage: 'arrow.up',
                          onPress: () =>
                            moveWithin(
                              sectionIndex,
                              [channelIndex],
                              channelIndex - 1
                            ),
                        },
                      ]
                    : []),
                  ...(channelIndex < navSection.channels.length - 1
                    ? [
                        {
                          key: 'down',
                          title: 'Move down',
                          systemImage: 'arrow.down',
                          onPress: () =>
                            moveWithin(
                              sectionIndex,
                              [channelIndex],
                              channelIndex + 2
                            ),
                        },
                      ]
                    : []),
                  ...order
                    .filter(
                      (target) => target.sectionId !== navSection.sectionId
                    )
                    .map((target) => ({
                      key: `move-${target.sectionId}`,
                      title:
                        target.sectionId === 'default'
                          ? 'Move out of section'
                          : `Move to ${target.title || 'Untitled section'}`,
                      systemImage: 'folder',
                      onPress: () =>
                        save(
                          order.map((section) =>
                            section.sectionId === navSection.sectionId
                              ? {
                                  ...section,
                                  channelIds: section.channelIds.filter(
                                    (id) => id !== channel.id
                                  ),
                                }
                              : section.sectionId === target.sectionId
                                ? {
                                    ...section,
                                    channelIds: [
                                      ...section.channelIds,
                                      channel.id,
                                    ],
                                  }
                                : section
                          )
                        ),
                    })),
                ],
                testID: `ChannelItem-${channel.title}-${channelIndex}`,
              })),
      };
    });
  }, [
    goToChannelDetails,
    groupNavSectionsWithChannels,
    isEditMode,
    moveChannels,
    moveSections,
    moveWithin,
    order,
    reorderItems,
    reorderMode,
    save,
    state,
  ]);

  return (
    <SettingsListScreenView
      title={
        !isEditMode
          ? 'Channels'
          : reorderMode === 'sections'
            ? 'Reorder sections'
            : 'Reorder channels'
      }
      sections={sections}
      onBackPressed={onGoBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      editing={isEditMode}
      rightActions={[
        {
          id: 'ManageChannelsSort',
          icon: 'EditList',
          label: 'Reorder',
          visible: !isEditMode,
          items: [
            {
              id: 'channels',
              label: 'Reorder channels',
              onPress: () => {
                setReorderMode('channels');
                setIsEditMode(true);
              },
            },
            {
              id: 'sections',
              label: 'Reorder sections',
              onPress: () => {
                setReorderMode('sections');
                setIsEditMode(true);
              },
            },
          ],
          testID: 'ManageChannelsSort',
        },
        {
          id: 'ManageChannelsDone',
          text: 'Done',
          // Done ends reordering, which iOS draws as its confirming action.
          tint: '$positiveActionText',
          prominent: true,
          visible: isEditMode,
          onPress: () => setIsEditMode(false),
          testID: 'ManageChannelsDone',
        },
        {
          id: 'ManageChannelsNew',
          icon: 'Add',
          label: 'New channel or section',
          visible: !isEditMode,
          onPress: () => state.setShowNewMenu(true),
          testID: 'ManageChannelsNew',
        },
      ]}
    >
      <ManageChannelsSheets
        state={state}
        group={group}
        createNavSection={createNavSection}
      />
    </SettingsListScreenView>
  );
}

/** A section's name in the reorder lists, the default bucket's included. */
function sectionName(section: { sectionId: string; title: string }) {
  return section.sectionId === 'default'
    ? defaultSectionTitle
    : section.title || 'Untitled section';
}

function channelIcon(channel: db.Channel): SettingsRowModel['leading'] {
  return {
    kind: 'element',
    render: ({ size }) => (
      <View>
        <ListItem.ChannelIcon
          // The type is all the icon needs.
          model={{ type: channel.type } as db.Channel}
          useTypeIcon
          size="custom"
          width={size}
          height={size}
          borderRadius={size * 0.25}
        />
      </View>
    ),
  };
}
