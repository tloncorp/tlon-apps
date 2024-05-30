import * as store from '@tloncorp/shared/dist/store';
import { formatDistanceToNow } from 'date-fns';
import React, { useMemo } from 'react';

import { useChannelContext, useContactGetter } from '../../contexts';
import { SizableText, View, XStack } from '../../core';
import { Avatar } from '../Avatar';

export const ChatMessageReplySummary = React.memo(
  function ChatMessageReplySummary({
    postId,
    replyCount,
    replyTime,
    replyContactIds,
    onPress,
  }: {
    postId: string;
    replyCount: number;
    replyTime: number;
    replyContactIds: string[];
    onPress?: () => void;
  }) {
    const channel = useChannelContext();
    const { data: activity } = store.useThreadActivity({
      postId,
      channelId: channel.id,
    });

    const contactGetter = useContactGetter();
    const time = useMemo(() => {
      return formatDistanceToNow(replyTime);
    }, [replyTime]);

    return replyCount && replyContactIds && replyTime ? (
      <XStack gap="$m" paddingLeft="$4xl" onPress={onPress}>
        {activity?.count && <SizableText>UNREAD</SizableText>}
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
        <SizableText size="$s">
          {replyCount} {replyCount > 1 ? 'replies' : 'reply'}
        </SizableText>
        <SizableText size="$s" color="$tertiaryText">
          {time} ago
        </SizableText>
      </XStack>
    ) : null;
  }
);
