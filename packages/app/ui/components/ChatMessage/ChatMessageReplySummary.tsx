import * as db from '@tloncorp/shared/db';
import { Pressable } from '@tloncorp/ui';
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
  }: {
    post: db.Post;
    onPress?: () => void;
    textColor?: ColorTokens;
    showTime?: boolean;
    // Since this component is used in places other than a chat log, we need to
    // be able to toggle the Chat message padding on and off
  }) {
    const { replyCount, replyTime, replyContactIds, threadUnread } = post;
    const hasUnreads = !!threadUnread?.count;
    const isNotify = threadUnread?.notify ?? false;
    const time = useMemo(() => {
      return formatDistanceToNow(replyTime!);
    }, [replyTime]);

    return replyCount && replyContactIds && replyTime ? (
      <Pressable onPress={onPress}>
        <XStack gap="$m" alignItems="center">
          <AvatarPreviewStack contactIds={replyContactIds} />
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
          <ThreadUnreadDot
            unreadCount={threadUnread?.count ?? 0}
            isNotify={isNotify}
          />
          {showTime && <ReplyTimeText>{time} ago</ReplyTimeText>}
        </XStack>
      </Pressable>
    ) : null;
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
        <AvatarPreviewFrame key={i} isLast={i === contactIds.length - 1}>
          <ContactAvatar contactId={c} size="$xl" />
        </AvatarPreviewFrame>
      ))}
    </XStack>
  );
}

const ReplyTimeText = styled(Text, {
  size: '$label/m',
  color: '$tertiaryText',
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
