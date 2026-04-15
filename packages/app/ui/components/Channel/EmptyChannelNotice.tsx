import * as db from '@tloncorp/shared/db';
import { defaultTemplateChannelTitles } from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { YStack, styled } from 'tamagui';

import { useChatOptions } from '../../contexts/chatOptions';
import { useGroup } from '../../contexts/groups';
import { useChatTitle, useIsAdmin } from '../../utils';
import WayfindingNotice from '../Wayfinding/Notices';

export function EmptyChannelNotice({
  channel,
  userId,
  isLoading,
  loadPostsError,
  onPressRetryLoad,
  isAdmin: isAdminOverride,
}: {
  channel: db.Channel;
  userId: string;
  isLoading: boolean;
  loadPostsError?: Error | null;
  onPressRetryLoad?: () => void;
  isAdmin?: boolean;
}) {
  const {
    onPressInvite,
    onPressGroupMeta,
    onPressChannelMeta,
    onPressChatDetails,
  } = useChatOptions();
  const group = useGroup(channel.groupId ?? '');
  const isGroupAdminFromHook = useIsAdmin(channel.groupId ?? '', userId);
  const isGroupAdmin = isAdminOverride ?? isGroupAdminFromHook;
  const isDefaultPersonalChannel = useMemo(() => {
    return logic.isDefaultPersonalChannel(channel, userId);
  }, [channel, userId]);

  const isSingleChannelGroup = (group?.channels?.length ?? 0) <= 1;
  const title = useChatTitle(channel, group);
  const displayTitle =
    !title || title === 'Untitled group' ? 'your group' : title;
  const headingTitle = useMemo(() => {
    if (channel.type === 'dm') return 'your direct message';
    if (!title || title === 'Untitled group') return 'your group';
    if (
      !isSingleChannelGroup &&
      group?.title &&
      defaultTemplateChannelTitles.has(title)
    ) {
      return `${group.title}'s ${title}`;
    }
    return title;
  }, [channel.type, title, isSingleChannelGroup, group?.title]);
  const memberCount = group?.members?.length ?? group?.memberCount ?? 0;
  const roleCount = group?.roles?.length ?? 0;
  const memberText = memberCount === 1 ? '1 Member' : `${memberCount} Members`;
  const roleText = roleCount === 1 ? '1 Role' : `${roleCount} Roles`;

  const subtitle = useMemo(() => {
    const name = displayTitle;
    if (channel.type === 'dm') {
      return `You're speaking directly with ${title ?? 'someone'}.`;
    }
    if (channel.type === 'groupDm') {
      return `This is the start of this group conversation.`;
    }
    if (isSingleChannelGroup) {
      return `This is the start of ${name}.`;
    }
    const privacy = group?.privacy;
    if (privacy) {
      return `This is the start of the ${privacy} ${name} channel.`;
    }
    return `This is the start of the ${name} channel.`;
  }, [channel.type, isSingleChannelGroup, group?.privacy, displayTitle, title]);

  const TitleText = styled(Text, {
    fontSize: '$xl',
    fontWeight: '600',
    color: '$primaryText',
  });

  if (isDefaultPersonalChannel) {
    return <WayfindingNotice.EmptyChannel channel={channel} />;
  }

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </YStack>
    );
  }

  if (loadPostsError) {
    return (
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
          preset="outline"
          size="small"
          onPress={onPressRetryLoad}
          label="Retry"
        />
      </YStack>
    );
  }

  const isBoxedLayout =
    channel.type === 'notebook' || channel.type === 'gallery';

  const noticeContent = (
    <>
      <YStack gap="$m">
        <TitleText>🌱 Welcome to {headingTitle}!</TitleText>
        <Text size="$body" color="$secondaryText">
          {subtitle}
        </Text>
      </YStack>
      {isGroupAdmin && (
        <YStack gap="$xl" alignItems="flex-start">
          <Button
            fill="text"
            intent="positive"
            label="Invite people"
            testID="EmptyChannelInviteButton"
            onPress={onPressInvite}
          />
          <Button
            fill="text"
            intent="positive"
            label={isSingleChannelGroup ? 'Edit group' : 'Edit channel'}
            testID={
              isSingleChannelGroup
                ? 'EmptyChannelEditGroupButton'
                : 'EmptyChannelEditChannelButton'
            }
            onPress={
              isSingleChannelGroup
                ? () => onPressGroupMeta()
                : onPressChannelMeta
            }
          />
          <Button
            preset="secondaryOutline"
            label={`${memberText} · ${roleText}`}
            leadingIcon={'Settings'}
            trailingIcon={'ChevronRight'}
            onPress={() =>
              channel.groupId &&
              onPressChatDetails({ type: 'group', id: channel.groupId })
            }
          />
        </YStack>
      )}
    </>
  );

  if (isBoxedLayout) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        marginHorizontal={'$xl'}
      >
        <YStack width="100%" maxWidth={400} padding="$2xl" gap="$2xl">
          {noticeContent}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack
      flex={1}
      justifyContent="flex-end"
      paddingHorizontal="$xl"
      paddingVertical="$2xl"
    >
      <YStack gap="$2xl" paddingBottom="$2xl" paddingLeft="$xl">
        {noticeContent}
      </YStack>
    </YStack>
  );
}
