import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, useIsWindowNarrow } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { omit } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View, XStack, YStack } from 'tamagui';

import { capitalize } from '../../utils';
import { ListItem } from '../ListItem';
import { ScreenHeader } from '../ScreenHeader';
import { CreateChannelSheet } from './CreateChannelSheet';
import { EditSectionNameSheet } from './EditSectionNameSheet';

const logger = createDevLogger('ManageChannelsScreenView', false);

export type Section = {
  id: string;
  title: string;
  channels: Channel[];
};

type Channel = {
  id: string;
  type: db.ChannelType;
  title: string;
  index?: number;
};

function EmptySection() {
  return (
    <YStack alignItems="center" width="100%">
      <Text padding="$l" fontSize="$s" color="$secondaryText">
        No channels in this section
      </Text>
    </YStack>
  );
}

function ChannelItem({
  channel,
  onEdit,
  moveChannelWithinNavSection,
  moveChannelToNavSection,
  index,
  sectionIndex,
  isLast,
  isFirst,
  isLastSection,
  isFirstSection,
}: {
  channel: Channel;
  onEdit: () => void;
  moveChannelWithinNavSection: (newIndex: number) => void;
  moveChannelToNavSection: (newSectionIndex: number) => void;
  index: number;
  sectionIndex: number;
  isLast: boolean;
  isFirst: boolean;
  isLastSection: boolean;
  isFirstSection: boolean;
}) {
  const handleMoveUp = useCallback(() => {
    if (isFirst) {
      if (isFirstSection) {
        logger.error(
          `Channel "${channel.title}" is already at the top of the first section`
        );
        return;
      } else {
        moveChannelToNavSection(sectionIndex - 1);
      }
      return;
    }
    moveChannelWithinNavSection(index - 1);
  }, [
    moveChannelWithinNavSection,
    index,
    sectionIndex,
    isFirst,
    isFirstSection,
    moveChannelToNavSection,
    channel.title,
  ]);

  const handleMoveDown = useCallback(() => {
    if (isLast) {
      if (isLastSection) {
        logger.error(
          `Channel "${channel.title}" is already at the bottom of the last section`
        );
        return;
      } else {
        moveChannelToNavSection(sectionIndex + 1);
      }
      return;
    }
    moveChannelWithinNavSection(index + 1);
  }, [
    moveChannelWithinNavSection,
    index,
    sectionIndex,
    isLast,
    isLastSection,
    moveChannelToNavSection,
    channel.title,
  ]);

  return (
    <XStack
      paddingLeft="$l"
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

      <XStack gap="$2xs">
        <Pressable
          onPress={handleMoveUp}
          disabled={isFirst && isFirstSection}
          testID="MoveChannelUpButton"
        >
          <Icon
            color={
              isFirst && isFirstSection ? '$secondaryText' : '$primaryText'
            }
            type="ChevronUp"
          />
        </Pressable>
        <Pressable
          onPress={handleMoveDown}
          disabled={isLast && isLastSection}
          testID="MoveChannelDownButton"
        >
          <Icon
            color={isLast && isLastSection ? '$secondaryText' : '$primaryText'}
            type="ChevronDown"
          />
        </Pressable>
        <Pressable onPress={onEdit} testID="EditChannelButton">
          <View paddingVertical="$xs">
            <Icon color="$secondaryText" type="Overflow" size="$m" />
          </View>
        </Pressable>
      </XStack>
    </XStack>
  );
}

