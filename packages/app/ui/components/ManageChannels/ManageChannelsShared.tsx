import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { omit } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { SortableSection } from '../../../hooks/useSortableChannelNav';
import { capitalize } from '../../utils';
import { SimpleActionSheet } from '../ActionSheet';
import { ListItem } from '../ListItem';
import { ScreenHeader } from '../ScreenHeader';
import { CreateChannelSheet } from './CreateChannelSheet';
import { EditSectionNameSheet } from './EditSectionNameSheet';

const logger = createDevLogger('ManageChannelsShared', false);

export type GroupNavSectionWithChannels = Omit<
  db.GroupNavSection,
  'channels'
> & {
  channels: (db.Channel & { index?: number })[];
};

export interface ManageChannelsScreenViewProps {
  goBack: () => void;
  goToEditChannel: (channelId: string) => void;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  group: db.Group | null;
  enableCustomChannels?: boolean;
  createNavSection: ({ title }: { title: string }) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
  updateGroupNavigation: (
    navSections: Array<{
      sectionId: string;
      sectionIndex: number;
      channels: Array<{ channelId: string; channelIndex: number }>;
    }>
  ) => Promise<void>;
}

export function ChannelItem({
  channel,
  onEdit,
  index,
  isEditMode,
  dragHandle,
}: {
  channel: Pick<db.Channel, 'id' | 'type' | 'title'>;
  onEdit: () => void;
  index: number;
  isEditMode?: boolean;
  dragHandle?: React.ReactNode;
}) {
  return (
    <XStack
      paddingLeft="$l"
      paddingHorizontal="$l"
      width="100%"
      height="$6xl"
      borderRadius="$xl"
      alignItems="center"
      justifyContent="space-between"
      backgroundColor="$background"
      testID={`ChannelItem-${channel.title}-${index}`}
    >
      <XStack alignItems="center" gap="$l">
        <ListItem.ChannelIcon
          // @ts-expect-error - we don't need the whole channel object
          model={{ type: channel.type }}
          useTypeIcon
        />
        <YStack gap="$2xs">
          <Text fontSize="$l" paddingVertical="$s">
            {channel?.title}
          </Text>
          <Text fontSize="$s" color="$secondaryText">
            {capitalize(channel.type)}
          </Text>
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$l">
        {isEditMode && dragHandle && (
          <View paddingVertical="$xs">{dragHandle}</View>
        )}
        {!isEditMode && (
          <Pressable onPress={onEdit} testID="EditChannelButton">
            <View paddingVertical="$xs">
              <Icon color="$secondaryText" type="Overflow" size="$m" />
            </View>
          </Pressable>
        )}
      </XStack>
    </XStack>
  );
}

export function SectionHeader({
  section,
  index,
  isDefault,
  isEditMode,
  dragHandle,
  onOpenMenu,
}: {
  section: SortableSection;
  index: number;
  isDefault: boolean;
  isEditMode?: boolean;
  dragHandle?: React.ReactNode;
  onOpenMenu?: () => void;
}) {
  return (
    <XStack
      width="100%"
      height={40}
      justifyContent="space-between"
      alignItems="center"
      backgroundColor="$secondaryBackground"
      paddingHorizontal="$s"
      paddingRight="$l"
      testID={`NavSection-${section.title}`}
    >
      <Text paddingLeft="$l" fontSize="$s" color="$secondaryText">
        {section.title}
      </Text>
      <XStack gap="$s" alignItems="center">
        {!isDefault && !isEditMode && (
          <Pressable onPress={onOpenMenu} testID="SectionMenuButton">
            <View paddingVertical="$xs">
              <Icon color="$secondaryText" type="Overflow" size="$m" />
            </View>
          </Pressable>
        )}
        {isEditMode && dragHandle && (
          <View paddingVertical="$xs">{dragHandle}</View>
        )}
      </XStack>
    </XStack>
  );
}

