import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { YStack, View, XStack } from 'tamagui';

import WayfindingNotice, {
  ChatInputTooltip,
  CollectionInputTooltip,
  NotebookInputTooltip,
} from '../ui/components/Wayfinding/Notices';
import { FixtureWrapper } from './FixtureWrapper';
import { group, tlonLocalIntros, tlonLocalBulletinBoard, tlonLocalGettingStarted } from './fakeData';

const mockChatChannel: db.Channel = {
  ...tlonLocalIntros,
  type: 'chat',
};

const mockGalleryChannel: db.Channel = {
  ...tlonLocalBulletinBoard,
  type: 'gallery',
};

const mockNotebookChannel: db.Channel = {
  ...tlonLocalGettingStarted,
  type: 'notebook',
};

function EmptyChannelChatFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="flex-end">
        <WayfindingNotice.EmptyChannel channel={mockChatChannel} />
      </YStack>
    </FixtureWrapper>
  );
}

function EmptyChannelGalleryFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="flex-start">
        <WayfindingNotice.EmptyChannel channel={mockGalleryChannel} />
      </YStack>
    </FixtureWrapper>
  );
}

function EmptyChannelNotebookFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="flex-start">
        <WayfindingNotice.EmptyChannel channel={mockNotebookChannel} />
      </YStack>
    </FixtureWrapper>
  );
}

function GroupChannelsNoticeFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} padding="$xl">
        <WayfindingNotice.GroupChannels group={group} />
      </YStack>
    </FixtureWrapper>
  );
}

function CustomizeGroupNoticeFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} justifyContent="center">
        <WayfindingNotice.CustomizeGroup />
      </YStack>
    </FixtureWrapper>
  );
}

function ChatInputTooltipFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} position="relative">
        <View flex={1} />
        <XStack
          height={60}
          backgroundColor="$secondaryBackground"
          alignItems="center"
          paddingHorizontal="$l"
          borderTopWidth={1}
          borderColor="$border"
        >
          <View
            flex={1}
            height={40}
            backgroundColor="$background"
            borderRadius="$l"
            marginRight="$m"
          />
          <View
            width={40}
            height={40}
            backgroundColor="$primaryText"
            borderRadius="$l"
          />
        </XStack>
        <ChatInputTooltip />
      </YStack>
    </FixtureWrapper>
  );
}

function CollectionInputTooltipFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} position="relative">
        <XStack
          height={60}
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="flex-end"
          paddingHorizontal="$l"
          borderBottomWidth={1}
          borderColor="$border"
        >
          <View
            width={40}
            height={40}
            backgroundColor="$primaryText"
            borderRadius="$l"
          />
        </XStack>
        <CollectionInputTooltip channelId="test-channel" />
        <View flex={1} />
      </YStack>
    </FixtureWrapper>
  );
}

function NotebookInputTooltipFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} position="relative">
        <XStack
          height={60}
          backgroundColor="$secondaryBackground"
          alignItems="center"
          justifyContent="flex-end"
          paddingHorizontal="$l"
          borderBottomWidth={1}
          borderColor="$border"
        >
          <View
            width={40}
            height={40}
            backgroundColor="$primaryText"
            borderRadius="$l"
          />
        </XStack>
        <NotebookInputTooltip channelId="test-channel" />
        <View flex={1} />
      </YStack>
    </FixtureWrapper>
  );
}

function AllTooltipsFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <YStack flex={1} padding="$2xl" gap="$4xl">
        <Text size="$title/l">Wayfinding Tooltips</Text>

        <YStack gap="$xl">
          <Text size="$label/l" color="$secondaryText">
            Chat Input Tooltip
          </Text>
          <YStack height={150} position="relative" backgroundColor="$secondaryBackground" borderRadius="$l">
            <View flex={1} />
            <ChatInputTooltip />
          </YStack>
        </YStack>

        <YStack gap="$xl">
          <Text size="$label/l" color="$secondaryText">
            Collection Input Tooltip
          </Text>
          <YStack height={150} position="relative" backgroundColor="$secondaryBackground" borderRadius="$l">
            <CollectionInputTooltip channelId="test" />
          </YStack>
        </YStack>

        <YStack gap="$xl">
          <Text size="$label/l" color="$secondaryText">
            Notebook Input Tooltip
          </Text>
          <YStack height={150} position="relative" backgroundColor="$secondaryBackground" borderRadius="$l">
            <NotebookInputTooltip channelId="test" />
          </YStack>
        </YStack>
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Empty Channel - Chat': <EmptyChannelChatFixture />,
  'Empty Channel - Gallery': <EmptyChannelGalleryFixture />,
  'Empty Channel - Notebook': <EmptyChannelNotebookFixture />,
  'Group Channels Notice': <GroupChannelsNoticeFixture />,
  'Customize Group Notice': <CustomizeGroupNoticeFixture />,
  'Chat Input Tooltip': <ChatInputTooltipFixture />,
  'Collection Input Tooltip': <CollectionInputTooltipFixture />,
  'Notebook Input Tooltip': <NotebookInputTooltipFixture />,
  'All Tooltips': <AllTooltipsFixture />,
};
