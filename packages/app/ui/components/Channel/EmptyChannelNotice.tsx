import * as db from '@tloncorp/shared/db';
import { defaultTemplateChannelTitles } from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { Button, Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { XStack, YStack } from 'tamagui';

import { useChatOptions, useGroup } from '../../contexts';
import { useChatTitle, useIsAdmin } from '../../utils';
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
  const { onPressInvite, onPressGroupMeta, onPressChannelMeta, onPressChatDetails } =
    useChatOptions();
  const group = useGroup(channel.groupId ?? '');
  const isGroupAdmin = useIsAdmin(channel.groupId ?? '', userId);
  const isDefaultPersonalChannel = useMemo(() => {
    return logic.isDefaultPersonalChannel(channel, userId);
  }, [channel, userId]);

  const isSingleChannelGroup = (group?.channels?.length ?? 0) <= 1;
  const title = useChatTitle(channel, group);
  const displayTitle = !title || title === 'Untitled group' ? 'your group' : title;
  const headingTitle = useMemo(() => {
    if (!title || title === 'Untitled group') return 'your group';
    if (!isSingleChannelGroup && group?.title && defaultTemplateChannelTitles.has(title)) {
      return `${group.title}'s ${title}`;
    }
    return title;
  }, [title, isSingleChannelGroup, group?.title]);
  const memberCount = group?.members?.length ?? group?.memberCount ?? 0;
  const roleCount = group?.roles?.length ?? 0;
  const memberText = memberCount === 1 ? '1 Member' : `${memberCount} Members`;
  const roleText = roleCount === 1 ? '1 Role' : `${roleCount} Roles`;

  const subtitle = useMemo(() => {
    const name = displayTitle;
    if (channel.type === 'dm') {
      return `This is the start of your conversation.`;
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
  }, [channel.type, isSingleChannelGroup, group?.privacy, displayTitle]);

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

  return (
    <YStack
      flex={1}
      justifyContent="flex-end"
      paddingHorizontal="$l"
      paddingBottom="$l"
      gap="$m"
    >
      <Text size="$title/l" color="$primaryText">
        Welcome to {headingTitle}!
      </Text>
      <Text size="$label/l" color="$secondaryText">
        {subtitle}
      </Text>
      {isGroupAdmin && (
        <YStack gap="$m" marginTop="$s">
          <Pressable
            flexDirection="row"
            alignItems="center"
            gap="$s"
            onPress={onPressInvite}
          >
            <Icon type="Add" color="$positiveActionText" size="$s" />
            <Text size="$label/l" color="$positiveActionText">
              Invite people
            </Text>
          </Pressable>
          <Pressable
            flexDirection="row"
            alignItems="center"
            gap="$s"
            onPress={isSingleChannelGroup ? () => onPressGroupMeta() : onPressChannelMeta}
          >
            <Icon type="Channel" color="$positiveActionText" size="$s" />
            <Text size="$label/l" color="$positiveActionText">
              {isSingleChannelGroup ? 'Edit group' : 'Edit channel'}
            </Text>
          </Pressable>
          <Pressable
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            backgroundColor="$secondaryBackground"
            borderRadius="$xl"
            paddingHorizontal="$l"
            paddingVertical="$m"
            onPress={() =>
              channel.groupId &&
              onPressChatDetails({ type: 'group', id: channel.groupId })
            }
          >
            <XStack gap="$s" alignItems="center">
              <Icon type="Profile" color="$tertiaryText" size="$s" />
              <Text size="$label/l" color="$primaryText">
                {memberText} · {roleText}
              </Text>
            </XStack>
            <Icon type="ChevronRight" color="$tertiaryText" size="$s" />
          </Pressable>
        </YStack>
      )}
    </YStack>
  );
}
