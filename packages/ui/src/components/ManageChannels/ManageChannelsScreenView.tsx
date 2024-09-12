import * as db from '@tloncorp/shared/dist/db';
import { omit } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutRectangle } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { Button } from '../Button';
import { DraggableItem } from '../DraggableItem';
import { GenericHeader } from '../GenericHeader';
import { Icon } from '../Icon';
import Pressable from '../Pressable';
import { ChannelTypeName, CreateChannelSheet } from './CreateChannelSheet';
import { EditSectionNameSheet } from './EditSectionNameSheet';

export type Section = {
  id: string;
  title: string;
  channels: Channel[];
};

type Channel = {
  id: string;
  title?: string | null;
};

type DraggedItem = {
  type: 'section' | 'channel';
  channelId?: string;
  sectionId: string;
  layout: LayoutRectangle;
};

function EmptySection({
  deleteSection,
  isDefault,
}: {
  deleteSection: () => Promise<void>;
  isDefault: boolean;
}) {
  return (
    <YStack width="100%">
      <Text padding="$l" fontSize="$m" color="$secondaryText">
        No channels
      </Text>
      {!isDefault && (
        <Button heroDestructive onPress={deleteSection}>
          <Button.Text>Delete section</Button.Text>
        </Button>
      )}
    </YStack>
  );
}