function NavSection({
  section,
  index,
  totalSections,
  onMoveUp,
  onMoveDown,
  editSection,
  deleteSection,
  setShowCreateChannel,
  setShowAddSection,
  isEmpty,
  isDefault,
  children,
}: {
  section: Section;
  index: number;
  totalSections: number;
  onMoveUp: (sectionId: string) => void;
  onMoveDown: (sectionId: string) => void;
  editSection: (section: Section) => void;
  deleteSection: (sectionId: string) => void;
  setShowCreateChannel: (show: boolean) => void;
  setShowAddSection: (show: boolean) => void;
  isEmpty: boolean;
  isDefault: boolean;
  children: React.ReactNode;
}) {
  const borderTopWidth = useMemo(() => (index === 0 ? 'unset' : 1), [index]);
  const borderColor = useMemo(
    () => (index === 0 ? 'transparent' : '$border'),
    [index]
  );
  const paddingTop = useMemo(() => (index === 0 ? '$l' : '$xl'), [index]);

  return (
    <YStack
      width="100%"
      gap="$2xl"
      backgroundColor="$background"
      borderTopWidth={borderTopWidth}
      borderColor={borderColor}
      paddingTop={paddingTop}
      paddingHorizontal="$l"
      testID={`NavSection-${section.title}`}
    >
      <XStack width="100%" justifyContent="space-between" alignItems="center">
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
        {/* TODO: Implement these actions after we get design feedback
        <XStack alignItems="center" gap="$xs">
          {index !== 0 && (
            <Pressable onPress={() => onMoveUp(section.id)}>
              <Icon color="$primaryText" type="ChevronUp" size="$m" />
            </Pressable>
          )}
          {index !== totalSections - 1 && (
            <Pressable onPress={() => onMoveDown(section.id)}>
              <Icon color="$primaryText" type="ChevronDown" size="$m" />
            </Pressable>
          )}
        </XStack>
        */}
      </XStack>
      {children}
    </YStack>
  );
}

type GroupNavSectionWithChannels = Omit<db.GroupNavSection, 'channels'> & {
  channels: db.Channel[];
};

