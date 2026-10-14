import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { useDuplicateMembershipRepair } from '../../../hooks/useDuplicateMembershipRepair';
import { useChannelOrdering } from '../../../hooks/useSortableChannelNav';
import { getChannelTypeLabel } from '../../utils';
import { ListItem } from '../ListItem';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsMenuItem,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../SettingsList';
import {
  ManageChannelsScreenViewProps,
  ManageChannelsSheets,
  useManageChannelsState,
} from './ManageChannelsShared';

type Order = { sectionId: string; title: string; channelIds: string[] }[];

/**
 * The group's channels in its native list. Sort shows drag handles for
 * reordering within a section; a channel moves between sections from its
 * long-press menu, and a section is renamed, moved or deleted from the menu
 * beside its title.
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
  // Repairs a channel listed in two sections, as the other platforms do.
  useChannelOrdering({
    groupNavSectionsWithChannels,
    updateGroupNavigation,
    onDuplicatesDetected: useDuplicateMembershipRepair(group?.id),
  });

  const order: Order = useMemo(
    () =>
      groupNavSectionsWithChannels.map((section) => ({
        sectionId: section.sectionId,
        title: section.title ?? '',
        channelIds: section.channels.map((channel) => channel.id),
      })),
    [groupNavSectionsWithChannels]
  );

  const save = useCallback(
    (next: Order) =>
      updateGroupNavigation(
        next.map((section, sectionIndex) => ({
          sectionId: section.sectionId,
          sectionIndex,
          channels: section.channelIds.map((channelId, channelIndex) => ({
            channelId,
            channelIndex,
          })),
        }))
      ),
    [updateGroupNavigation]
  );

  // A move in the list's own terms: the rows' old positions, and the
  // position they are dropped before, counted before they leave.
  const moveWithin = useCallback(
    (sectionIndex: number, from: number[], to: number) => {
      const ids = order[sectionIndex].channelIds;
      const moving = from.map((index) => ids[index]);
      const rest = ids.filter((_, index) => !from.includes(index));
      rest.splice(to - from.filter((index) => index < to).length, 0, ...moving);
      const next = [...order];
      next[sectionIndex] = { ...next[sectionIndex], channelIds: rest };
      save(next);
    },
    [order, save]
  );

  const sections = useMemo((): SettingsSectionModel[] => {
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
            ? 'No section'
            : undefined
          : (navSection.title ?? undefined),
        titleMenu,
        onMove: (from, to) => moveWithin(sectionIndex, from, to),
        rows:
          navSection.channels.length === 0
            ? [{ key: 'empty', title: 'No channels yet', disabled: true }]
            : navSection.channels.map((channel, channelIndex) => ({
                key: channel.id,
                title: channel.title ?? '',
                subtitle: getChannelTypeLabel(channel.type),
                leading: {
                  kind: 'element' as const,
                  render: ({ size }) => (
                    <View>
                      <ListItem.ChannelIcon
                        // The type is all the icon needs.
                        model={{ type: channel.type } as typeof channel}
                        useTypeIcon
                        size="custom"
                        width={size}
                        height={size}
                        borderRadius={size * 0.25}
                      />
                    </View>
                  ),
                },
                onPress: isEditMode
                  ? undefined
                  : () => goToChannelDetails(channel.id),
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
    moveWithin,
    order,
    save,
    state,
  ]);

  return (
    <SettingsListScreenView
      title="Channels"
      sections={sections}
      onBackPressed={onGoBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      editing={isEditMode}
      rightActions={[
        {
          id: 'ManageChannelsSort',
          // iOS calls its reorder mode Edit.
          text: isEditMode ? 'Done' : 'Edit',
          // Moves save as they happen, so this only enters and leaves a mode.
          tint: '$primaryText',
          onPress: () => setIsEditMode(!isEditMode),
          testID: 'ManageChannelsSort',
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
