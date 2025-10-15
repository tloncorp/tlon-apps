import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable } from '@tloncorp/ui';
import { omit } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable, { SortableGridRenderItem } from 'react-native-sortables';
import { ScrollView, Text, View, XStack, YStack } from 'tamagui';

import {
  OrderableChannelNavItem,
  OrderableChannelSection,
  useChannelOrdering,
} from '../../../hooks/useSortableChannelNav';
import { capitalize } from '../../utils';
import { ListItem } from '../ListItem';
import { ScreenHeader } from '../ScreenHeader';
import { CreateChannelSheet } from './CreateChannelSheet';
import { EditSectionNameSheet } from './EditSectionNameSheet';

const logger = createDevLogger('ManageChannelsScreenView', false);

type Channel = {
  id: string;
  type: db.ChannelType;
  title: string;
  index?: number;
};

type ChannelWithIndex = db.Channel & {
  index?: number;
};

type GroupNavSectionWithChannels = Omit<db.GroupNavSection, 'channels'> & {
  channels: ChannelWithIndex[];
};

interface ManageChannelsScreenViewProps {
  goBack: () => void;
  goToEditChannel: (channelId: string) => void;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  group: db.Group | null;
  enableCustomChannels?: boolean;
  moveChannelWithinNavSection: (
    channelId: string,
    navSectionId: string,
    newIndex: number
  ) => Promise<void>;
  moveChannelToNavSection: (
    channelId: string,
    navSectionId: string
  ) => Promise<void>;
  createNavSection: ({ title }: { title: string }) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
}

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
  const [editSection, setEditSection] =
    useState<OrderableChannelSection | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  const { sortableNavItems, handleActiveItemDropped } = useChannelOrdering({
    groupNavSectionsWithChannels,
    moveChannelWithinNavSection,
    moveChannelToNavSection,
  });

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

  const { bottom } = useSafeAreaInsets();

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
      [handleDeleteSection, goToEditChannel]
    );

  return (
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
            <Sortable.Grid
              columns={1}
              data={sortableNavItems}
              renderItem={renderItem}
              activeItemScale={1.05}
              enableActiveItemSnap={false}
              customHandle
              onActiveItemDropped={handleActiveItemDropped}
            />
          </ScrollView>
        </YStack>
      </YStack>
      {showCreateChannel && group && (
        <CreateChannelSheet
          group={group}
          onOpenChange={(open) => setShowCreateChannel(open)}
        />
      )}
      <EditSectionNameSheet
        open={showAddSection}
        mode="add"
        onOpenChange={(open) => setShowAddSection(open)}
        onSave={async (title) => {
          try {
            await createNavSection({
              title,
            });
          } catch (e) {
            logger.error('Failed to create section:', e);
            // Note: We don't need state rollback here since the section
            // hasn't been added to local state yet - the UI will update
            // via the useEffect when groupNavSectionsWithChannels changes
          }
        }}
      />
      <EditSectionNameSheet
        open={!!editSection}
        mode="edit"
        onOpenChange={(open) => setEditSection(open ? editSection : null)}
        onSave={
          editSection
            ? (title) => handleUpdateSection(editSection.id, title)
            : undefined
        }
      />
    </View>
  );
}

function EmptySection() {
  return (
    <YStack alignItems="center" width="100%" paddingHorizontal="$l">
      <Text padding="$l" fontSize="$s" color="$secondaryText">
        No channels in this section
      </Text>
    </YStack>
  );
}

function ChannelItem({
  channel,
  onEdit,
  index,
}: {
  channel: Channel;
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

function SectionHeader({
  section,
  index,
  editSection,
  deleteSection,
  setShowCreateChannel,
  setShowAddSection,
  isEmpty,
  isDefault,
}: {
  section: OrderableChannelSection;
  index: number;
  editSection: (section: OrderableChannelSection) => void;
  deleteSection: (sectionId: string) => void;
  setShowCreateChannel: (show: boolean) => void;
  setShowAddSection: (show: boolean) => void;
  isEmpty: boolean;
  isDefault: boolean;
}) {
  const paddingTop = useMemo(() => (index === 0 ? '$l' : '$xl'), [index]);
  const borderTopWidth = useMemo(() => (index === 0 ? 'unset' : 1), [index]);
  const borderColor = useMemo(
    () => (index === 0 ? 'transparent' : '$border'),
    [index]
  );

  return (
    <XStack
      width="100%"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor="$background"
      borderTopWidth={borderTopWidth}
      borderColor={borderColor}
      paddingTop={paddingTop}
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
