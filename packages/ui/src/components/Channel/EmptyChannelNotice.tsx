import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { SizableText, YStack } from 'tamagui';

import { useGroup } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { Button } from '../Button';
import { InviteUsersSheet } from '../InviteUsersSheet';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
}) {
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const group = useGroup(channel.groupId ?? '');
  console.log('group', group);
  const [isFirstVisit] = useState(() => channel.lastViewedAt == null);
  const [showInviteUsersSheet, setShowInviteUsersSheet] = useState(false);
  const isWelcomeChannel = !!channel.isDefaultWelcomeChannel;
  const noticeText = useMemo(() => {
    if (isGroupAdmin && isFirstVisit && isWelcomeChannel) {
      return 'This is your group’s default welcome channel. Feel free to rename it or create additional channels.';
    }

    return 'There are no messages... yet.';
  }, [isGroupAdmin, isFirstVisit, isWelcomeChannel]);

  return (
    <>
      <YStack gap="$l" paddingHorizontal="$xl">
        <SizableText textAlign="center" color="$tertiaryText">
          {noticeText}
        </SizableText>
        <Button hero onPress={() => setShowInviteUsersSheet(true)}>
          <Button.Text>Invite People</Button.Text>
        </Button>
      </YStack>
      <InviteUsersSheet
        open={showInviteUsersSheet}
        onOpenChange={setShowInviteUsersSheet}
        group={group}
        onInviteComplete={() => {}}
      />
    </>
  );
}
