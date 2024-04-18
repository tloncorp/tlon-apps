import { formatDistanceToNow } from 'date-fns';
import React, { useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';
import { Avatar } from '../Avatar';

export const ChatMessageReplySummary = React.memo(
  ({
    replyCount,
    replyTime,
    replyContactIds,
    onPress,
  }: {
    replyCount: number;
    replyTime: number;
    replyContactIds: string[];
    onPress?: () => void;
  }) => {
    const time = useMemo(() => {
      return formatDistanceToNow(replyTime);
    }, [replyTime]);

    // TODO: Load contacts

    return replyCount && replyContactIds && replyTime ? (
      <XStack gap="$m" paddingLeft="$4xl" onPress={onPress}>
        <XStack alignItems="center">
          {replyContactIds?.map((c, i) => (
            <View
              key={c}
              marginRight={i !== (replyContactIds?.length ?? 0) - 1 ? -8 : 0}
              borderColor="$background"
              borderWidth={2}
              borderRadius={'$xs'}
            >
              <Avatar key={c} contactId={c} size="$xl" />
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
