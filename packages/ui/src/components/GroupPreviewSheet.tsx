import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { triggerHaptic } from '../utils';
import {
  ActionGroup,
  ActionSheet,
  SimpleActionSheetHeader,
  createActionGroup,
  createActionGroups,
} from './ActionSheet';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: (action: GroupPreviewAction, group: db.Group) => void;
  group?: db.Group;
}

interface JoinStatus {
  isMember: boolean;
  isJoining: boolean;
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
      onActionComplete?.(action, updatedGroup);
      onOpenChange(false);
    },
    [onActionComplete, onOpenChange]
  );

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {group ? (
        <GroupPreviewPane group={group} onActionComplete={actionHandler} />
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
        }
      }, 1_000);

      return () => clearInterval(interval);
    }
  }, [isJoining, group.id, onActionComplete]);

  return (
    <>
      <SimpleActionSheetHeader
        title={group?.title ?? group?.id}
        subtitle={group.description ?? undefined}
        icon={<ListItem.GroupIcon model={group} />}
      />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList
          actionGroups={getActionGroups(status, {
            respondToInvite,
            requestInvite,
            rescindInvite,
            joinGroup,
            goToGroup,
          })}
        />
      </ActionSheet.Content>
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
    return createActionGroups([
      'disabled',
      {
        title: 'Joining, please wait...',
        disabled: true,
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
