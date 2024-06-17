import * as db from '@tloncorp/shared/dist/db';
import { isToday, makePrettyDay } from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'tamagui';

import { SizableText, View, XStack } from '../../core';

export function ChannelDivider({
  timestamp,
  unreadCount,
  isFirstPostOfDay,
  channelInfo,
  index,
}: {
  timestamp: number;
  unreadCount: number;
  isFirstPostOfDay?: boolean;
  channelInfo?: {
    id: string;
    type: db.ChannelType;
  };
  index: number;
}) {
  const color = unreadCount ? '$positiveActionText' : '$border';
  const hideTime = unreadCount && isToday(timestamp) && !isFirstPostOfDay;
  const time = useMemo(() => {
    return makePrettyDay(new Date(timestamp));
  }, [timestamp]);
  const { width } = useWindowDimensions();

  // for now, trigger a simple delayed read when the unread divider is displayed
  const handleLayout = useCallback(() => {
    if (unreadCount && channelInfo) {
      setTimeout(() => store.markChannelRead(channelInfo), 10000);
    }
  }, [channelInfo, unreadCount]);

  const isEven = index % 2 === 0;

  return (
    <XStack
      marginRight={
        channelInfo?.type === 'gallery'
          ? !isEven
            ? 0
            : -(width / 2)
          : undefined
      }
      marginLeft={
        channelInfo?.type === 'gallery'
          ? isEven
            ? 0
            : -(width / 2)
          : undefined
      }
      alignItems="center"
      padding="$l"
      onLayout={handleLayout}
    >
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
            ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'} ${channelInfo?.type === 'gallery' ? 'above' : 'below'}`
            : null}
        </SizableText>
      </View>
      <View flex={1} height={1} backgroundColor={color} />
    </XStack>
  );
}
