import * as db from 'packages/shared/dist/db';
import { useMemo } from 'react';

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
  const noticeText = useMemo(() => getNoticeText(isGroupAdmin), [isGroupAdmin]);

  return (
    <View alignItems="center" paddingHorizontal="$2xl">
      <SizableText textAlign="center" color="$tertiaryText">
        {noticeText}
      </SizableText>
    </View>
  );
}

function getNoticeText(isAdmin: boolean) {
  if (isAdmin) {
    return 'This is your group’s default welcome channel. Feel free to rename it or create additional channels.';
  }

  return 'There are no messages... yet.';
}
