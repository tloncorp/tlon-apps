import { isToday, makePrettyDay } from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';

export function ChannelDivider({
  timestamp,
  unreadCount,
  isFirstPostOfDay,
}: {
  timestamp: number;
  unreadCount: number;
  isFirstPostOfDay?: boolean;
}) {
  const color = unreadCount ? '$positiveActionText' : '$tertiaryText';
  const hideTime = unreadCount && isToday(timestamp) && !isFirstPostOfDay;
  const time = useMemo(() => {
    return makePrettyDay(new Date(timestamp));
  }, [timestamp]);
  return (
    <XStack alignItems="center" padding="$l" gap="$l">
      <View width={'$2xl'} height={1} backgroundColor={color} />
      <SizableText size="$s" fontWeight="$l" color={color}>
        {!hideTime ? `${time}` : null}
        {!hideTime && unreadCount ? ' • ' : null}
        {unreadCount
          ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'} below`
          : null}
      </SizableText>
      <View flex={1} height={1} backgroundColor={color} />
    </XStack>
  );
}
