import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Circle, View, XStack, YStack, isWeb, styled } from 'tamagui';

import { useStore } from '../../contexts';

const NoticeContainer = styled(YStack, {
  backgroundColor: '$positiveBackground',
  padding: '$2xl',
  borderRadius: '$l',
  maxWidth: 600,
});

const NoticeText = styled(Text, {
  size: '$body',
});

const WayfindingNotice = {
  EmptyChannel,
  GroupChannels,
  CustomizeGroup,
  ChatInputTooltip,
  CollectionInputTooltip,
  NotebookInputTooltip,
};
export default WayfindingNotice;

function EmptyChannel({ channel }: { channel: db.Channel }) {
  if (channel.type === 'gallery') {
    return (
      <View
        flex={1}
        justifyContent="flex-start"
        alignItems="center"
        marginHorizontal="$2xl"
      >
        <EmptyPersonalGallery />
      </View>
    );
  }

  if (channel.type === 'notebook') {
    return (
      <View
        flex={1}
        justifyContent="flex-start"
        alignItems="center"
        marginHorizontal="$2xl"
      >
        <EmptyPersonalNotebook />
      </View>
    );
  }

  return (
    <View
      flex={1}
      justifyContent="flex-end"
      alignItems="center"
      marginHorizontal="$2xl"
    >
      <EmptyPersonalChat />
    </View>
  );
}

function EmptyPersonalChat() {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const tooltipVisible = useMemo(() => {
    return !wayfindingProgress.tappedChatInput;
  }, [wayfindingProgress]);

  return (
    <NoticeContainer marginBottom={tooltipVisible ? 95 : '$xl'}>
      <NoticeText>
        This is a Chat channel, best for real-time messaging. You can send text,
        images, and links. You can also react to messages, quote them, and reply
        in threads.
      </NoticeText>
    </NoticeContainer>
  );
}

function EmptyPersonalGallery() {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const tooltipVisible = useMemo(() => {
    return !wayfindingProgress.tappedAddCollection;
  }, [wayfindingProgress]);

  return (
    <NoticeContainer marginTop={tooltipVisible ? 90 : '$xl'}>
      <NoticeText>
        This is a Gallery channel, best for storing images and links. You can
        react to and comment on posts.
      </NoticeText>
    </NoticeContainer>
  );
}

function EmptyPersonalNotebook() {
  const wayfindingProgress = db.wayfindingProgress.useValue();
  const tooltipVisible = useMemo(() => {
    return !wayfindingProgress.tappedAddNote;
  }, [wayfindingProgress]);

  return (
    <NoticeContainer marginTop={tooltipVisible ? 90 : '$xl'}>
      <NoticeText>
        This is a Notebook channel, best for posting long-form thoughts and
        writing. You can edit and comment on posts.
      </NoticeText>
    </NoticeContainer>
  );
}

function GroupChannels() {
  const store = useStore();
  const { data: wayfindingStatus } = store.useWayfindingCompletion();

  if (wayfindingStatus?.completedPersonalGroupTutorial ?? true) {
    return null;
  }

  return (
    <View
      paddingHorizontal={isWeb ? 'unset' : '$xl'}
      marginVertical={isWeb ? '$xl' : 'unset'}
    >
      <NoticeContainer gap="$xl">
        <NoticeText>
          Welcome to your group! We’ve created three basic channels to get you
          started. Tap into each to explore how Tlon Messenger works.
        </NoticeText>
      </NoticeContainer>
    </View>
  );
}

function CustomizeGroup() {
  return (
    <View marginHorizontal="$2xl">
      <NoticeContainer>
        <NoticeText>
          You can customize the appearance of your group before you send it to
          your friends.
        </NoticeText>
      </NoticeContainer>
    </View>
  );
}

export function ChatInputTooltip() {
  return (
    <View position="absolute" bottom={35} right={50}>
      <YStack gap="$l">
        <View
          padding={20}
          width={200}
          backgroundColor="$positiveActionText"
          borderRadius="$l"
        >
          <Text size="$label/l" color="$white">
            Send a message here.
          </Text>
        </View>
        <XStack width="100%" justifyContent="flex-end">
          <Circle backgroundColor="$positiveActionText" size="$2xl" />
        </XStack>
      </YStack>
    </View>
  );
}

export function CollectionInputTooltip(props: { channelId: string }) {
  const store = useStore();
  const shouldShow = store.useShowCollectionAddTooltip(props.channelId);

  if (!shouldShow) {
    return null;
  }

  return (
    <View position="absolute" top={30} right={60}>
      <YStack gap="$l">
        <XStack width="100%" justifyContent="flex-end">
          <Circle backgroundColor="$positiveActionText" size="$2xl" />
        </XStack>
        <View
          padding={20}
          width={200}
          backgroundColor="$positiveActionText"
          borderRadius="$l"
        >
          <Text size="$label/l" color="$white">
            Add a block here.
          </Text>
        </View>
      </YStack>
    </View>
  );
}

export function NotebookInputTooltip(props: { channelId: string }) {
  const store = useStore();
  const shouldShow = store.useShowNotebookAddTooltip(props.channelId);

  if (!shouldShow) {
    return null;
  }

  return (
    <View position="absolute" top={30} right={60}>
      <YStack gap="$l">
        <XStack width="100%" justifyContent="flex-end">
          <Circle backgroundColor="$positiveActionText" size="$2xl" />
        </XStack>
        <View
          padding={20}
          width={160}
          backgroundColor="$positiveActionText"
          borderRadius="$l"
        >
          <Text size="$label/l" color="$white">
            Add a note here.
          </Text>
        </View>
      </YStack>
    </View>
  );
}