export function useManageChannelsState({
  groupNavSectionsWithChannels,
  updateNavSection,
  deleteNavSection,
  updateGroupNavigation,
}: {
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
  updateGroupNavigation: (
    navSections: Array<{
      sectionId: string;
      sectionIndex: number;
      channels: Array<{ channelId: string; channelIndex: number }>;
    }>
  ) => Promise<void>;
}) {
  const [editSection, setEditSection] = useState<SortableSection | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [sectionMenuSection, setSectionMenuSection] = useState<{
    section: SortableSection;
    isEmpty: boolean;
  } | null>(null);

  const handleUpdateSection = useCallback(
    async (sectionId: string, title: string) => {
      const navSection = groupNavSectionsWithChannels.find(
        (s) => s.sectionId === sectionId
      );

      if (!navSection) {
        logger.error(`Section not found: ${sectionId} (for update operation)`);
        return;
      }

      try {
        await updateNavSection({
          ...omit(navSection, 'channels'),
          title,
        });
      } catch (e) {
        logger.error('Failed to update section:', e);
      }
    },
    [groupNavSectionsWithChannels, updateNavSection]
  );

  const handleDeleteSection = useCallback(
    async (sectionId: string) => {
      const sectionIndex = groupNavSectionsWithChannels.findIndex(
        (s) => s.sectionId === sectionId
      );

      if (sectionIndex === -1) {
        logger.error(`Section not found: ${sectionId} (for deletion)`);
        return;
      }

      const navSection = groupNavSectionsWithChannels[sectionIndex];
      const hasChannels = navSection.channels.length > 0;

      try {
        // If the section has channels, move them to the previous section first
        if (hasChannels && sectionIndex > 0) {
          // Build the new navigation structure with channels moved to previous section
          const updatedNavSections = groupNavSectionsWithChannels.map(
            (section, idx) => {
              if (idx === sectionIndex - 1) {
                // Previous section gets the deleted section's channels appended
                return {
                  sectionId: section.sectionId,
                  sectionIndex: idx,
                  channels: [
                    ...section.channels.map((ch, chIdx) => ({
                      channelId: ch.id,
                      channelIndex: chIdx,
                    })),
                    ...navSection.channels.map((ch, chIdx) => ({
                      channelId: ch.id,
                      channelIndex: section.channels.length + chIdx,
                    })),
                  ],
                };
              } else if (idx === sectionIndex) {
                // Section being deleted has empty channels
                return {
                  sectionId: section.sectionId,
                  sectionIndex: idx,
                  channels: [],
                };
              } else {
                // Other sections remain unchanged
                return {
                  sectionId: section.sectionId,
                  sectionIndex: idx,
                  channels: section.channels.map((ch, chIdx) => ({
                    channelId: ch.id,
                    channelIndex: chIdx,
                  })),
                };
              }
            }
          );

          await updateGroupNavigation(updatedNavSections);
        }

        // Now delete the section
        await deleteNavSection(navSection.id);
      } catch (e) {
        logger.error('Failed to delete section:', e);
      }
    },
    [deleteNavSection, groupNavSectionsWithChannels, updateGroupNavigation]
  );

  return {
    editSection,
    setEditSection,
    showAddSection,
    setShowAddSection,
    showCreateChannel,
    setShowCreateChannel,
    showNewMenu,
    setShowNewMenu,
    isEditMode,
    setIsEditMode,
    sectionMenuSection,
    setSectionMenuSection,
    handleUpdateSection,
    handleDeleteSection,
  };
}

interface ManageChannelsContextValue {
  editSection: SortableSection | null;
  setEditSection: (section: SortableSection | null) => void;
  showAddSection: boolean;
  setShowAddSection: (show: boolean) => void;
  showCreateChannel: boolean;
  setShowCreateChannel: (show: boolean) => void;
  showNewMenu: boolean;
  setShowNewMenu: (show: boolean) => void;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  sectionMenuSection: { section: SortableSection; isEmpty: boolean } | null;
  setSectionMenuSection: (
    section: { section: SortableSection; isEmpty: boolean } | null
  ) => void;
  handleUpdateSection: (sectionId: string, title: string) => Promise<void>;
  handleDeleteSection: (sectionId: string) => Promise<void>;
}

const ManageChannelsContext =
  React.createContext<ManageChannelsContextValue | null>(null);

export function useManageChannelsContext() {
  const context = React.useContext(ManageChannelsContext);
  if (!context) {
    throw new Error(
      'useManageChannelsContext must be used within ManageChannelsProvider'
    );
  }
  return context;
}

