import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { YStack, styled } from 'tamagui';

import { useChatOptions, useGroup } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { ArvosDiscussing } from '../ArvosDiscussing';
import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';

export function EmptyChannelNotice({
  channel,
  userId,
}: {
  channel: db.Channel;
  userId: string;
}) {
  const { onPressGroupMeta } = useChatOptions();
  const group = useGroup(channel.groupId ?? '');
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const isWelcomeNotice = isGroupAdmin && group?.channels?.length === 1;

  return isWelcomeNotice ? (
    <YStack
      flex={1}
      justifyContent="center"
      paddingHorizontal="$2xl"
      alignItems="center"
      gap="$3xl"
    >
      <TitleText color="$secondaryText">Welcome to your group!</TitleText>
      <ArvosDiscussing
        color="$tertiaryText"
        maxHeight={150}
        aspectRatio={911 / 755}
      />
      <YStack gap="$m" width={'100%'}>
        <Button secondary onPress={onPressGroupMeta}>
          <Icon type="Settings" size="$m" color="$secondaryText" />
          <Button.Text>Customize</Button.Text>
        </Button>
        <InviteFriendsToTlonButton group={group} />
      </YStack>
    </YStack>
  ) : (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$3xl">
      <TitleText> There are no messages... yet.</TitleText>
    </YStack>
  );
}

const TitleText = styled(Text, {
  color: '$tertiaryText',
  size: '$label/l',
  textAlign: 'center',
});
