import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useState } from 'react';
import { YStack } from 'tamagui';

import { Button } from './Button';
import { ContactBook } from './ContactBook';

const InviteUsersWidgetComponent = ({
  group,
  onInviteComplete,
}: {
  group: db.Group;
  onInviteComplete: () => void;
}) => {
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleInviteButtonPress = useCallback(async () => {
    if (invitees.length === 0) {
      console.log('invite friends outside');
      return;
    }

    await store.inviteGroupMembers({
      groupId: group.id,
      contactIds: invitees,
    });

    onInviteComplete();
  }, [invitees, group.id, onInviteComplete]);

  const handleSkipButtonPress = useCallback(() => {
    onInviteComplete();
  }, [onInviteComplete]);

  return (
    <YStack flex={1} gap="$2xl">
      <ContactBook
        multiSelect
        searchable
        searchPlaceholder="Filter by nickname, @p"
        onSelectedChange={setInvitees}
      />
      <Button hero onPress={handleInviteButtonPress}>
        {invitees.length === 0 ? (
          <Button.Text>Invite friends that aren't on Tlon</Button.Text>
        ) : (
          <Button.Text>Invite {invitees.length} and continue</Button.Text>
        )}
      </Button>
      <Button hero secondary onPress={handleSkipButtonPress}>
        <Button.Text color="$primaryText">Skip</Button.Text>
      </Button>
    </YStack>
  );
};

export const InviteUsersWidget = React.memo(InviteUsersWidgetComponent);
