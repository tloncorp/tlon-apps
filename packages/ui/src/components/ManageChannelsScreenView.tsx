import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollView, Text, View, XStack, YStack } from '../core';
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
  onDragEnd,
}: {
  channel: Channel;
  onEdit: () => void;
  onDragEnd: (translateY: number) => void;
}) {
  return (
    <DraggableItem onDragEnd={onDragEnd}>
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
        <XStack alignItems="center" gap="$l">
          <Pressable onPress={() => console.log('edit')}>
            <Icon color="$secondaryText" type="Dragger" />
          </Pressable>
          <Text fontSize="$l" paddingVertical="$s">
            {channel.title}
          </Text>
        </XStack>
        <Pressable onPress={onEdit}>
          <View paddingVertical="$xs">
            <Icon color="$secondaryText" type="Dots" size="$m" />
          </View>
        </Pressable>
      </XStack>
    </DraggableItem>
  );
}

function DraggableNavSection({
  section,
  onDragEnd,
  onChannelDragEnd,
}: {
  section: Section;
  onDragEnd: (translateY: number) => void;
  onChannelDragEnd: (
    sectionId: string,
    channelIndex: number,
    translateY: number
  ) => void;
}) {
  return (
    <DraggableItem onDragEnd={onDragEnd}>
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
        {section.channels.map((channel, index) => (
          <DraggableChannel
            key={channel.id}
            channel={channel}
            onEdit={() => console.log('edit channel', channel.id)}
            onDragEnd={(translateY) =>
              onChannelDragEnd(section.id, index, translateY)
            }
          />
        ))}
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
    },
    []
  );

  const handleChannelDragEnd = useCallback(
    (sectionId: string, channelIndex: number, translateY: number) => {
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
    },
    []
  );

  const { bottom } = useSafeAreaInsets();

  return (
    <View backgroundColor="$background" flex={1}>
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
          <ScrollView
            // 114.7 is the height of the buttons at the bottom
            contentContainerStyle={{ paddingBottom: bottom + 114.7 }}
          >
            <YStack gap="$2xl" alignItems="center">
              {sections.map((section, index) => (
                <DraggableNavSection
                  key={section.id}
                  section={section}
                  onDragEnd={(translateY) =>
                    handleSectionDragEnd(index, translateY)
                  }
                  onChannelDragEnd={handleChannelDragEnd}
                />
              ))}
            </YStack>
          </ScrollView>
          <YStack
            position="absolute"
            backgroundColor="$background"
            bottom={bottom}
            gap="$l"
            width="100%"
            alignItems="center"
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
