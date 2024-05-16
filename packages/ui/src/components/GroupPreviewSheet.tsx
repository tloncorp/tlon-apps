import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { createDevLogger } from 'packages/shared/dist';
import { useEffect, useMemo, useState } from 'react';

import { View } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';

const logger = createDevLogger('GroupsPreview', true);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: db.Group;
  onUpdateInvitation: (group: db.Group, accepted: boolean) => void;
}

interface JoinStatus {
  isMember: boolean;
  isJoining: boolean;
  needsInvite: boolean;
  hasInvite: boolean;
  requestedInvite: boolean;
}

export function GroupInvitationSheet({
  open,
  onOpenChange,
  group,
  onUpdateInvitation,
}: Props) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {group ? (
        <GroupPreviewPane
          group={group}
          onActionComplete={() => onOpenChange(false)}
        />
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
  onActionComplete: () => void;
}) {
  const [isJoining, setIsJoining] = useState(group?.joinStatus === 'joining');

  const status: JoinStatus = useMemo(
    () => ({
      isMember: group?.currentUserIsMember ?? false,
      isJoining: group?.joinStatus === 'joining',
      needsInvite: group?.privacy !== 'public',
      hasInvite: group?.haveInvite ?? false,
      requestedInvite: group?.haveRequestedInvite ?? false,
    }),
    [group]
  );

  logger.log(`pane for ${group.id}`, status, group);

  const respondToInvite = (accepted: boolean) => {
    if (!group) {
      return;
    }

    if (accepted) {
      setIsJoining(true);
      store.acceptGroupInvitation(group);
    } else {
      store.rejectGroupInvitation(group);
      onActionComplete();
    }
  };

  const requestInvite = () => {
    store.requestGroupInvitation(group);
  };
  const rescindInvite = () => {
    store.rescindGroupInvitationRequest(group);
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
          onActionComplete();
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
            <ActionSheet.Description textAlign="center">
              {group.description}
            </ActionSheet.Description>
          ) : null}
        </View>
      </ActionSheet.Header>
      <View gap={isJoining ? '$2xl' : '$l'}>
        <GroupActions
          status={status}
          actions={{ respondToInvite, requestInvite, rescindInvite }}
        />
      </View>
    </>
  );
}

export function GroupActions({
  status,
  actions,
}: {
  status: JoinStatus;
  actions: {
    respondToInvite: (accepted: boolean) => void;
    requestInvite: () => void;
    rescindInvite: () => void;
  };
}) {
  if (status.isMember) {
    return (
      <Button hero>
        <Button.Text>Go to Group</Button.Text>
      </Button>
    );
  }

  if (status.isJoining) {
    return (
      <>
        <Button hero disabled={true}>
          <Button.Text>Joining, please wait...</Button.Text>
        </Button>
      </>
    );
  }

  if (status.hasInvite) {
    return (
      <>
        <Button hero onPress={() => actions.respondToInvite(true)}>
          <Button.Text>Accept invite</Button.Text>
        </Button>
        <Button onPress={() => actions.respondToInvite(false)}>
          <Button.Text>Reject invite</Button.Text>
        </Button>
      </>
    );
  }

  if (status.needsInvite && !status.hasInvite) {
    return (
      <>
        <Button
          hero
          disabled={status.requestedInvite}
          onPress={() => actions.requestInvite()}
        >
          <Button.Text>
            {status.requestedInvite ? 'Requested' : 'Request an invite'}
          </Button.Text>
        </Button>
        {status.requestedInvite && (
          <Button onPress={() => actions.rescindInvite()}>
            <Button.Text>Cancel request</Button.Text>
          </Button>
        )}
      </>
    );
  }
}
