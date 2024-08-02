import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { YStack } from 'tamagui';

import { Button } from '../Button';

export function DmInviteOptions({
  channel,
  goBack,
}: {
  channel: db.Channel;
  goBack: () => void;
}) {
  const accept = useCallback(() => {
    store.respondToDMInvite({ channel, accept: true });
  }, [channel]);

  const deny = useCallback(async () => {
    await store.respondToDMInvite({ channel, accept: false });
    goBack();
  }, [channel, goBack]);

  const blockAndDeny = useCallback(async () => {
    await store.respondToDMInvite({ channel, accept: false });
    // only block if single DM for now
    if (channel.type === 'dm') {
      store.blockUser(channel.id);
    }
    goBack();
  }, [channel, goBack]);

  return (
    <YStack marginHorizontal="$2xl" marginTop="$4xl" gap="$m">
      <Button hero onPress={accept}>
        <Button.Text>Accept</Button.Text>
      </Button>
      <Button secondary onPress={deny}>
        <Button.Text>Deny</Button.Text>
      </Button>
      {channel.type === 'dm' && (
        <Button secondary onPress={blockAndDeny}>
          <Button.Text>Block</Button.Text>
        </Button>
      )}
    </YStack>
  );
}
