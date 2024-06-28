import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { formatDistanceToNow } from 'date-fns';
import React, { useMemo } from 'react';

import { useContactGetter } from '../../contexts';
import { SizableText, View, XStack } from '../../core';
import { Avatar } from '../Avatar';
import { UnreadDot } from '../UnreadDot';

export const ChatMessageReplySummary = React.memo(
  function ChatMessageReplySummary({
    post,
    onPress,
  }: {
    post: db.Post;
    onPress?: () => void;
  }) {
    const { replyCount, replyTime, replyContactIds, threadUnread } = post;

    const contactGetter = useContactGetter();
    const time = useMemo(() => {
      return formatDistanceToNow(replyTime!);
    }, [replyTime]);

    return replyCount && replyContactIds && replyTime ? (
      <XStack gap="$m" paddingLeft="$4xl" onPress={onPress}>
        <XStack alignItems="center">
          {replyContactIds?.map((c, i) => (
            <View
              key={c}
              marginRight={i !== (replyContactIds?.length ?? 0) - 1 ? -8 : 0}
              borderColor="$background"
              borderWidth={2}
              borderRadius={'$2xs'}
            >
              <Avatar
                key={c}
                contactId={c}
                contact={contactGetter(c)}
                size="$xl"
              />
            </View>
          ))}
        </XStack>
        <XStack alignItems="center">
          <SizableText
            size="$s"
            color={
              threadUnread?.count
                ? post.volumeSettings?.isMuted || !threadUnread.notify
                  ? '$tertiaryText'
                  : '$positiveActionText'
                : undefined
            }
            fontWeight={threadUnread?.count ? '500' : undefined}
          >
            {replyCount} {replyCount > 1 ? 'replies' : 'reply'}
          </SizableText>
          <ThreadStatus
            unreadCount={threadUnread?.count ?? 0}
            isMuted={post.volumeSettings?.isMuted ?? false}
            isNotify={post.threadUnread?.notify ?? false}
          />
        </XStack>
        <SizableText size="$s" color="$tertiaryText">
          {time} ago
        </SizableText>
      </XStack>
    ) : null;
  }
);

function ThreadStatus({
  unreadCount,
  isMuted,
  isNotify,
}: {
  unreadCount: number;
  isMuted: boolean;
  isNotify: boolean;
}) {
  if (unreadCount) {
    return (
      <UnreadDot
        marginLeft="$s"
        color={isMuted || !isNotify ? 'neutral' : 'primary'}
      />
    );
  }

  return null;
}
