import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { omit } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { SortableSection } from '../../../hooks/useSortableChannelNav';
import { capitalize } from '../../utils';
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
}: {
  channel: Pick<db.Channel, 'id' | 'type' | 'title'>;
  onEdit: () => void;
  index: number;
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
            {channel?.title} {index}
          </Text>
          <Text fontSize="$s" color="$secondaryText">
            {capitalize(channel.type)}
          </Text>
        </YStack>
      </XStack>

      <Pressable onPress={onEdit} testID="EditChannelButton">
        <View paddingVertical="$xs">
          <Icon color="$secondaryText" type="Overflow" size="$m" />
        </View>
      </Pressable>
    </XStack>
  );
}

export function SectionHeader({
  section,
  index,
  editSection,
  deleteSection,
  setShowCreateChannel,
  setShowAddSection,
  isEmpty,
  isDefault,
}: {
  section: SortableSection;
  index: number;
  editSection: (section: SortableSection) => void;
  deleteSection: (sectionId: string) => void;
  setShowCreateChannel: (show: boolean) => void;
  setShowAddSection: (show: boolean) => void;
  isEmpty: boolean;
  isDefault: boolean;
}) {
  return (
    <XStack
      width="100%"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor="$background"
      borderTopWidth={index === 0 ? 'unset' : 1}
      borderColor={index === 0 ? 'transparent' : '$border'}
      paddingTop={index === 0 ? '$l' : '$xl'}
      paddingHorizontal="$l"
      marginBottom="$2xl"
      testID={`NavSection-${section.title}`}
    >
      <Text paddingLeft="$l" fontSize="$s" color="$secondaryText">
        {section.title}
      </Text>
      <XStack gap="$s">
        {!isDefault ? (
          <>
            <Button minimal size="$s" onPress={() => editSection(section)}>
              <Button.Text size="$s" color="$positiveActionText">
                Edit
              </Button.Text>
            </Button>
            {isEmpty && (
              <Button
                minimal
                size="$s"
                onPress={() => deleteSection(section.id)}
              >
                <Button.Text size="$s" color="$negativeActionText">
                  Delete
                </Button.Text>
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              minimal
              size="$s"
              onPress={() => setShowCreateChannel(true)}
            >
              <Button.Text size="$s" color="$positiveActionText">
                New Channel
              </Button.Text>
            </Button>
            <Button minimal size="$s" onPress={() => setShowAddSection(true)}>
              <Button.Text size="$s" color="$positiveActionText">
                New Section
              </Button.Text>
            </Button>
          </>
        )}
      </XStack>
    </XStack>
  );
}

export function useManageChannelsState({
  groupNavSectionsWithChannels,
  updateNavSection,
  deleteNavSection,
}: {
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
}) {
  const [editSection, setEditSection] =
    useState<SortableSection | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

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
      const navSection = groupNavSectionsWithChannels.find(
        (s) => s.sectionId === sectionId
      );

      if (!navSection) {
        logger.error(`Section not found: ${sectionId} (for deletion)`);
        return;
      }

      try {
        await deleteNavSection(navSection.id);
      } catch (e) {
        logger.error('Failed to delete section:', e);
      }
    },
    [deleteNavSection, groupNavSectionsWithChannels]
  );

  return {
    editSection,
    setEditSection,
    showAddSection,
    setShowAddSection,
    showCreateChannel,
    setShowCreateChannel,
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
}: {
  children: React.ReactNode;
  goBack: () => void;
  group: db.Group | null;
  createNavSection: ({ title }: { title: string }) => Promise<void>;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
}) {
  const state = useManageChannelsState({
    groupNavSectionsWithChannels,
    updateNavSection,
    deleteNavSection,
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
          <ScreenHeader title="Manage channels" backAction={goBack} />
          <YStack
            backgroundColor="$background"
            gap="$2xl"
            alignItems="center"
            flex={1}
          >
            <ScrollView
              style={{ zIndex: 1, elevation: 1, width: '100%' }}
              contentContainerStyle={{
                alignItems: 'center',
                paddingBottom: bottom,
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
      </View>
    </ManageChannelsContext.Provider>
  );
}
