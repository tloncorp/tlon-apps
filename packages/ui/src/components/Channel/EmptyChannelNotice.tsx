import * as db from 'packages/shared/dist/db';
import { useMemo, useState } from 'react';

import { SizableText, View } from '../../core';
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
  const noticeText = useMemo(() => {
    if (isGroupAdmin && isFirstVisit) {
      return 'This is your group’s default welcome channel. Feel free to rename it or create additional channels.';
    }

    return 'There are no messages... yet.';
  }, [isGroupAdmin, isFirstVisit]);

  return (
    <View alignItems="center" paddingHorizontal="$2xl">
      <SizableText textAlign="center" color="$tertiaryText">
        {noticeText}
      </SizableText>
    </View>
  );
}
