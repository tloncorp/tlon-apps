import * as db from '@tloncorp/shared/dist/db';
import { isToday, makePrettyDay } from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo } from 'react';

import { SizableText, View, XStack } from '../../core';

export function ChannelDivider({
  timestamp,
  unreadCount,
  isFirstPostOfDay,
  channelInfo,
}: {
  timestamp: number;
  unreadCount: number;
  isFirstPostOfDay?: boolean;
  channelInfo?: {
    id: string;
    type: db.ChannelType;
  };
}) {
  const color = unreadCount ? '$positiveActionText' : '$border';
  const hideTime = unreadCount && isToday(timestamp) && !isFirstPostOfDay;
  const time = useMemo(() => {
    return makePrettyDay(new Date(timestamp));
  }, [timestamp]);

  // for now, trigger a simple delayed read when the unread divider is displayed
  const handleLayout = useCallback(() => {
    if (unreadCount && channelInfo) {
      setTimeout(() => store.markChannelRead(channelInfo), 10000);
    }
  }, [channelInfo, unreadCount]);

  return (
    <XStack alignItems="center" padding="$l" onLayout={handleLayout}>
      <View width={'$2xl'} flex={1} height={1} backgroundColor={color} />
      <View
        paddingHorizontal="$m"
        backgroundColor={color}
        borderRadius={'$2xl'}
      >
        <SizableText
          ellipsizeMode="middle"
          numberOfLines={1}
          size="$s"
          fontWeight="$l"
          color={unreadCount ? '$background' : '$secondaryText'}
        >
          {!hideTime ? `${time}` : null}
          {!hideTime && unreadCount ? ' • ' : null}
          {unreadCount
            ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'} below`
            : null}
        </SizableText>
      </View>
      <View flex={1} height={1} backgroundColor={color} />
    </XStack>
  );
}
