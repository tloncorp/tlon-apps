import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { formatDistanceToNow } from 'date-fns';
import React, { useMemo } from 'react';
import { ColorTokens, View, XStack, styled } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { Text } from '../TextV2';
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
    const isMuted = post.volumeSettings || !threadUnread?.notify;
    const time = useMemo(() => {
      return formatDistanceToNow(replyTime!);
    }, [replyTime]);

    return replyCount && replyContactIds && replyTime ? (
      <XStack gap="$m" alignItems="center" onPress={onPress}>
        <AvatarPreviewStack contactIds={replyContactIds} />
        <Text
          size="$label/m"
          color={
            textColor ??
            (hasUnreads
              ? isMuted
                ? '$tertiaryText'
                : '$positiveActionText'
              : undefined)
          }
        >
          {replyCount} {replyCount > 1 ? 'replies' : 'reply'}
        </Text>
        <ThreadUnreadDot
          unreadCount={threadUnread?.count ?? 0}
          isMuted={logic.isMuted(post.volumeSettings?.level, 'thread')}
          isNotify={post.threadUnread?.notify ?? false}
        />
        {showTime && <ReplyTimeText>{time} ago</ReplyTimeText>}
      </XStack>
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
  isMuted,
  isNotify,
}: {
  unreadCount: number;
  isMuted: boolean;
  isNotify: boolean;
}) {
  if (unreadCount) {
    return <UnreadDot color={isMuted || !isNotify ? 'neutral' : 'primary'} />;
  }

  return null;
}