export function ManageChannelsProvider({
  children,
  goBack,
  group,
  createNavSection,
  groupNavSectionsWithChannels,
  updateNavSection,
  deleteNavSection,
  updateGroupNavigation,
}: {
  children: React.ReactNode;
  goBack: () => void;
  group: db.Group | null;
  createNavSection: ({ title }: { title: string }) => Promise<void>;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
  updateGroupNavigation: (
    navSections: Array<{
      sectionId: string;
      sectionIndex: number;
      channels: Array<{ channelId: string; channelIndex: number }>;
    }>
  ) => Promise<void>;
}) {
  const state = useManageChannelsState({
    groupNavSectionsWithChannels,
    updateNavSection,
    deleteNavSection,
    updateGroupNavigation,
  });

  const { bottom } = useSafeAreaInsets();

  return (
    <ManageChannelsContext.Provider value={state}>
      <View backgroundColor="$background" flex={1}>
        <YStack
          backgroundColor="$background"
          justifyContent="space-between"
          flex={1}
        >
          <ScreenHeader
            title="Channels"
            backAction={goBack}
            rightControls={
              <XStack gap="$xl">
                <ScreenHeader.TextButton
                  onPress={() => state.setIsEditMode(!state.isEditMode)}
                  color="$positiveActionText"
                >
                  {state.isEditMode ? 'Done' : 'Sort'}
                </ScreenHeader.TextButton>
                {!state.isEditMode && (
                  <ScreenHeader.TextButton
                    onPress={() => state.setShowNewMenu(true)}
                    color="$positiveActionText"
                  >
                    New
                  </ScreenHeader.TextButton>
                )}
              </XStack>
            }
          />
          <YStack
            backgroundColor="$background"
            gap="$2xl"
            alignItems="center"
            paddingTop="$l"
            flex={1}
          >
            <ScrollView
              style={{ zIndex: 1, elevation: 1, width: '100%' }}
              contentContainerStyle={{
                alignItems: 'center',
                paddingBottom: bottom,
                minHeight: '100%',
              }}
            >
              {children}
            </ScrollView>
          </YStack>
        </YStack>
        {state.showCreateChannel && group && (
          <CreateChannelSheet
            group={group}
            onOpenChange={(open) => state.setShowCreateChannel(open)}
          />
        )}
        <EditSectionNameSheet
          open={state.showAddSection}
          mode="add"
          onOpenChange={(open) => state.setShowAddSection(open)}
          onSave={async (title) => {
            try {
              await createNavSection({
                title,
              });
            } catch (e) {
              logger.error('Failed to create section:', e);
            }
          }}
        />
        <EditSectionNameSheet
          open={!!state.editSection}
          mode="edit"
          name={state.editSection?.title}
          onOpenChange={(open) =>
            state.setEditSection(open ? state.editSection : null)
          }
          onSave={
            state.editSection
              ? (title) =>
                  state.handleUpdateSection(state.editSection!.id, title)
              : undefined
          }
        />
        <SimpleActionSheet
          open={state.showNewMenu}
          onOpenChange={(open) => state.setShowNewMenu(open)}
          actions={[
            {
              title: 'New channel',
              description: 'Create a new channel in this group',
              action: () => {
                state.setShowNewMenu(false);
                state.setShowCreateChannel(true);
              },
            },
            {
              title: 'New section',
              description: 'Create a section to organize channels',
              action: () => {
                state.setShowNewMenu(false);
                state.setShowAddSection(true);
              },
            },
          ]}
        />
        <SimpleActionSheet
          open={!!state.sectionMenuSection}
          onOpenChange={(open) =>
            state.setSectionMenuSection(open ? state.sectionMenuSection : null)
          }
          actions={[
            {
              title: 'Edit name',
              description: 'Edit the name of this section',
              action: () => {
                if (state.sectionMenuSection) {
                  state.setEditSection(state.sectionMenuSection.section);
                  state.setSectionMenuSection(null);
                }
              },
            },
            {
              title: 'Delete section',
              description: state.sectionMenuSection?.isEmpty
                ? 'Remove this section'
                : 'Remove this section and move its channels to the previous section',
              action: () => {
                if (state.sectionMenuSection) {
                  state.handleDeleteSection(
                    state.sectionMenuSection.section.id
                  );
                  state.setSectionMenuSection(null);
                }
              },
            },
          ]}
        />
      </View>
    </ManageChannelsContext.Provider>
  );
}
