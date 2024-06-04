import * as db from '@tloncorp/shared/dist/db';
import { isToday, makePrettyDay } from '@tloncorp/shared/dist/logic';
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SizableText, View, XStack } from '../../core';

export function ChannelDivider({
  post,
  unreadCount,
  isFirstPostOfDay,
  onSeen,
}: {
  post: db.Post;
  unreadCount: number;
  isFirstPostOfDay?: boolean;
  onSeen?: (post: db.Post) => void;
}) {
  const color = unreadCount ? '$positiveActionText' : '$border';
  const hideTime = unreadCount && isToday(post.receivedAt) && !isFirstPostOfDay;
  const time = useMemo(() => {
    return makePrettyDay(new Date(post.receivedAt));
  }, [post.receivedAt]);

  const handleSeen = useCallback(() => {
    if (unreadCount) {
      onSeen?.(post);
    }
  }, [onSeen, post, unreadCount]);

  return (
    <XStack alignItems="center" padding="$l" onLayout={handleSeen}>
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

// export function ThreadDivider(props: ComponentProps<typeof Divider>) {
//   const { channel, post: parentPost } = useThreadContext();

//   // for now, trigger a simple delayed read when the unread divider is displayed
//   const handleLayout = useCallback(() => {
//     if (props.unreadCount && channel && parentPost) {
//       setTimeout(
//         () => store.markThreadRead({ post: props.post, parentPost, channel }),
//         10_000
//       );
//     }
//   }, [channel, parentPost, props.post, props.unreadCount]);

//   return (
//     <View onLayout={handleLayout}>
//       <Divider {...props} />
//     </View>
//   );
// }

// export function ChannelDivider(props: ComponentProps<typeof Divider>) {
//   const channel = useChannelContext();

//   // for now, trigger a simple delayed read when the unread divider is displayed
//   const handleLayout = useCallback(() => {
//     if (props.unreadCount && channel) {
//       setTimeout(() => store.markChannelRead(channel), 10_000);
//     }
//   }, [channel, props.unreadCount]);

//   return (
//     <View onLayout={handleLayout}>
//       <Divider {...props} />
//     </View>
//   );
// }
