import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Button, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { YStack, styled } from 'tamagui';

import { useChatOptions, useGroup } from '../../contexts';
import { useIsAdmin } from '../../utils';
import { ArvosDiscussing } from '../ArvosDiscussing';
import { InviteFriendsToTlonButton } from '../InviteFriendsToTlonButton';
import WayfindingNotice from '../Wayfinding/Notices';

export function EmptyChannelNotice({
  channel,
  userId,
  isLoading,
  loadPostsError,
  onPressRetryLoad,
}: {
  channel: db.Channel;
  userId: string;
  isLoading: boolean;
  loadPostsError?: Error | null;
  onPressRetryLoad?: () => void;
}) {
  const { onPressGroupMeta } = useChatOptions();
  const group = useGroup(channel.groupId ?? '');
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const isWelcomeNotice = isGroupAdmin && group?.channels?.length === 1;
  const isDefaultPersonalChannel = useMemo(() => {
    return logic.isDefaultPersonalChannel(channel, userId);
  }, [channel, userId]);

  const messagesNoun = useMemo(() => {
    return ['dm', 'groupDm', 'chat'].includes(channel?.type)
      ? 'messages'
      : 'posts';
  }, [channel?.type]);

  if (isDefaultPersonalChannel) {
    return <WayfindingNotice.EmptyChannel channel={channel} />;
  }

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
        <Button fill="outline" type="secondary" onPress={() => onPressGroupMeta(true)} label="Customize" leadingIcon="Settings" centered />
        <InviteFriendsToTlonButton group={group} />
      </YStack>
    </YStack>
  ) : isLoading ? (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <LoadingSpinner />
    </YStack>
  ) : loadPostsError ? (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$xl"
      paddingBottom="$2xl"
    >
      <YStack gap="$s" alignItems="center">
        <Text color="$tertiaryText">Failed to load posts</Text>
        <Text color="$tertiaryText" size="$label/s">
          Error: {loadPostsError.message}
        </Text>
      </YStack>
      <Button
        fill="outline"
        type="primary"
        size="small"
        onPress={onPressRetryLoad}
        label="Retry"
      />
    </YStack>
  ) : (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$3xl">
      <TitleText> There are no {messagesNoun}... yet.</TitleText>
    </YStack>
  );
}

const TitleText = styled(Text, {
  color: '$tertiaryText',
  size: '$label/l',
  textAlign: 'center',
});
