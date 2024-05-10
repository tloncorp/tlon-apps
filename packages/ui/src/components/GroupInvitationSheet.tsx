import type * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';

import { Text, View } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { ListItem } from './ListItem';

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
            <ActionSheet.Description>
              {group.description}
            </ActionSheet.Description>
          ) : null}
        </View>
      </ActionSheet.Header>
      <View gap={isJoining ? '$2xl' : '$l'}>
        <Button
          backgroundColor="$black"
          justifyContent="center"
          paddingVertical="$xl"
          paddingHorizontal="$2xl"
          borderRadius="$l"
          disabled={isJoining}
          onPress={() => handleUpdateInvitation(true)}
        >
          <Button.Text color="$white">
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