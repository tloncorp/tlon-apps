import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { ConnectionStatus } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, LoadingSpinner, Text, useIsWindowNarrow } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { triggerHaptic, useGroupTitle } from '../utils';
import { ActionSheet } from './ActionSheet';
import { Badge, BadgeType } from './Badge';
import { ContactName as ContactNameV2 } from './ContactNameV2';
import { ListItem } from './ListItem';

const logger = createDevLogger('GroupPreviewSheet', true);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: (action: GroupPreviewAction, group: db.Group) => void;
  group?: db.Group;
  hostStatus?: ConnectionStatus | null;
}

interface JoinStatus {
  isMember: boolean;
  isJoining: boolean;
  isErrored: boolean;
  needsInvite: boolean;
  hasInvite: boolean;
  requestedInvite: boolean;
}

export type GroupPreviewAction = 'goTo' | 'joined' | 'other';

type GroupActionButton = {
  title: string;
  accent?:
    | 'hero'
    | 'heroPositive'
    | 'positive'
    | 'negative'
    | 'heroDestructive'
    | 'secondary'
    | 'disabled'
    | 'minimal';
  onPress?: () => void;
  description?: string;
  disabled?: boolean;
  testID?: string;
};

function GroupPreviewSheetComponent({
  open,
  onOpenChange,
  group,
  hostStatus,
  onActionComplete,
}: Props) {
  useEffect(() => {
    if (open) {
      triggerHaptic('sheetOpen');
    }
  }, [open]);

  const actionHandler = useCallback(
    (action: GroupPreviewAction, updatedGroup: db.Group) => {
      // Delay the action complete callback to allow the sheet to close.
      // If we don't do this the app will crash.
      setTimeout(() => {
        onActionComplete?.(action, updatedGroup);
      }, 100);
      onOpenChange(false);
    },
    [onActionComplete, onOpenChange]
  );

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {group ? (
        <GroupPreviewPane
          group={group}
          hostStatus={hostStatus}
          onActionComplete={actionHandler}
        />
      ) : (
        <LoadingSpinner />
      )}
    </ActionSheet>
  );
}

