import { makePrettyDay } from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';

export function ChannelDivider({
  timestamp,
  unreadCount,
}: {
  timestamp: number;
  unreadCount: number;
}) {
  const color = unreadCount ? '$positiveActionText' : '$tertiaryText';
  const time = useMemo(() => {
    return makePrettyDay(new Date(timestamp));
  }, [timestamp]);
  return (
    <XStack alignItems="center" padding="$l" gap="$l">
      <View width={'$2xl'} height={1} backgroundColor={color} />
      <SizableText size="$s" fontWeight="$l" color={color}>
        {time}
        {unreadCount
          ? ` • ${unreadCount} new message${unreadCount === 1 ? '' : 's'} below`
          : null}
      </SizableText>
      <View flex={1} height={1} backgroundColor={color} />
    </XStack>
  );
}
