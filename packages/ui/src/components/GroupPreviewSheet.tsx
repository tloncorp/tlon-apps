import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { View } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { PrimaryButton } from './Buttons';
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

export function GroupPreviewSheet({
  open,
  onOpenChange,
  group,
  onActionComplete,
}: Props) {
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
      <ActionSheet.Header>
        <View
          alignItems="center"
          gap="$l"
          backgroundColor="$secondaryBackground"
          borderRadius="$xl"
          padding="$3xl"
        >
          <ListItem.Icon
            fallbackText={group?.title?.[0]}
            backgroundColor={group?.iconImageColor ?? undefined}
            imageUrl={group?.iconImage ?? undefined}
          />
          <ActionSheet.Title>{group?.title}</ActionSheet.Title>
          {group?.description ? (
            <ActionSheet.Description fontSize="$s" textAlign="center">
              {group.description}
            </ActionSheet.Description>
          ) : null}
        </View>
      </ActionSheet.Header>
      <View marginTop="$m" gap={isJoining ? '$2xl' : '$l'}>
        <GroupActions
          status={status}
          actions={{
            respondToInvite,
            requestInvite,
            rescindInvite,
            joinGroup,
            goToGroup,
          }}
          loading={isJoining}
        />
      </View>
    </>
  );
}

export function GroupActions({
  status,
  actions,
  loading,
}: {
  status: JoinStatus;
  actions: {
    respondToInvite: (accepted: boolean) => void;
    requestInvite: () => void;
    rescindInvite: () => void;
    joinGroup: () => void;
    goToGroup: () => void;
  };
  loading: boolean;
}) {
  if (status.isMember) {
    return (
      <PrimaryButton onPress={() => actions.goToGroup()}>
        <Button.Text>Go to Group</Button.Text>
      </PrimaryButton>
    );
  }

  if (status.isJoining) {
    return (
      <>
        <PrimaryButton disabled={true} loading={true}>
          <Button.Text>Joining, please wait</Button.Text>
        </PrimaryButton>
      </>
    );
  }

  if (status.hasInvite) {
    return (
      <>
        <PrimaryButton onPress={() => actions.respondToInvite(true)}>
          <Button.Text>Accept invite</Button.Text>
        </PrimaryButton>
        <Button secondary onPress={() => actions.respondToInvite(false)}>
          <Button.Text>Reject invite</Button.Text>
        </Button>
      </>
    );
  }

  if (status.needsInvite && !status.hasInvite) {
    return (
      <>
        <PrimaryButton
          disabled={status.requestedInvite}
          onPress={actions.requestInvite}
        >
          <Button.Text>
            {status.requestedInvite ? 'Requested' : 'Request an invite'}
          </Button.Text>
        </PrimaryButton>
        {status.requestedInvite && (
          <Button secondary onPress={actions.rescindInvite}>
            <Button.Text>Cancel request</Button.Text>
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <PrimaryButton onPress={actions.joinGroup}>
        <Button.Text>Join</Button.Text>
      </PrimaryButton>
    </>
  );
}