function DraggableChannel({
  channel,
  onEdit,
  onDrag,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: {
  channel: Channel;
  onEdit: () => void;
  onDrag: (translateY: number) => void;
  onDragStart: (layout: LayoutRectangle) => void;
  onDragEnd: (translateY: number) => void;
  isDragging?: boolean;
}) {
  return (
    <DraggableItem
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      <XStack
        paddingHorizontal="$l"
        paddingLeft="$l"
        paddingRight="$2xl"
        width="100%"
        borderColor="$border"
        height="$6xl"
        gap="$2xl"
        borderWidth={1}
        borderRadius="$xl"
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$background"
      >
        {!isDragging && (
          <>
            <XStack alignItems="center" gap="$l">
              <Pressable onPress={() => console.log('edit')}>
                <Icon color="$secondaryText" type="Dragger" />
              </Pressable>
              <Text fontSize="$l" paddingVertical="$s">
                {channel?.title}
              </Text>
            </XStack>
            <Pressable onPress={onEdit}>
              <View paddingVertical="$xs">
                <Icon color="$secondaryText" type="Overflow" size="$m" />
              </View>
            </Pressable>
          </>
        )}
      </XStack>
    </DraggableItem>
  );
}

function NavSection({
  section,
  index,
  totalSections,
  onMoveUp,
  onMoveDown,
  editSection,
  children,
}: {
  section: Section;
  index: number;
  totalSections: number;
  onMoveUp: (sectionId: string) => void;
  onMoveDown: (sectionId: string) => void;
  editSection: (section: Section) => void;
  children: React.ReactNode;
}) {
  console.log('section, index', section.title, index);
  return (
    <YStack
      padding="$xl"
      borderWidth={1}
      borderRadius="$xl"
      borderColor="$border"
      width="100%"
      gap="$2xl"
      backgroundColor="$background"
    >
      <XStack
        width="100%"
        justifyContent="space-between"
        alignItems="center"
        gap="$l"
      >
        <XStack paddingLeft="$s" alignItems="center" gap="$l">
          <Text fontSize="$l">{section.title}</Text>
        </XStack>
        <XStack alignItems="center" gap="$s">
          {index !== 0 && (
            <Pressable onPress={() => onMoveUp(section.id)}>
              <Icon color="$primaryText" type="ArrowUp" size="$m" />
            </Pressable>
          )}
          {index !== totalSections - 1 && (
            <Pressable onPress={() => onMoveDown(section.id)}>
              <Icon color="$primaryText" type="ArrowDown" size="$m" />
            </Pressable>
          )}
          {section.id !== 'default' && (
            <Pressable onPress={() => editSection(section)}>
              <Icon color="$primaryText" type="Draw" size="$m" />
            </Pressable>
          )}
        </XStack>
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
  createChannel: ({
    title,
    description,
    channelType,
  }: {
    title: string;
    description: string;
    channelType: ChannelTypeName;
  }) => Promise<void>;
  createNavSection: ({ title }: { title: string }) => Promise<void>;
  deleteNavSection: (navSectionId: string) => Promise<void>;
  updateNavSection: (navSection: db.GroupNavSection) => Promise<void>;
}

export function ManageChannelsScreenView({
  groupNavSectionsWithChannels,
  goBack,
  goToEditChannel,
  moveNavSection,
  moveChannelWithinNavSection,
  moveChannelToNavSection,
  createChannel,
  createNavSection,
  deleteNavSection,
  updateNavSection,
}: ManageChannelsScreenViewProps) {
  const [sections, setSections] = useState<Section[]>(() => {
    console.log('componentDidMount', groupNavSectionsWithChannels);
    return groupNavSectionsWithChannels.map((s) => ({
      id: s.sectionId,
      title: s.title ?? 'Untitled Section',
      channels: s.channels.map((c) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
      })),
    }));
  });

  useEffect(() => {
    console.log('componentDidUpdate', groupNavSectionsWithChannels);
    setSections(
      groupNavSectionsWithChannels.map((s) => ({
        id: s.sectionId,
        title: s.title ?? 'Untitled Section',
        channels: s.channels.map((c) => ({
          id: c.id,
          title: c.title ?? 'Untitled Channel',
        })),
      }))
    );
  }, [groupNavSectionsWithChannels]);

  const [editSection, setEditSection] = useState<Section | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const draggedItemY = useSharedValue(0);

  // const handleSectionDragEnd = useCallback(
  // async (index: number, translateY: number) => {
  // const newIndex = Math.min(
  // Math.max(0, Math.round(index + translateY / 40)),
  // sections.length - 1
  // );

  // setSections((prevSections) => {
  // const newSections = [...prevSections];
  // const [movedSection] = newSections.splice(index, 1);
  // newSections.splice(newIndex, 0, movedSection);

  // return newSections;
  // });
  // setDraggedItem(null);
  // draggedItemY.value = 0;
  // await moveNavSection(sections[index].id, newIndex);
  // },
  // [draggedItemY, moveNavSection, sections]
  // );

  const handleChannelDragEnd = useCallback(
    async (sectionId: string, channelIndex: number, translateY: number) => {
      let newSections: Section[] = [];
      let newChannelIndex;
      let targetSectionIndex;
      setSections((prevSections) => {
        newSections = [...prevSections];
        const currentSectionIndex = newSections.findIndex(
          (s) => s.id === sectionId
        );
        const currentSection = newSections[currentSectionIndex];
        const [movedChannel] = currentSection.channels.splice(channelIndex, 1);

        // Calculate the target section index
        targetSectionIndex = currentSectionIndex;
        const sectionHeight = 150; // Approximate height of a section
        const direction = Math.sign(translateY);
        const sectionsMoved = Math.floor(Math.abs(translateY) / sectionHeight);

        if (direction > 0) {
          // Moving down
          targetSectionIndex = Math.min(
            currentSectionIndex + sectionsMoved,
            newSections.length - 1
          );
        } else if (direction < 0) {
          // Moving up
          targetSectionIndex = Math.max(currentSectionIndex - sectionsMoved, 0);
        }

        // Calculate new index within the target section
        const targetSection = newSections[targetSectionIndex];
        const channelHeight = 72; // Approximate height of a channel
        if (targetSectionIndex === currentSectionIndex) {
          newChannelIndex = Math.min(
            Math.max(0, Math.round(channelIndex + translateY / channelHeight)),
            targetSection.channels.length
          );
        } else {
          newChannelIndex = direction > 0 ? 0 : targetSection.channels.length;
        }

        // Insert the channel at its new position
        targetSection.channels.splice(newChannelIndex, 0, movedChannel);

        return newSections;
      });

      setDraggedItem(null);
      draggedItemY.value = 0;

      if (
        newChannelIndex !== undefined &&
        targetSectionIndex !== undefined &&
        newSections.length > 0
      ) {
        if (sections[targetSectionIndex].id !== sectionId) {
          await moveChannelToNavSection(
            newSections[targetSectionIndex].channels[newChannelIndex].id,
            newSections[targetSectionIndex].id
          );
        } else {
          await moveChannelWithinNavSection(
            newSections[targetSectionIndex].channels[newChannelIndex].id,
            newSections[targetSectionIndex].id,
            newChannelIndex
          );
        }
      }
    },
    [
      draggedItemY,
      moveChannelWithinNavSection,
      sections,
      moveChannelToNavSection,
    ]
  );

  const handleDragStart = useCallback(
    (
      type: 'section' | 'channel',
      layout: LayoutRectangle,
      sectionId: string,
      channelId?: string
    ) => {
      draggedItemY.value = layout.y;
      setDraggedItem({ type, sectionId, channelId, layout });
    },
    [draggedItemY]
  );

  const handleDrag = useCallback(
    (translateY: number) => {
      if (!draggedItem) {
        return;
      }

      draggedItemY.value = translateY + draggedItem.layout.y;
    },
    [draggedItemY, draggedItem]
  );

  const handleUpdateSection = useCallback(
    async (sectionId: string, title: string) => {
      const navSection = groupNavSectionsWithChannels.find(
        (s) => s.sectionId === sectionId
      );

      if (!navSection) {
        return;
      }

      await updateNavSection({
        ...omit(navSection, 'channels'),
        title,
      });

      setSections((prevSections) =>
        prevSections.map((s) => (s.id === sectionId ? { ...s, title } : s))
      );
    },
    [groupNavSectionsWithChannels, updateNavSection]
  );

  const handleDeleteSection = useCallback(
    async (sectionId: string) => {
      const navSection = groupNavSectionsWithChannels.find(
        (s) => s.sectionId === sectionId
      );

      if (!navSection) {
        return;
      }
      await deleteNavSection(navSection.id);
    },
    [deleteNavSection, groupNavSectionsWithChannels]
  );

  const handleMoveSectionUp = useCallback(
    async (sectionId: string) => {
      console.log('move up', sectionId);
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === 0) {
        return;
      }
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const [movedSection] = newSections.splice(index, 1);
        newSections.splice(index - 1, 0, movedSection);

        return newSections;
      });
      await moveNavSection(sectionId, index - 1);
    },
    [sections, moveNavSection]
  );

  const handleMoveSectionDown = useCallback(
    async (sectionId: string) => {
      console.log('move down', sectionId);
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === sections.length - 1) {
        return;
      }
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const [movedSection] = newSections.splice(index, 1);
        newSections.splice(index + 1, 0, movedSection);

        return newSections;
      });
      await moveNavSection(sectionId, index + 1);
    },
    [sections, moveNavSection]
  );

  const { bottom } = useSafeAreaInsets();

  const renderSectionsAndChannels = useMemo(() => {
    return sections.map((section, index) => (
      <NavSection
        key={section.id}
        index={index}
        totalSections={sections.length}
        section={section}
        onMoveUp={handleMoveSectionUp}
        onMoveDown={handleMoveSectionDown}
        editSection={setEditSection}
      >
        {section.channels.length === 0 && (
          <EmptySection
            isDefault={section.id === 'default'}
            deleteSection={() => handleDeleteSection(section.id)}
          />
        )}
        {section.channels.map((channel, index) => (
          <DraggableChannel
            key={channel.id}
            channel={channel}
            onEdit={() => goToEditChannel(channel.id)}
            onDrag={handleDrag}
            onDragStart={(layout) =>
              handleDragStart('channel', layout, section.id, channel.id)
            }
            onDragEnd={(translateY) =>
              handleChannelDragEnd(section.id, index, translateY)
            }
            isDragging={
              draggedItem?.type === 'channel' &&
              draggedItem.channelId === channel.id
            }
          />
        ))}
      </NavSection>
    ));
  }, [
    sections,
    draggedItem,
    handleChannelDragEnd,
    handleDragStart,
    handleDrag,
    handleDeleteSection,
    goToEditChannel,
    handleMoveSectionDown,
    handleMoveSectionUp,
  ]);

  return (
    <View backgroundColor="$background" flex={1}>
      {draggedItem && (
        <Animated.View
          style={{
            position: 'absolute',
            top: draggedItemY ?? draggedItem.layout.y,
            left: draggedItem.layout.x,
            width: draggedItem.layout.width,
            height: draggedItem.layout.height,
            zIndex: 2000,
            elevation: 2000,
          }}
        >
          <DraggableChannel
            channel={
              sections
                .find((s) => s.id === draggedItem.sectionId)!
                .channels.find((c) => c.id === draggedItem.channelId)!
            }
            onEdit={() => {}}
            onDrag={() => {}}
            onDragStart={() => {}}
            onDragEnd={() => {}}
          />
        </Animated.View>
      )}
      <YStack
        backgroundColor="$background"
        justifyContent="space-between"
        flex={1}
      >
        <GenericHeader title="Manage channels" goBack={goBack} />
        <YStack
          backgroundColor="$background"
          gap="$2xl"
          padding="$xl"
          alignItems="center"
          flex={1}
        >
          <Animated.ScrollView
            // 114.7 is the height of the buttons at the bottom
            contentContainerStyle={{ paddingBottom: bottom + 114.7 }}
            style={{ zIndex: 1, elevation: 1 }}
          >
            <YStack gap="$2xl" alignItems="center">
              {renderSectionsAndChannels}
            </YStack>
          </Animated.ScrollView>
          <YStack
            position="absolute"
            backgroundColor="$background"
            bottom={bottom}
            gap="$l"
            width="100%"
            alignItems="center"
            zIndex={5}
          >
            <Button hero onPress={() => setShowCreateChannel(true)}>
              <Button.Text>Create a channel</Button.Text>
            </Button>
            <Button secondary onPress={() => setShowAddSection(true)}>
              <Button.Text>Add a section</Button.Text>
            </Button>
          </YStack>
        </YStack>
      </YStack>
      {showCreateChannel && (
        <CreateChannelSheet
          onOpenChange={(open) => setShowCreateChannel(open)}
          createChannel={async ({ title, description, channelType }) =>
            createChannel({
              title,
              description,
              channelType,
            })
          }
        />
      )}
      <EditSectionNameSheet
        open={showAddSection}
        mode="add"
        onOpenChange={(open) => setShowAddSection(open)}
        onSave={async (title) =>
          createNavSection({
            title,
          })
        }
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