interface ManageChannelsScreenViewProps {
  goBack: () => void;
  goToEditChannel: (channelId: string) => void;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  group: db.Group | null;
  enableCustomChannels?: boolean;
  moveNavSection: (navSectionId: string, newIndex: number) => Promise<void>;
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
  moveNavSection,
  moveChannelWithinNavSection,
  moveChannelToNavSection,
  createNavSection,
  deleteNavSection,
  updateNavSection,
}: ManageChannelsScreenViewProps) {
  const [sections, setSections] = useState<Section[]>(() => {
    return groupNavSectionsWithChannels.map((s) => ({
      id: s.sectionId,
      title: s.title ?? 'Untitled Section',
      channels: s.channels.map((c, idx) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
        type: c.type,
        index: idx,
      })),
    }));
  });

  const [editSection, setEditSection] = useState<Section | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  useEffect(() => {
    const newNavSections = groupNavSectionsWithChannels.map((s) => ({
      id: s.sectionId,
      title: s.title ?? 'Untitled Section',
      channels: s.channels.map((c, idx) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
        type: c.type,
        index: idx,
      })),
    }));
    const currentTotalChannels = sections.reduce(
      (acc, section) => acc + section.channels.length,
      0
    );
    const newTotalChannels = newNavSections.reduce(
      (acc, section) => acc + section.channels.length,
      0
    );

    // Only update local state if the total number of sections have changed
    // OR if a newly created channel has been added to the default section
    // OR if a channel has been deleted
    // OR if a channel name has changed
    if (newNavSections.length === sections.length) {
      // Check if any channel names have changed
      const hasChannelNameChanged = newNavSections.some((newSection) => {
        const currentSection = sections.find((s) => s.id === newSection.id);
        if (!currentSection) return false;

        return newSection.channels.some((newChannel) => {
          const currentChannel = currentSection.channels.find(
            (c) => c.id === newChannel.id
          );
          return currentChannel && currentChannel.title !== newChannel.title;
        });
      });

      if (hasChannelNameChanged) {
        setSections(newNavSections);
        return;
      }

      if (newTotalChannels !== currentTotalChannels) {
        // Check if a new channel has been added to the default section
        if (
          newNavSections.some(
            (s) =>
              s.id === 'default' &&
              s.channels.length >
                sections.find((s) => s.id === 'default')!.channels.length
          )
        ) {
          setSections(newNavSections);
          return;
        }
        // Check if a channel has been deleted
        if (newTotalChannels < currentTotalChannels) {
          setSections(newNavSections);
          return;
        }
      }

      // No changes to the number of sections or channels. No-op because
      // we don't want to re-render the UI unnecessarily
      return;
    }

    setSections(newNavSections);
  }, [groupNavSectionsWithChannels, sections]);

  const handleUpdateSection = useCallback(
    async (sectionId: string, title: string) => {
      const navSection = groupNavSectionsWithChannels.find(
        (s) => s.sectionId === sectionId
      );

      if (!navSection) {
        logger.error(`Section not found: ${sectionId} (for update operation)`);
        return;
      }

      // Store original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) =>
        prevSections.map((s) => (s.id === sectionId ? { ...s, title } : s))
      );

      try {
        await updateNavSection({
          ...omit(navSection, 'channels'),
          title,
        });
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to update section:', e);
      }
    },
    [groupNavSectionsWithChannels, updateNavSection, sections]
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

      // Store original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) =>
        prevSections.filter((s) => s.id !== sectionId)
      );

      try {
        await deleteNavSection(navSection.id);
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to delete section:', e);
      }
    },
    [deleteNavSection, groupNavSectionsWithChannels, sections]
  );

  const handleMoveSectionUp = useCallback(
    async (sectionId: string) => {
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === 0) {
        logger.error(
          `Section "${sections[index].title}" is already at the top`
        );
        return;
      }

      // Store original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const [movedSection] = newSections.splice(index, 1);
        newSections.splice(index - 1, 0, movedSection);
        return newSections;
      });

      try {
        await moveNavSection(sectionId, index - 1);
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to move section up:', e);
      }
    },
    [sections, moveNavSection]
  );

  const handleMoveSectionDown = useCallback(
    async (sectionId: string) => {
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === sections.length - 1) {
        logger.error(
          `Section "${sections[index].title}" is already at the bottom`
        );
        return;
      }

      // Store original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const [movedSection] = newSections.splice(index, 1);
        newSections.splice(index + 1, 0, movedSection);
        return newSections;
      });

      try {
        await moveNavSection(sectionId, index + 1);
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to move section down:', e);
      }
    },
    [sections, moveNavSection]
  );

  const handleMoveChannelWithinNavSection = useCallback(
    async (channelId: string, sectionId: string, newIndex: number) => {
      const sectionIndex = sections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) {
        logger.error('Invalid section ID:', sectionId);
        return;
      }

      const channelIndex = sections[sectionIndex].channels.findIndex(
        (c) => c.id === channelId
      );
      if (channelIndex === -1) {
        logger.error(
          `Channel not found: ${channelId} (expected in section ${sectionId})`
        );
        return;
      }

      // Validate newIndex is within bounds
      if (newIndex < 0 || newIndex >= sections[sectionIndex].channels.length) {
        logger.error(
          'Invalid new index:',
          newIndex,
          'for section with',
          sections[sectionIndex].channels.length,
          'channels'
        );
        return;
      }

      // Store the original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const newChannels = [...newSections[sectionIndex].channels];
        const [movedChannel] = newChannels.splice(channelIndex, 1);
        newChannels.splice(newIndex, 0, movedChannel);
        newSections[sectionIndex] = {
          ...newSections[sectionIndex],
          channels: newChannels,
        };
        return newSections;
      });

      try {
        await moveChannelWithinNavSection(channelId, sectionId, newIndex);
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to move channel within section:', e);
      }
    },
    [sections, moveChannelWithinNavSection]
  );

  const handleMoveChannelToNavSection = useCallback(
    async (
      channelId: string,
      newSectionId: string,
      previousSectionId: string
    ) => {
      const previousSectionIndex = sections.findIndex(
        (s) => s.id === previousSectionId
      );

      if (previousSectionIndex === -1) {
        logger.error('Invalid previous section ID:', previousSectionId);
        return;
      }

      // Prevent moving to the same section
      if (newSectionId === previousSectionId) {
        logger.error(
          `Cannot move channel to section "${sections[previousSectionIndex].title}" as it is already there`
        );
        return;
      }

      const channel = sections[previousSectionIndex].channels.find(
        (c) => c.id === channelId
      );

      if (!channel) {
        logger.error(
          `Channel not found: ${channelId} (expected in section ${previousSectionId})`
        );
        return;
      }

      const sectionIndex = sections.findIndex((s) => s.id === newSectionId);
      if (sectionIndex === -1) {
        logger.error('Invalid new section ID:', newSectionId);
        return;
      }

      // Store the original state for rollback
      const originalSections = [...sections];

      // Update local state first for optimistic UI
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const newChannels = [...newSections[sectionIndex].channels];

        // The %groups agent only supports adding new channels to the start of a section.
        newChannels.unshift({
          id: channelId,
          title: channel.title,
          index: 0,
          type: channel.type,
        });

        newSections[sectionIndex] = {
          ...newSections[sectionIndex],
          channels: newChannels,
        };

        // Remove from the previous section
        const newPreviousChannels = newSections[
          previousSectionIndex
        ].channels.filter((c) => c.id !== channelId);

        newSections[previousSectionIndex] = {
          ...newSections[previousSectionIndex],
          channels: newPreviousChannels,
        };

        return newSections;
      });

      try {
        await moveChannelToNavSection(channelId, newSectionId);
      } catch (e) {
        // Restore original state on error
        setSections(originalSections);
        logger.error('Failed to move channel to new section:', e);
      }
    },
    [sections, moveChannelToNavSection]
  );

  const { bottom } = useSafeAreaInsets();

  const renderSectionsAndChannels = useMemo(() => {
    return sections.map((section, sectionIndex) => (
      <NavSection
        key={section.id}
        index={sectionIndex}
        totalSections={sections.length}
        section={section}
        onMoveUp={handleMoveSectionUp}
        onMoveDown={handleMoveSectionDown}
        editSection={setEditSection}
        deleteSection={handleDeleteSection}
        setShowAddSection={setShowAddSection}
        setShowCreateChannel={setShowCreateChannel}
        isEmpty={section.id !== 'default' && section.channels.length === 0}
        isDefault={section.id === 'default'}
      >
        {section.channels.length === 0 && <EmptySection />}
        {section.channels.map((channel, channelIndex) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            moveChannelWithinNavSection={(newIndex) => {
              handleMoveChannelWithinNavSection(
                channel.id,
                section.id,
                newIndex
              );
            }}
            moveChannelToNavSection={(newSectionIndex) => {
              handleMoveChannelToNavSection(
                channel.id,
                sections[newSectionIndex].id,
                section.id
              );
            }}
            index={channelIndex}
            sectionIndex={sectionIndex}
            isLast={channelIndex === section.channels.length - 1}
            isFirst={channelIndex === 0}
            isFirstSection={sectionIndex === 0}
            isLastSection={sectionIndex === sections.length - 1}
            onEdit={() => goToEditChannel(channel.id)}
          />
        ))}
      </NavSection>
    ));
  }, [
    sections,
    handleDeleteSection,
    goToEditChannel,
    handleMoveSectionDown,
    handleMoveSectionUp,
    handleMoveChannelWithinNavSection,
    handleMoveChannelToNavSection,
  ]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View backgroundColor="$background" flex={1}>
      <YStack
        backgroundColor="$background"
        justifyContent="space-between"
        flex={1}
      >
        <ScreenHeader
          title="Manage channels"
          useHorizontalTitleLayout={!isWindowNarrow}
          backAction={goBack}
          borderBottom
        />
        <YStack
          backgroundColor="$background"
          gap="$2xl"
          alignItems="center"
          flex={1}
        >
          <ScrollView
            style={{ zIndex: 1, elevation: 1, width: '100%' }}
            gap="$2xl"
            contentContainerStyle={{
              alignItems: 'center',
              paddingBottom: bottom,
            }}
          >
            {renderSectionsAndChannels}
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
