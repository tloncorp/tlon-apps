import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { SizableText, View } from 'tamagui';

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

  return (
    <View alignItems="center" paddingHorizontal="$2xl">
      <SizableText textAlign="center" color="$tertiaryText">
        {noticeText}
      </SizableText>
    </View>
  );
}
