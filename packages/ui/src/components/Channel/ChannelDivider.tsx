import * as db from '@tloncorp/shared/dist/db';
import { isToday, makePrettyDay } from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';
import { View, XStack } from 'tamagui';

import { Text } from '../TextV2';

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
    <XStack alignItems="center" paddingVertical="$l">
      <View flex={1} height={1} backgroundColor={borderColor} />
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
        >
          {!hideTime ? `${time}` : null}
          {!hideTime && unreadCount ? ' • ' : null}
          {unreadCount
            ? `${unreadCount} new message${unreadCount === 1 ? '' : 's below'}`
            : null}
        </Text>
      </View>
      <View flex={1} height={1} backgroundColor={borderColor} />
    </XStack>
  );
}
