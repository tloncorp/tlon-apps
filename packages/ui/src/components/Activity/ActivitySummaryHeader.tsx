import * as logic from '@tloncorp/shared/dist/logic';
import { PropsWithChildren } from 'react';
import { SizableText, XStack } from 'tamagui';

import { UnreadDot } from '../UnreadDot';

export function ActivitySummaryHeader({
  title,
  unreadCount,
  sentTime,
  children,
}: PropsWithChildren<{
  title: string;
  unreadCount: number;
  sentTime?: number;
}>) {
  return (
    <XStack alignItems="center" gap="$s">
      {unreadCount || children ? (
        <XStack alignItems="center" gap="$s">
          {unreadCount ? <UnreadDot /> : null}
          {children}
        </XStack>
      ) : null}
      <SizableText fontSize="$s" color="$secondaryText">
        {title}
      </SizableText>
      {sentTime && (
        <SizableText fontSize="$s" color="$secondaryText">
          {logic.makePrettyTime(new Date(sentTime))}
        </SizableText>
      )}
    </XStack>
  );
}
