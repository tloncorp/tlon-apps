import * as db from 'packages/shared/dist/db';
import React, { useMemo } from 'react';

import { ScrollView, SizableText, View } from '../../core';
import { useIsAdmin } from '../../utils';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
}) {
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);

  return (
    <ScrollView
      padding="$xl"
      contentContainerStyle={{ flex: 1, justifyContent: 'flex-end' }}
    >
      <View backgroundColor="$blueSoft" borderRadius="$xl" padding="$xl">
        <SizableText>{getNoticeText(isGroupAdmin)}</SizableText>
      </View>
    </ScrollView>
  );
}

function getNoticeText(isAdmin: boolean) {
  if (isAdmin) {
    return 'This is a general discussion channel for your group. People you invite can post, react, and comment.';
  }

  return 'There are no messages...yet.';
}
