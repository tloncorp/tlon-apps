import * as db from '@tloncorp/shared/db';
import { resolveThreadUnread } from '@tloncorp/shared/logic';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { PropsWithChildren, ReactNode, useMemo } from 'react';
import { Theme, View, XStack, YStack, isWeb } from 'tamagui';

import { useThreadUnreads } from '../../contexts/threadUnreads';
import { useNavigateToProfile } from '../AuthorRow';
import { ContactAvatar } from '../Avatar';
import { BotBadge } from '../BotBadge';
import { ContactName } from '../ContactNameV2';
import { UnreadDot } from '../UnreadDot';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';
import { ReactionsDisplay } from './ReactionsDisplay';
import {
  BubbleSegment,
  formatBubbleTimestamp,
  segmentHugsContent,
} from './chatBubbleLayout';
import { useAuthorBubbleTint } from './useAuthorBubbleTint';

// Measurements from the mobile chat bubble designs.
const NEAR_INSET = 25; // screen edge to the sender's side of a bubble
const FAR_INSET = 50;
const SERIES_GAP = 15;
const IN_SERIES_GAP = 1;
const BUBBLE_PADDING_VERTICAL = 10;
const BUBBLE_PADDING_HORIZONTAL = 15;
export const BUBBLE_ELEMENT_GAP = 10;
export const BUBBLE_RADIUS = 12;
const OVERLAY_INSET = 8;

const channelTypesWithBubbles: db.ChannelType[] = ['chat', 'dm', 'groupDm'];

/** Whether chat rows in a channel of this type render as bubbles. */
export function useChatBubbleLayout(channelType: db.ChannelType) {
  return !isWeb && channelTypesWithBubbles.includes(channelType);
}

export function ChatMessageBubbleRow({
  isOwn,
  isFirstInSeries,
  deliveryStatus,
  children,
}: PropsWithChildren<{
  isOwn: boolean;
  isFirstInSeries: boolean;
  deliveryStatus?: db.PostDeliveryStatus | null;
}>) {
  return (
    <YStack
      paddingTop={isFirstInSeries ? SERIES_GAP : IN_SERIES_GAP}
      paddingLeft={isOwn ? FAR_INSET : NEAR_INSET}
      paddingRight={isOwn ? NEAR_INSET : FAR_INSET}
      alignItems={isOwn ? 'flex-end' : 'flex-start'}
      gap={IN_SERIES_GAP}
    >
      {children}
      {isOwn && deliveryStatus && deliveryStatus !== 'failed' ? (
        <View
          pointerEvents="none"
          position="absolute"
          right={0}
          bottom={BUBBLE_PADDING_VERTICAL - 2}
        >
          <ChatMessageDeliveryStatus status={deliveryStatus} />
        </View>
      ) : null}
    </YStack>
  );
}

export function ChatMessageBubbleSegment({
  segment,
  authorId,
  isOwn,
  header,
  footer,
  children,
}: PropsWithChildren<{
  segment: BubbleSegment;
  authorId: string;
  isOwn: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}>) {
  // Your own bubbles are the accent color, and media has no bubble behind it.
  const tint = useAuthorBubbleTint(
    isOwn || segment.kind === 'media' ? null : authorId
  );

  if (segment.kind === 'media') {
    return (
      <View alignSelf="stretch" borderRadius={BUBBLE_RADIUS} overflow="hidden">
        {children}
        {header ? (
          <View
            position="absolute"
            top={OVERLAY_INSET}
            {...(isOwn ? { right: OVERLAY_INSET } : { left: OVERLAY_INSET })}
          >
            <OverlayPill>{header}</OverlayPill>
          </View>
        ) : null}
        {footer ? (
          <View
            position="absolute"
            bottom={OVERLAY_INSET}
            {...(isOwn ? { right: OVERLAY_INSET } : { left: OVERLAY_INSET })}
          >
            {footer}
          </View>
        ) : null}
      </View>
    );
  }

  const bubble = (
    <YStack
      alignSelf={
        segmentHugsContent(segment)
          ? isOwn
            ? 'flex-end'
            : 'flex-start'
          : 'stretch'
      }
      maxWidth="100%"
      backgroundColor={tint ?? '$messageBubble'}
      borderRadius={BUBBLE_RADIUS}
      paddingVertical={BUBBLE_PADDING_VERTICAL}
      paddingHorizontal={BUBBLE_PADDING_HORIZONTAL}
      gap={BUBBLE_ELEMENT_GAP}
    >
      {header}
      {children}
      {footer}
    </YStack>
  );

  // Sub-themes defined in tamagui.config: legible colors on the accent for
  // your own bubbles, and cards that stand off the grey for everyone else's.
  return <Theme name={isOwn ? 'ownMessage' : 'otherMessage'}>{bubble}</Theme>;
}

