import type * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';

import { Text, View } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: db.Group;
  onUpdateInvitation: (group: db.Group, accepted: boolean) => void;
}

export function GroupInvitationSheet({
  open,
  onOpenChange,
  group,
  onUpdateInvitation,
}: Props) {
  const [isJoining, setIsJoining] = useState(false);

  const handleUpdateInvitation = (accepted: boolean) => {
    if (!group) {
      return;
    }

    onUpdateInvitation(group, accepted);
    if (accepted) {
      setIsJoining(true);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <ActionSheet.Title>Wanna join {group?.title}?</ActionSheet.Title>
      </ActionSheet.Header>
      <View gap={isJoining ? '$2xl' : '$l'}>
        <Button
          backgroundColor="$background"
          justifyContent="center"
          paddingVertical="$xl"
          paddingHorizontal="$2xl"
          borderRadius="$l"
          disabled={isJoining}
          onPress={() => handleUpdateInvitation(true)}
        >
          <Button.Text color="$primaryText">
            {isJoining ? 'Joining, please wait...' : 'Accept'}
          </Button.Text>
        </Button>
        {isJoining ? (
          <Text color="$primaryText" textAlign="center">
            You may navigate away while the join operation continues in the
            background.
          </Text>
        ) : (
          <Button
            justifyContent="center"
            paddingVertical="$xl"
            paddingHorizontal="$2xl"
            borderRadius="$l"
            onPress={() => handleUpdateInvitation(false)}
          >
            <Button.Text color="$primaryText">Deny</Button.Text>
          </Button>
        )}
      </View>
    </ActionSheet>
  );
}
