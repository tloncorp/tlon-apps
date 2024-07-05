import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo } from 'react';

import { Text, View, XStack, YStack } from '../core';
import { ActionSheet } from './ActionSheet';
import { GroupAvatar } from './Avatar';
import { Button } from './Button';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
  pinned: db.Channel[];
  channel?: db.Channel;
  group?: db.Group;
  useGroup: typeof store.useGroup;
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvitesAndPrivacy: (groupId: string) => void;
  onPressRoles: (groupId: string) => void;
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
        action: () => (groupData ? onPressManageChannels(groupData.id) : {}),
        icon: 'ChevronRight',
      },
      // {
      // title: 'Invites & Privacy',
      // action: () => (groupData ? onPressInvitesAndPrivacy(groupData.id) : {}),
      // icon: 'ChevronRight',
      // },
      // {
      // title: 'Roles',
      // action: () => (groupData ? onPressRoles(groupData.id) : {}),
      // icon: 'ChevronRight',
      // },
    ],
    [
      groupData,
      onPressManageChannels,
      // onPressInvitesAndPrivacy,
      // onPressRoles
    ]
  );

  const actions = useMemo(
    () => [
      { title: 'Copy group reference', action: () => {}, icon: 'ArrowRef' },
      { title: isPinned ? 'Unpin' : 'Pin', action: () => {}, icon: 'Pin' },
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

  if (group && currentUserIsAdmin && actions.length === 4) {
    // we want to show the admin actions before leave group and notifications
    actions.splice(actions.length - 2, 0, ...adminActions);
  }

  const memberCount = groupData?.members?.length ?? 0;
  const title = channel?.title ?? groupData?.title ?? 'Loading…';
  const description =
    channel?.description ?? groupData?.description ?? undefined;
  const handleOnPressGroupMeta = useCallback(() => {
    if (groupData) {
      onPressGroupMeta(groupData.id);
    }
  }, [groupData, onPressGroupMeta]);
  const handleOnPressGroupMembers = useCallback(() => {
    if (groupData) {
      onPressGroupMembers(groupData.id);
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
            {groupData && <GroupAvatar model={groupData} />}

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
