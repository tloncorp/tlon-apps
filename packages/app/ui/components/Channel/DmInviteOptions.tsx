import * as db from '@tloncorp/shared/db';
import { blockUser, respondToDMInvite } from '@tloncorp/shared/store';
import { Button } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

export function DmInviteOptions({
  channel,
  goBack,
}: {
  channel: db.Channel;
  goBack: () => void;
}) {
  const { bottom } = useSafeAreaInsets();

  const accept = useCallback(() => {
    respondToDMInvite({ channel, accept: true });
  }, [channel]);

  const deny = useCallback(async () => {
    await respondToDMInvite({ channel, accept: false });
    goBack();
  }, [channel, goBack]);

  const blockAndDeny = useCallback(async () => {
    await respondToDMInvite({ channel, accept: false });
    // only block if single DM for now
    if (channel.type === 'dm') {
      blockUser(channel.id);
    }
    goBack();
  }, [channel, goBack]);

  return (
    <YStack
      marginHorizontal="$2xl"
      marginTop="$2xl"
      gap="$m"
      marginBottom={bottom}
    >
      <Button preset="primary" onPress={accept} label="Accept" centered />
      <Button preset="secondaryOutline" onPress={deny} label="Deny" centered />
      {channel.type === 'dm' && (
        <Button preset="secondaryOutline" onPress={blockAndDeny} label="Block" centered />
      )}
    </YStack>
  );
}
