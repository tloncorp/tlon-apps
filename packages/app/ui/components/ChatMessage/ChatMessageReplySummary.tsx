import * as db from '@tloncorp/shared/db';
import { Icon, Pressable, useIsWindowNarrow } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { formatDistanceToNow } from 'date-fns';
import React, { useMemo } from 'react';
import { ColorTokens, View, XStack, styled } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { UnreadDot } from '../UnreadDot';

export const ChatMessageReplySummary = React.memo(
  function ChatMessageReplySummary({
    post,
    onPress,
    textColor,
    showTime = true,
    showEditedIndicator = false,
    deliveryFailed = false,
    onPressRetry,
  }: {
    post: db.Post;
    onPress?: () => void;
    textColor?: ColorTokens;
    showTime?: boolean;
    showEditedIndicator?: boolean;
    deliveryFailed?: boolean;
    onPressRetry?: () => void;
    // Since this component is used in places other than a chat log, we need to
    // be able to toggle the Chat message padding on and off
  }) {
    const { replyCount, replyTime, replyContactIds, threadUnread } = post;
    const hasUnreads = !!threadUnread?.count;
    const isNotify = threadUnread?.notify ?? false;
    const isWindowNarrow = useIsWindowNarrow();
    const time = useMemo(() => {
      return replyTime ? formatDistanceToNow(replyTime) : '';
    }, [replyTime]);

    const hasReplies = !!(replyCount && replyContactIds && replyTime);

    if (!hasReplies && !showEditedIndicator && !deliveryFailed) {
      return null;
    }

    const content = (
      <XStack gap="$m" alignItems="center">
        {deliveryFailed && (
          <Pressable
            onPress={(e) => {
              e?.stopPropagation();
              onPressRetry?.();
            }}
          >
            <XStack gap="$xs" alignItems="center">
              <Icon type="Redo" size="$s" color="$negativeActionText" />
              <Text size="$label/m" color="$negativeActionText">
                Send failed, {isWindowNarrow ? 'tap' : 'click'} to retry
              </Text>
            </XStack>
          </Pressable>
        )}
        {hasReplies && <AvatarPreviewStack contactIds={replyContactIds} />}
        {hasReplies && (
          <Text
            size="$label/m"
            color={
              textColor ??
              (hasUnreads
                ? isNotify
                  ? '$positiveActionText'
                  : '$tertiaryText'
                : '$primaryText')
            }
          >
            {replyCount} {replyCount > 1 ? 'replies' : 'reply'}
          </Text>
        )}
        {hasReplies && (
          <ThreadUnreadDot
            unreadCount={threadUnread?.count ?? 0}
            isNotify={isNotify}
          />
        )}
        {hasReplies && showTime && <ReplyTimeText>{time} ago</ReplyTimeText>}
        {showEditedIndicator && (
          <Text size="$label/m" paddingTop={1} color="$tertiaryText">
            Edited
          </Text>
        )}
      </XStack>
    );

    return onPress ? (
      <Pressable onPress={onPress}>{content}</Pressable>
    ) : (
      content
    );
  }
);

const AvatarPreviewFrame = styled(View, {
  marginRight: '$-m',
  marginLeft: -2,
  marginTop: -2,
  marginBottom: -2,
  borderColor: '$background',
  borderWidth: 2,
  borderRadius: '$2xs',
  variants: {
    isLast: {
      true: {
        marginRight: 0,
      },
    },
  },
});

function AvatarPreviewStack({ contactIds }: { contactIds: string[] }) {
  return (
    <XStack alignItems="center">
      {contactIds?.map((c, i) => (
        <AvatarPreviewFrame key={c} isLast={i === contactIds.length - 1}>
          <ContactAvatar contactId={c} size="$xl" />
        </AvatarPreviewFrame>
      ))}
    </XStack>
  );
}

const ReplyTimeText = styled(Text, {
  size: '$label/m',
  color: '$tertiaryText',
  paddingTop: 1,
});

function ThreadUnreadDot({
  unreadCount,
  isNotify,
}: {
  unreadCount: number;
  isNotify: boolean;
}) {
  if (unreadCount) {
    return <UnreadDot color={isNotify ? 'primary' : 'neutral'} />;
  }

  return null;
}
