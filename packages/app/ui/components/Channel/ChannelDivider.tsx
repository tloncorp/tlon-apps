import * as db from '@tloncorp/shared/db';
import { isToday, makePrettyDay } from '@tloncorp/shared/logic';
import { Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { View, XStack } from 'tamagui';

export function ChannelDivider({
  post,
  unreadCount,
  isFirstPostOfDay,
}: {
  post: db.Post;
  unreadCount: number;
  isFirstPostOfDay?: boolean;
}) {
  const [backgroundColor, textColor, borderColor] = unreadCount
    ? ['$positiveActionText', '$background', '$positiveActionText']
    : ['$border', '$secondaryText', 'transparent'];

  const hideTime = unreadCount && isToday(post.receivedAt) && !isFirstPostOfDay;

  const time = useMemo(() => {
    return makePrettyDay(new Date(post.receivedAt));
  }, [post.receivedAt]);

  return (
    <XStack alignItems="center" justifyContent="center" paddingVertical="$l">
      <View
        paddingHorizontal="$m"
        paddingVertical="$s"
        backgroundColor={backgroundColor}
        borderRadius={'$2xl'}
      >
        <Text
          size="$label/m"
          ellipsizeMode="middle"
          numberOfLines={1}
          color={textColor}
          userSelect="none"
        >
          {!hideTime ? `${time}` : null}
          {!hideTime && unreadCount ? ' • ' : null}
          {unreadCount
            ? `${unreadCount} new message${unreadCount === 1 ? '' : 's below'}`
            : null}
        </Text>
      </View>
    </XStack>
  );
}
