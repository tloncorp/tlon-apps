import * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import React from 'react';

import { useInviteGroupMembers } from '../../hooks/useInviteUsers';
import { ActionSheet } from './ActionSheet';
import { ContactBook } from './ContactBook';
import { InviteFriendsToTlonButton } from './InviteFriendsToTlonButton';

const InviteUsersWidgetComponent = ({
  group,
  onInviteComplete,
  onScrollChange,
}: {
  group: db.Group;
  onInviteComplete: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}) => {
  const { loading, invitees, setInvitees, handleInvite, buttonText } =
    useInviteGroupMembers(group.id, onInviteComplete);

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
          onPress={handleInvite}
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
