import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { Platform, View as RNView } from 'react-native';
import { SizableText } from 'tamagui';

import { useIsAdmin } from '../../utils';

export function EmptyChannelNotice({
  channel,
  userId,
  withBugAdjust,
}: {
  channel: db.Channel;
  userId: string;
  withBugAdjust?: boolean;
}) {
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const [isFirstVisit] = useState(() => channel.lastViewedAt == null);
  const isWelcomeChannel = !!channel.isDefaultWelcomeChannel;
  const noticeText = useMemo(() => {
    if (isGroupAdmin && isFirstVisit && isWelcomeChannel) {
      return 'This is your group’s default welcome channel. Feel free to rename it or create additional channels.';
    }

    return 'There are no messages... yet.';
  }, [isGroupAdmin, isFirstVisit, isWelcomeChannel]);

  // this component is usually used within a list view, but there's a bug in RN
  // with rotating empty placeholders if the list is inverted. This custom styling is a workaround
  // that gives callers the ability to optionally account for that issue
  let contentStyle = undefined;
  if (withBugAdjust) {
    if (Platform.OS === 'ios') {
      contentStyle = {
        transform: [{ scaleY: -1 }],
      };
    } else if (Platform.OS === 'android') {
      contentStyle = {
        transform: [{ scaleY: -1 }, { scaleX: -1 }],
      };
    }
  }

  return (
    <RNView style={contentStyle}>
      <SizableText textAlign="center" color="$tertiaryText">
        {noticeText}
      </SizableText>
    </RNView>
  );
}
