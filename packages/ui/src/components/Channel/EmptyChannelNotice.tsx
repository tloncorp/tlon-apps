import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';
import { SizableText, YStack } from 'tamagui';

import { useGroup } from '../../contexts';
import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { useIsAdmin } from '../../utils';
import { Button } from '../Button';
import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
}) {
  const ctx = usePostCollectionContextUnsafelyUnwrapped();
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const group = useGroup(channel.groupId ?? '');
  const [isFirstVisit] = useState(() => channel.lastViewedAt == null);
  const isWelcomeChannel = !!channel.isDefaultWelcomeChannel;
  const noticeText = useMemo(() => {
    if (isGroupAdmin && isFirstVisit && isWelcomeChannel) {
      return 'Welcome to your group!';
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
      <YStack gap="$m">
        {isGroupAdmin && isWelcomeChannel && (
          <>
            <Button hero onPress={ctx.onPressConfigureChannel}>
              <Button.Text>Customize</Button.Text>
            </Button>
            <InviteFriendsToTlonButton group={group} />
          </>
        )}
      </YStack>
    </YStack>
  );
}
