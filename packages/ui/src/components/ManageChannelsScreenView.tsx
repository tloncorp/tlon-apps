import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';
import { LayoutRectangle } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View, XStack, YStack } from '../core';
import { Button } from './Button';
import { DraggableItem } from './DraggableItem';
import { GenericHeader } from './GenericHeader';
import { SaveButton } from './GroupMetaScreenView';
import { Icon } from './Icon';
import Pressable from './Pressable';

type Section = {
  id: string;
  title: string;
  channels: Channel[];
};

type Channel = {
  id: string;
  title?: string | null;
};

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
      zIndex={4}
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
                <Icon color="$secondaryText" type="Dots" size="$m" />
              </View>
            </Pressable>
          </>
        )}
      </XStack>
    </DraggableItem>
  );
}

function DraggableNavSection({
  section,
  onDrag,
  onDragStart,
  onDragEnd,
  children,
}: {
  section: Section;
  onDrag: (translateY: number) => void;
  onDragStart: (layout: LayoutRectangle) => void;
  onDragEnd: (translateY: number) => void;
  children: React.ReactNode;
}) {
  return (
    <DraggableItem
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      zIndex={3}
    >
      <YStack
        padding="$xl"
        borderWidth={1}
        borderRadius="$xl"
        borderColor="$border"
        width="100%"
        gap="$2xl"
        backgroundColor="$background"
      >
        <XStack alignItems="center" gap="$l">
          <Pressable onPress={() => console.log('edit')}>
            <Icon color="$secondaryText" type="Dragger" />
          </Pressable>
          <Text fontSize="$l">{section.title}</Text>
        </XStack>
        {children}
      </YStack>
    </DraggableItem>
  );
}

type GroupNavSectionWithChannels = Omit<db.GroupNavSection, 'channels'> & {
  channels: db.Channel[];
};

export function ManageChannelsScreenView({
  groupNavSectionsWithChannels,
  channelsWithoutNavSection,
  goBack,
}: {
  goBack: () => void;
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  channelsWithoutNavSection: db.Channel[];
}) {
  const [sections, setSections] = useState<Section[]>(() => {
    const defaultSection: Section = {
      id: 'default',
      title: 'Default',
      channels: channelsWithoutNavSection.map((c) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
      })),
    };

    const otherSections: Section[] = groupNavSectionsWithChannels.map((s) => ({
      id: s.id,
      title: s.title ?? 'Untitled Section',
      channels: s.channels.map((c) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
      })),
    }));

    return [defaultSection, ...otherSections];
  });

  type DraggedItem = {
    type: 'section' | 'channel';
    channelId?: string;
    sectionId: string;
    layout: LayoutRectangle;
  };

  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const draggedItemY = useSharedValue(0);

  console.log('draggedItem', draggedItem);

  const handleSectionDragEnd = useCallback(
    (index: number, translateY: number) => {
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const newIndex = Math.min(
          Math.max(0, Math.round(index + translateY / 40)),
          newSections.length - 1
        );
        const [movedSection] = newSections.splice(index, 1);
        newSections.splice(newIndex, 0, movedSection);
        return newSections;
      });
      setDraggedItem(null);
      draggedItemY.value = 0;
    },
    [draggedItemY]
  );

  const handleChannelDragEnd = useCallback(
    (sectionId: string, channelIndex: number, translateY: number) => {
      console.log('channel drag end', sectionId, channelIndex, translateY);
      setSections((prevSections) => {
        const newSections = [...prevSections];
        const currentSectionIndex = newSections.findIndex(
          (s) => s.id === sectionId
        );
        const currentSection = newSections[currentSectionIndex];
        const [movedChannel] = currentSection.channels.splice(channelIndex, 1);

        // Calculate the target section index
        let targetSectionIndex = currentSectionIndex;
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
        let newChannelIndex;
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
    },
    [draggedItemY]
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
      console.log('handleDrag', translateY, draggedItemY.value, draggedItem);
      if (!draggedItem) {
        console.log('no dragged item, skipping drag event');
        return;
      }

      console.log('dragging', translateY, draggedItem.layout.y);
      draggedItemY.value = translateY + draggedItem.layout.y;
    },
    [draggedItemY, draggedItem]
  );

  const { bottom } = useSafeAreaInsets();

  const renderSectionsAndChannels = useMemo(() => {
    return sections.map((section, index) => (
      <DraggableNavSection
        key={section.id}
        section={section}
        onDragStart={(layout) => handleDragStart('section', layout, section.id)}
        onDrag={handleDrag}
        onDragEnd={(translateY) => handleSectionDragEnd(index, translateY)}
      >
        {section.channels.length === 0 && (
          <View width="100%">
            <Text padding="$l" fontSize="$m" color="$secondaryText">
              No channels
            </Text>
          </View>
        )}
        {section.channels.map((channel, index) => (
          <DraggableChannel
            key={channel.id}
            channel={channel}
            onEdit={() => console.log('edit channel', channel.id)}
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
      </DraggableNavSection>
    ));
  }, [
    sections,
    draggedItem,
    handleSectionDragEnd,
    handleChannelDragEnd,
    handleDragStart,
    handleDrag,
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
          {draggedItem.type === 'section' ? (
            <DraggableNavSection
              section={sections.find((s) => s.id === draggedItem.sectionId)!}
              onDragStart={() => {}}
              onDrag={() => {}}
              onDragEnd={() => {}}
            >
              {sections.find((s) => s.id === draggedItem.sectionId)?.channels
                .length === 0 && (
                <View width="100%">
                  <Text padding="$l" fontSize="$m" color="$secondaryText">
                    No channels
                  </Text>
                </View>
              )}
              {sections
                .find((s) => s.id === draggedItem.sectionId)
                ?.channels.map((channel) => (
                  <DraggableChannel
                    key={channel.id}
                    channel={channel}
                    onEdit={() => console.log('edit channel', channel.id)}
                    onDrag={() => {}}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                  />
                ))}
            </DraggableNavSection>
          ) : (
            <DraggableChannel
              channel={
                sections
                  .find((s) => s.id === draggedItem.sectionId)!
                  .channels.find((c) => c.id === draggedItem.channelId)!
              }
              onEdit={() => console.log('edit channel', draggedItem.channelId)}
              onDrag={() => {}}
              onDragStart={() => {}}
              onDragEnd={() => {}}
            />
          )}
        </Animated.View>
      )}
      <YStack
        backgroundColor="$background"
        justifyContent="space-between"
        flex={1}
      >
        <GenericHeader
          title="Manage channels"
          goBack={goBack}
          rightContent={<SaveButton onPress={() => console.log('save')} />}
        />
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
            style={{ zIndex: 1 }}
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
            <Button hero>
              <Button.Text>Create a channel</Button.Text>
            </Button>
            <Button secondary>
              <Button.Text>Add a section</Button.Text>
            </Button>
          </YStack>
        </YStack>
      </YStack>
    </View>
  );
}
