import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo } from 'react';

import { useCalm } from '../contexts';
import { Text, View, XStack, YStack } from '../core';
import { getBackgroundColor } from '../utils/colorUtils';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
  pinned: db.Channel[];
  channel?: db.Channel;
  group?: db.Group;
  useGroup: typeof store.useGroup;
  onPressGroupMeta: (group: db.Group) => void;
  onPressGroupMembers: (group: db.Group) => void;
  onPressManageChannels: (group: db.Group) => void;
  onPressInvitesAndPrivacy: (group: db.Group) => void;
  onPressRoles: (group: db.Group) => void;
}

export function ChatOptionsSheet({
  open,
  onOpenChange,
  currentUser,
  pinned,
  channel,
  group,
  useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvitesAndPrivacy,
  onPressRoles,
}: Props) {
  const { data: groupData } = useGroup({
    id: group?.id ?? channel?.groupId ?? '',
  });

  const isPinned = useMemo(
    () =>
      channel
        ? pinned.some((p) => p.id === channel.id)
        : groupData
          ? pinned.some((p) => p.groupId === groupData.id)
          : false,
    [channel, pinned, groupData]
  );

  const currentUserIsAdmin = useMemo(
    () =>
      groupData?.members?.some(
        (m) =>
          m.contactId === currentUser &&
          m.roles?.some((r) => r.roleId === 'admin')
      ) ?? false,
    [currentUser, groupData?.members]
  );

  const adminActions = useMemo(
    () => [
      {
        title: 'Manage Channels',
        action: () => (groupData ? onPressManageChannels(groupData) : {}),
        icon: 'ChevronRight',
      },
      {
        title: 'Invites & Privacy',
        action: () => (groupData ? onPressInvitesAndPrivacy(groupData) : {}),
        icon: 'ChevronRight',
      },
      {
        title: 'Roles',
        action: () => (groupData ? onPressRoles(groupData) : {}),
        icon: 'ChevronRight',
      },
    ],
    [groupData, onPressManageChannels, onPressInvitesAndPrivacy, onPressRoles]
  );

  const actions = useMemo(
    () => [
      { title: 'Copy group reference', action: () => {}, icon: 'ArrowRef' },
      { title: isPinned ? 'Unpin' : 'Pin', action: () => {} },
      {
        title: 'Notifications',
        action: () => {},
        icon: 'ChevronRight',
      },
      {
        title: 'Leave group',
        variant: 'destructive',
        action: () => {},
      },
    ],
    [isPinned]
  );

  if (group && currentUserIsAdmin) {
    // we want to show the admin actions before leave group and notifications
    actions.splice(actions.length - 2, 0, ...adminActions);
  }

  const { disableAvatars } = useCalm();
  const colors = { backgroundColor: '$secondaryBackground' };
  const iconFallbackText = groupData?.title?.[0] ?? groupData?.id[0];
  const iconBackgroundColor = getBackgroundColor({
    disableAvatars,
    colors,
    model: groupData ?? {},
  });
  const iconImageUrl =
    !disableAvatars && groupData?.iconImage ? groupData.iconImage : undefined;
  const memberCount = groupData?.members?.length ?? 0;
  const title = channel?.title ?? groupData?.title ?? 'Loading…';
  const description =
    channel?.description ?? groupData?.description ?? undefined;
  const handleOnPressGroupMeta = useCallback(() => {
    if (groupData) {
      onPressGroupMeta(groupData);
    }
  }, [groupData, onPressGroupMeta]);
  const handleOnPressGroupMembers = useCallback(() => {
    if (groupData) {
      onPressGroupMembers(groupData);
    }
  }, [groupData, onPressGroupMembers]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <View
          backgroundColor="$secondaryBackground"
          borderRadius="$xl"
          paddingVertical="$3xl"
          paddingHorizontal="$4xl"
          alignItems="center"
        >
          <YStack alignItems="center" space="$m">
            <ListItem.Icon
              fallbackText={iconFallbackText}
              backgroundColor={iconBackgroundColor}
              imageUrl={iconImageUrl}
            />

            <Text fontSize="$l">{title}</Text>
            {description && (
              <Text fontSize="$s" color="$tertiaryText">
                {description}
              </Text>
            )}
            <Button backgroundColor="unset" borderWidth="unset">
              <Button.Text
                onPress={handleOnPressGroupMembers}
                fontSize="$s"
                color="$tertiaryText"
              >
                {memberCount} members
              </Button.Text>
            </Button>
          </YStack>
          {currentUserIsAdmin && (
            <View
              position="absolute"
              top="$space.m"
              right="$space.m"
              padding="$m"
            >
              <Button
                onPress={handleOnPressGroupMeta}
                backgroundColor="unset"
                borderWidth="unset"
              >
                <Button.Text fontSize="$l">Edit</Button.Text>
              </Button>
            </View>
          )}
        </View>
      </ActionSheet.Header>
      {actions.map((action, index) => (
        <ActionSheet.Action
          key={index}
          action={action.action}
          destructive={action.variant === 'destructive'}
        >
          <XStack space="$s" alignItems="center" justifyContent="space-between">
            <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
            {action.icon && (
              // @ts-expect-error string type is fine here
              <Icon type={action.icon} size="$l" color="$primaryText" />
            )}
          </XStack>
        </ActionSheet.Action>
      ))}
    </ActionSheet>
  );
}
