import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { View as RNView } from 'react-native';
import { SizableText } from 'tamagui';

import { useIsAdmin } from '../../utils';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
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
  return (
    <RNView>
      <SizableText textAlign="center" color="$tertiaryText">
        {noticeText}
      </SizableText>
    </RNView>
  );
}
