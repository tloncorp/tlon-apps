import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { SizableText, View, YStack } from 'tamagui';

import { useGroup } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
}) {
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const group = useGroup(channel.groupId ?? '');
  const [isFirstVisit] = useState(() => channel.lastViewedAt == null);
  const isWelcomeChannel = !!channel.isDefaultWelcomeChannel;
  const noticeText = useMemo(() => {
    if (isGroupAdmin && isFirstVisit && isWelcomeChannel) {
      return 'This is your group’s default welcome channel. Feel free to rename it or create additional channels.';
    }

    return 'There are no messages... yet.';
  }, [isGroupAdmin, isFirstVisit, isWelcomeChannel]);

  return (
    <YStack
      height="100%"
      gap="$9xl"
      justifyContent="flex-end"
      paddingHorizontal="$xl"
    >
      <YStack height="70%" justifyContent="center">
        <SizableText textAlign="center" color="$tertiaryText">
          {noticeText}
        </SizableText>
      </YStack>
      <InviteFriendsToTlonButton group={group} />
    </YStack>
  );
}
