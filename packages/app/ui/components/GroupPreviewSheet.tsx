import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { LoadingSpinner } from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner, YStack } from 'tamagui';

import { useStore } from '../contexts';
import { triggerHaptic, useGroupTitle } from '../utils';
import {
  ActionGroup,
  ActionSheet,
  SimpleActionSheetHeader,
  createActionGroup,
  createActionGroups,
} from './ActionSheet';
import { ListItem } from './ListItem';

const logger = createDevLogger('GroupPreviewSheet', true);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: (action: GroupPreviewAction, group: db.Group) => void;
  group?: db.Group;
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

function GroupPreviewSheetComponent({
  open,
  onOpenChange,
  group,
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
        <ActionSheet.Content>
          <GroupPreviewPane group={group} onActionComplete={actionHandler} />
        </ActionSheet.Content>
      ) : (
        <LoadingSpinner />
      )}
    </ActionSheet>
  );
}

export function GroupPreviewPane({
  group,
  onActionComplete,
}: {
  group: db.Group;
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

  const respondToInvite = (accepted: boolean) => {
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
  };

  const requestInvite = () => {
    store.requestGroupInvitation(group);
    onActionComplete('other', group);
  };
  const rescindInvite = () => {
    store.rescindGroupInvitationRequest(group);
    onActionComplete('other', group);
  };
  const joinGroup = () => {
    store.joinGroup(group);
    setIsJoining(true);
  };
  const cancelJoin = () => {
    store.cancelGroupJoin(group);
    setIsJoining(false);
    onActionComplete('other', group);
  };

  const goToGroup = () => {
    onActionComplete('goTo', group);
  };

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

  return (
    <>
      <SimpleActionSheetHeader
        title={title}
        subtitle={group.description ?? undefined}
        icon={<ListItem.GroupIcon model={group} />}
      />
      <YStack>
        <ActionSheet.SimpleActionGroupList
          actionGroups={getActionGroups(status, {
            respondToInvite,
            requestInvite,
            rescindInvite,
            joinGroup,
            goToGroup,
            cancelJoin,
          })}
        />
      </YStack>
    </>
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
): ActionGroup[] {
  if (status.isMember) {
    return createActionGroups([
      'positive',
      {
        title: 'Go to group',
        action: actions.goToGroup,
      },
    ]);
  } else if (status.isJoining) {
    return createActionGroups(
      [
        'disabled',
        {
          title: 'Joining, please wait...',
          disabled: true,
        },
      ],
      [
        'negative',
        {
          title: 'Cancel join',
          action: actions.cancelJoin,
        },
      ]
    );
  } else if (status.isErrored) {
    return createActionGroups([
      'negative',
      {
        title: 'Cancel join',
        description: 'Group joining failed or timed out',
        action: actions.cancelJoin,
      },
    ]);
  } else if (status.hasInvite) {
    return createActionGroups(
      [
        'positive',
        {
          title: 'Accept invite',
          action: () => actions.respondToInvite(true),
        },
      ],
      [
        'negative',
        {
          title: 'Reject invite',
          action: () => actions.respondToInvite(false),
        },
      ]
    );
  } else if (status.needsInvite && !status.hasInvite) {
    if (status.requestedInvite) {
      return createActionGroups(
        ['disabled', { title: 'Invite requested' }],
        [
          'negative',
          {
            title: 'Cancel request',
            action: actions.rescindInvite,
          },
        ]
      );
    } else {
      return [
        createActionGroup('positive', {
          title: 'Request invite',
          action: actions.requestInvite,
        }),
      ];
    }
  } else {
    return createActionGroups([
      'positive',
      {
        title: 'Join group',
        action: actions.joinGroup,
      },
    ]);
  }
}