function OverlayPill({ children }: PropsWithChildren) {
  return (
    <View
      backgroundColor="$background"
      borderRadius="$m"
      paddingHorizontal="$m"
      paddingVertical="$xs"
    >
      {children}
    </View>
  );
}

export function ChatMessageBubbleHeader({
  post,
  isOwn,
  showIdentity,
  showEditedIndicator,
  disableProfilePreview,
}: {
  post: db.Post;
  isOwn: boolean;
  showIdentity: boolean;
  showEditedIndicator: boolean;
  disableProfilePreview?: boolean;
}) {
  const navigateToProfile = useNavigateToProfile(post.authorId);
  const openProfile = disableProfilePreview ? undefined : navigateToProfile;
  const timestamp = useMemo(
    () => (post.sentAt ? formatBubbleTimestamp(post.sentAt) : null),
    [post.sentAt]
  );

  return (
    <XStack
      gap="$m"
      alignItems="center"
      justifyContent={isOwn ? 'flex-end' : 'flex-start'}
    >
      {showIdentity ? (
        <>
          <ContactAvatar
            contactId={post.authorId}
            size="custom"
            width={20}
            height={20}
            borderRadius="$xs"
            onPress={openProfile}
          />
          <Text
            size="$label/m"
            fontWeight="500"
            numberOfLines={1}
            flexShrink={1}
            onPress={openProfile}
          >
            <ContactName contactId={post.authorId} />
          </Text>
          {post.isBot ? <BotBadge contactId={post.authorId} assumeBot /> : null}
        </>
      ) : null}
      {timestamp ? (
        <Text
          size="$label/s"
          fontWeight={isOwn ? '500' : undefined}
          color={isOwn ? '$secondaryText' : '$tertiaryText'}
        >
          {timestamp}
        </Text>
      ) : null}
      {showEditedIndicator ? <EditedText /> : null}
    </XStack>
  );
}

function EditedText() {
  return (
    <Text size="$label/s" color="$tertiaryText">
      Edited
    </Text>
  );
}

export function ChatMessageBubbleFooter({
  post,
  isOwn,
  overlay,
  showReplies,
  showEditedIndicator,
  onPressReplies,
  onViewPostReactions,
}: {
  post: db.Post;
  isOwn: boolean;
  overlay: boolean;
  showReplies: boolean;
  showEditedIndicator: boolean;
  onPressReplies?: () => void;
  onViewPostReactions?: (post: db.Post) => void;
}) {
  const hasReplies = Boolean(
    showReplies && post.replyCount && post.replyTime && post.replyContactIds
  );
  const hasReactions = Boolean(post.reactions?.length);
  if (!hasReplies && !hasReactions && !showEditedIndicator) {
    return null;
  }

  const replies = hasReplies ? (
    <RepliesLink post={post} onPress={onPressReplies} />
  ) : null;

  return (
    <XStack
      gap="$m"
      alignItems="center"
      flexWrap="wrap"
      justifyContent={isOwn ? 'flex-end' : 'flex-start'}
    >
      {showEditedIndicator ? (
        overlay ? (
          <OverlayPill>
            <EditedText />
          </OverlayPill>
        ) : (
          <EditedText />
        )
      ) : null}
      {replies && overlay ? <OverlayPill>{replies}</OverlayPill> : replies}
      {hasReactions ? (
        <ReactionsDisplay
          post={post}
          bubble
          onViewPostReactions={onViewPostReactions}
        />
      ) : null}
    </XStack>
  );
}

function RepliesLink({
  post,
  onPress,
}: {
  post: db.Post;
  onPress?: () => void;
}) {
  const threadUnreads = useThreadUnreads();
  const threadUnread = resolveThreadUnread(threadUnreads, post);
  const count = post.replyCount ?? 0;

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <XStack alignItems="center" gap="$2xs">
        <Text
          size="$label/s"
          fontWeight="500"
          color={
            threadUnread?.count && threadUnread.notify
              ? '$positiveActionText'
              : '$primaryText'
          }
        >
          {count} {count === 1 ? 'Reply' : 'Replies'}
        </Text>
        <Icon type="ChevronRight" customSize={[14, 14]} color="$primaryText" />
        {threadUnread?.count ? (
          <UnreadDot
            testID="ThreadUnreadDot"
            color={threadUnread.notify ? 'primary' : 'neutral'}
          />
        ) : null}
      </XStack>
    </Pressable>
  );
}

export function ChatMessageBubbleRetry({
  onPressRetry,
}: {
  onPressRetry: () => void;
}) {
  return (
    <Pressable onPress={onPressRetry} paddingTop="$xs">
      <XStack gap="$xs" alignItems="center">
        <Icon type="Redo" size="$s" color="$negativeActionText" />
        <Text size="$label/s" color="$negativeActionText">
          Send failed, tap to retry
        </Text>
      </XStack>
    </Pressable>
  );
}
