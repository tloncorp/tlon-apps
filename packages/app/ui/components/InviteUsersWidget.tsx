import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import React, { useCallback, useMemo, useState } from 'react';

import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { ContactBook } from './ContactBook';
import { InviteFriendsToTlonButton } from './InviteFriendsToTlonButton';

const InviteUsersWidgetComponent = ({
  group,
  onInviteComplete,
}: {
  group: db.Group;
  onInviteComplete: () => void;
}) => {
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleInviteGroupMembers = useCallback(async () => {
    await store.inviteGroupMembers({
      groupId: group.id,
      contactIds: invitees,
    });

    onInviteComplete();
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
        />
      </ActionSheet.ContentBlock>
      <ActionSheet.ContentBlock>
        <Button
          hero
          onPress={handleInviteGroupMembers}
          disabled={invitees.length === 0}
          gap="$xl"
        >
          <Button.Text width="auto">{buttonText}</Button.Text>
        </Button>
      </ActionSheet.ContentBlock>
    </>
  );
};

export const InviteUsersWidget = React.memo(InviteUsersWidgetComponent);
