import { getCurrentUserIsHosted } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { Circle, View, XStack, YStack, isWeb, styled } from 'tamagui';

import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';

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
  WorkspaceSetup,
  GroupChannels,
  CustomizeGroup,
  HomeAddTooltip,
  ChatInputTooltip,
  BotMentionTooltip,
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

function GroupChannels(props: { group: db.Group }) {
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
          Welcome to your workspace! We’ve created three basic channels to get
          you started. Tap into each to explore how Tlon Messenger works.
        </NoticeText>
        <InviteFriendsToTlonButton group={props.group} />
      </NoticeContainer>
    </View>
  );
}

function CustomizeGroup() {
  return (
    <View marginHorizontal="$2xl">
      <NoticeContainer>
        <NoticeText>
          You can customize the appearance of your workspace before you send it
          to your friends.
        </NoticeText>
      </NoticeContainer>
    </View>
  );
}

export function HomeAddTooltip({ top = 36 }: { top?: number }) {
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const isHostedUser = getCurrentUserIsHosted();
  const botEnabled = isHostedUser && hostingBotEnabled;

  const handleDismiss = useCallback(() => {
    db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      tappedHomeAdd: true,
    }));
  }, []);

  return (
    <View position="absolute" top={top} right={18} zIndex={100}>
      <YStack alignItems="flex-end">
        <Pressable
          testID="HomeAddWayfindingTooltip"
          onPress={handleDismiss}
          paddingVertical={20}
          paddingLeft={20}
          paddingRight={44}
          width={220}
          backgroundColor="$positiveActionText"
          borderRadius="$l"
        >
          <Text size="$label/l" color="$white">
            {botEnabled
              ? 'Tap here to create a new workspace and invite your Tlonbot.'
              : 'Tap here to create a new workspace.'}
          </Text>
          <View position="absolute" top={8} right={8} padding={4}>
            <Icon
              type="Close"
              size="$s"
              color="$white"
              testID="HomeAddWayfindingTooltipDismiss"
            />
          </View>
        </Pressable>
      </YStack>
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

export function BotMentionTooltip() {
  const handleDismiss = useCallback(() => {
    db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      tappedHomeGroupHint: true,
    }));
  }, []);

  return (
    <View position="absolute" bottom={35} right={50}>
      <YStack gap="$l">
        <Pressable
          onPress={handleDismiss}
          paddingVertical={20}
          paddingLeft={20}
          paddingRight={44}
          width={240}
          backgroundColor="$positiveActionText"
          borderRadius="$l"
          testID="BotMentionWayfindingTooltip"
        >
          <Text size="$label/l" color="$white">
            Since you own this group, your Tlonbot will automatically respond to
            your messages. Others can @-mention your bot to interact with it.
          </Text>
          <View position="absolute" top={8} right={8} padding={4}>
            <Icon
              type="Close"
              size="$s"
              color="$white"
              testID="BotMentionWayfindingTooltipDismiss"
            />
          </View>
        </Pressable>
        <XStack width="100%" justifyContent="flex-end">
          <Circle backgroundColor="$positiveActionText" size="$2xl" />
        </XStack>
      </YStack>
    </View>
  );
}

export function CollectionInputTooltip(props: { channelId: string }) {
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

/**
 * The workspace conversation before the agent has said anything.
 *
 * The user can arrive here in under a second — onboarding lands them as soon
 * as the channel row syncs — while provisioning is still seating the agent and
 * the agent has yet to run its `install.setup` instruction. So an empty room is
 * a real arrival state, not an edge case, and showing "This is the start of the
 * channel" would be true but useless: it tells someone nothing is happening
 * when in fact something is.
 *
 * Two states, because they call for different things:
 *
 * - **setup pending** — the agent is about to introduce itself. There is
 *   nothing for the user to do about that, so the offered action is the one
 *   that makes the workspace worth having: bring in the person it is for.
 * - **setup done but the room is still empty** — rarer, and a genuine problem
 *   rather than a wait. Saying so beats an encouraging message that never
 *   resolves.
 */
function WorkspaceSetup({
  channel,
  setupComplete,
  onPressInvite,
}: {
  channel: db.Channel;
  setupComplete: boolean;
  onPressInvite?: () => void;
}) {
  return (
    <YStack
      flex={1}
      justifyContent="flex-end"
      paddingHorizontal="$xl"
      paddingVertical="$2xl"
    >
      <NoticeContainer gap="$l" testID="WorkspaceSetupNotice">
        {setupComplete ? (
          <>
            <NoticeText fontWeight="600">Nothing here yet</NoticeText>
            <NoticeText color="$secondaryText">
              Your workspace is set up, but your agent hasn’t posted anything.
              Say hello and it will pick things up from there.
            </NoticeText>
          </>
        ) : (
          <>
            <NoticeText fontWeight="600">Setting up your workspace…</NoticeText>
            <NoticeText color="$secondaryText">
              Your agent is getting started. It will post here in a moment with
              something to react to — you don’t need to do anything.
            </NoticeText>
            {onPressInvite ? (
              <Pressable testID="WorkspaceSetupInvite" onPress={onPressInvite}>
                <Text size="$label/m" color="$positiveActionText">
                  Invite the person this is for
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </NoticeContainer>
    </YStack>
  );
}
