import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button } from '@tloncorp/ui';
import React, { useCallback, useMemo, useState } from 'react';

import { ActionSheet } from './ActionSheet';
import { ContactBook } from './ContactBook';
import { InviteFriendsToTlonButton } from './InviteFriendsToTlonButton';

const logger = createDevLogger('InviteUsersWidget', false);

const InviteUsersWidgetComponent = ({
  group,
  onInviteComplete,
  onScrollChange,
}: {
  group: db.Group;
  onInviteComplete: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleInviteGroupMembers = useCallback(async () => {
    setLoading(true);
    try {
      await store.inviteGroupMembers({
        groupId: group.id,
        contactIds: invitees,
      });
      setLoading(false);
      onInviteComplete();
    } catch (error) {
      logger.trackError('Error inviting group members', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  }, [invitees, group.id, onInviteComplete]);

  const buttonText = useMemo(() => {
    if (invitees.length === 0) {
      return `Select people to invite`;
    }

    return `Invite ${invitees.length} and continue`;
  }, [invitees]);

  return (
    <>
      <ActionSheet.ContentBlock>
        <InviteFriendsToTlonButton group={group} />
      </ActionSheet.ContentBlock>
      <ActionSheet.ContentBlock flex={1}>
        <ContactBook
          multiSelect
          searchable
          searchPlaceholder="Filter by nickname, @p"
          onSelectedChange={setInvitees}
          onScrollChange={onScrollChange}
        />
      </ActionSheet.ContentBlock>
      <ActionSheet.ContentBlock>
        <Button
          hero
          onPress={handleInviteGroupMembers}
          disabled={invitees.length === 0 || loading}
          gap="$xl"
        >
          <Button.Text width="auto">
            {loading ? 'Inviting...' : buttonText}
          </Button.Text>
        </Button>
      </ActionSheet.ContentBlock>
    </>
  );
};

export const InviteUsersWidget = React.memo(InviteUsersWidgetComponent);