export function GroupPreviewPane({
  group,
  hostStatus,
  onActionComplete,
}: {
  group: db.Group;
  hostStatus?: ConnectionStatus | null;
  onActionComplete: (
    action: GroupPreviewAction,
    updatedGroup: db.Group
  ) => void;
}) {
  const [isJoining, setIsJoining] = useState(group?.joinStatus === 'joining');

  const status: JoinStatus = useMemo(
    () => ({
      isMember: group?.currentUserIsMember ?? false,
      isJoining: group?.joinStatus === 'joining' || isJoining,
      isErrored: group?.joinStatus === 'errored',
      needsInvite: group?.privacy !== 'public',
      hasInvite: group?.haveInvite ?? false,
      requestedInvite: group?.haveRequestedInvite ?? false,
    }),
    [
      group?.currentUserIsMember,
      group?.haveInvite,
      group?.haveRequestedInvite,
      group?.joinStatus,
      group?.privacy,
      isJoining,
    ]
  );

  const respondToInvite = useCallback(
    (accepted: boolean) => {
      if (!group) {
        return;
      }

      if (accepted) {
        setIsJoining(true);
        store.acceptGroupInvitation(group);
      } else {
        store.rejectGroupInvitation(group);
        onActionComplete('other', group);
      }
    },
    [group, onActionComplete]
  );

  const requestInvite = useCallback(() => {
    store.requestGroupInvitation(group);
    onActionComplete('other', group);
  }, [group, onActionComplete]);

  const rescindInvite = useCallback(() => {
    store.rescindGroupInvitationRequest(group);
    onActionComplete('other', group);
  }, [group, onActionComplete]);

  const joinGroup = useCallback(() => {
    store.joinGroup(group);
    setIsJoining(true);
  }, [group]);

  const cancelJoin = useCallback(() => {
    store.cancelGroupJoin(group);
    setIsJoining(false);
    onActionComplete('other', group);
  }, [group, onActionComplete]);

  const goToGroup = useCallback(() => {
    onActionComplete('goTo', group);
  }, [group, onActionComplete]);

  // Dismiss sheet once the group join is complete
  useEffect(() => {
    if (group?.id && isJoining) {
      // In lieu of a reactive update to the `group` prop, poll the database
      const interval = setInterval(async () => {
        const nextGroup = await db.getGroup({ id: group.id });
        // TODO: handle case whare joinStatus === 'errored'
        if (nextGroup?.currentUserIsMember === true) {
          setIsJoining(false);
          store
            .markGroupNew(nextGroup)
            .finally(() => onActionComplete('joined', nextGroup));
          clearInterval(interval);
          logger.trackEvent(
            AnalyticsEvent.GroupJoinComplete,
            logic.getModelAnalytics({ group: nextGroup })
          );
        }
      }, 1_000);

      return () => clearInterval(interval);
    }
  }, [isJoining, group.id, onActionComplete]);

  const title = useGroupTitle(group);

  const truncatedDescription = useMemo(() => {
    if (!group.description) {
      return undefined;
    }

    if (group.description.length <= 256) {
      return group.description;
    }

    return `${group.description.slice(0, 256).trimEnd()}...`;
  }, [group.description]);

  const privacyLabel = useMemo(() => {
    switch (group.privacy) {
      case 'public':
        return 'Public Group';
      case 'private':
        return 'Private Group';
      case 'secret':
        return 'Secret Group';
      default:
        return undefined;
    }
  }, [group.privacy]);

  const actionButtons = useMemo(
    () =>
      getActionGroups(status, {
        respondToInvite,
        requestInvite,
        rescindInvite,
        joinGroup,
        goToGroup,
        cancelJoin,
      }),
    [
      status,
      respondToInvite,
      requestInvite,
      rescindInvite,
      joinGroup,
      goToGroup,
      cancelJoin,
    ]
  );

  const isNarrow = useIsWindowNarrow();

  const hostConnectionStatus = useMemo(() => {
    if (!hostStatus?.complete) {
      switch (hostStatus?.status) {
        case 'setting-up':
          return { label: 'Setting up...', type: 'tertiary' };
        case 'trying-dns':
        case 'trying-sponsor':
          return { label: 'Checking network...', type: 'tertiary' };
        default:
          return { label: 'Checking host status...', type: 'tertiary' };
      }
    } else {
      switch (hostStatus.status) {
        case 'yes':
          return { label: 'Online', type: 'positive' };
        default:
          return { label: 'Offline', type: 'warning' };
      }
    }
  }, [hostStatus]);

  return (
    <ActionSheet.Content>
      <YStack
        paddingHorizontal="$xl"
        paddingTop="$xl"
        gap="$xl"
        paddingBottom={!isNarrow ? '$xl' : null}
      >
        <YStack
          alignItems="center"
          padding="$xl"
          borderRadius="$xl"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$background"
          gap="$xl"
        >
          <ListItem.GroupIcon model={group} size="$9xl" />
          <Text size="$label/3xl" textAlign="center">
            {title ?? 'Untitled group'}
          </Text>
          {group.hostUserId ? (
            <Text size="$label/m" color="$tertiaryText">
              <ContactNameV2 contactId={group.hostUserId} mode="contactId" />
            </Text>
          ) : null}
          <XStack gap="$s" alignItems="center">
            {privacyLabel ? (
              <XStack gap="$s">
                <Badge text={privacyLabel} type="neutral" />
              </XStack>
            ) : null}
            <Badge
              text={hostConnectionStatus.label}
              type={hostConnectionStatus.type as BadgeType}
            />
          </XStack>
        </YStack>

        {truncatedDescription ? (
          <YStack
            padding="$xl"
            borderRadius="$xl"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$background"
            gap="$xl"
          >
            <Text size="$label/m" color="$tertiaryText">
              Description
            </Text>
            <Text size="$body">{truncatedDescription}</Text>
          </YStack>
        ) : null}

        <YStack gap="$m">
          {actionButtons.map((action) => {
            return (
              <YStack key={`${action.accent}-${action.title}`} gap="$xs">
                <Button
                  hero={action.accent === 'hero'}
                  heroPositive={action.accent === 'heroPositive'}
                  positive={action.accent === 'positive'}
                  negative={action.accent === 'negative'}
                  secondary={action.accent === 'secondary'}
                  minimal={action.accent === 'minimal'}
                  disabled={action.disabled}
                  onPress={action.onPress}
                  testID={action.testID ?? `ActionButton-${action.title}`}
                  alignSelf="stretch"
                >
                  <Button.Text>{action.title}</Button.Text>
                </Button>
                {action.description ? (
                  <Text
                    size="$label/m"
                    color="$tertiaryText"
                    textAlign="center"
                  >
                    {action.description}
                  </Text>
                ) : null}
              </YStack>
            );
          })}
        </YStack>
      </YStack>
    </ActionSheet.Content>
  );
}

export const GroupPreviewSheet = React.memo(GroupPreviewSheetComponent);

export function getActionGroups(
  status: JoinStatus,
  actions: {
    respondToInvite: (accepted: boolean) => void;
    requestInvite: () => void;
    rescindInvite: () => void;
    joinGroup: () => void;
    goToGroup: () => void;
    cancelJoin: () => void;
  }
): GroupActionButton[] {
  if (status.isMember) {
    return [
      {
        title: 'Go to group',
        accent: 'heroPositive',
        onPress: actions.goToGroup,
      },
    ];
  }
  if (status.isJoining) {
    return [
      {
        title: 'Joining, please wait...',
        accent: 'minimal',
        disabled: true,
      },
      {
        title: 'Cancel join',
        accent: 'negative',
        onPress: actions.cancelJoin,
      },
    ];
  }
  if (status.isErrored) {
    return [
      {
        title: 'Cancel join',
        accent: 'negative',
        onPress: actions.cancelJoin,
      },
    ];
  }
  if (status.hasInvite) {
    return [
      {
        title: 'Accept invite',
        accent: 'hero',
        onPress: () => actions.respondToInvite(true),
      },
      {
        title: 'Reject invite',
        accent: 'secondary',
        onPress: () => actions.respondToInvite(false),
      },
    ];
  }
  if (status.needsInvite && !status.hasInvite) {
    if (status.requestedInvite) {
      return [
        {
          title: 'Invite requested',
          accent: 'secondary',
          disabled: true,
        },
        {
          title: 'Cancel request',
          accent: 'negative',
          onPress: actions.rescindInvite,
        },
      ];
    }
    return [
      {
        title: 'Request invite',
        accent: 'hero',
        onPress: actions.requestInvite,
      },
    ];
  }
  return [
    {
      title: 'Join group',
      accent: 'heroPositive',
      onPress: actions.joinGroup,
    },
  ];
}
