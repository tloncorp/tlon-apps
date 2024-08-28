import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useEffect, useState } from 'react';
import { Share } from 'react-native';
import { YStack, isWeb } from 'tamagui';

import { useBranchDomain, useBranchKey } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import { Button } from './Button';
import { ContactBook } from './ContactBook';
import { LoadingSpinner } from './LoadingSpinner';

const InviteUsersWidgetComponent = ({
  group,
  onInviteComplete,
}: {
  group: db.Group;
  onInviteComplete: () => void;
}) => {
  const [invitees, setInvitees] = useState<string[]>([]);
  const branchDomain = useBranchDomain();
  const branchKey = useBranchKey();
  const { status, shareUrl, toggle } = store.useLureLinkStatus({
    flag: group.id,
    branchDomain: branchDomain,
    branchKey: branchKey,
  });
  const { doCopy } = useCopy(shareUrl);

  const handleInviteButtonPress = useCallback(async () => {
    if (invitees.length === 0 && shareUrl && status === 'ready') {
      if (isWeb) {
        if (navigator.share !== undefined) {
          await navigator.share({
            title: `Join ${group.title} on Tlon`,
            url: shareUrl,
          });
          return;
        }

        doCopy();
        return;
      }

      await Share.share({
        message: `Join ${group.title} on Tlon: ${shareUrl}`,
        title: `Join ${group.title} on Tlon`,
      });

      return;
    }

    await store.inviteGroupMembers({
      groupId: group.id,
      contactIds: invitees,
    });

    onInviteComplete();
  }, [
    invitees,
    group.id,
    onInviteComplete,
    shareUrl,
    group.title,
    doCopy,
    status,
  ]);

  useEffect(() => {
    const toggleLink = async () => {
      await toggle({
        title: group.title ?? '',
        description: group.description ?? '',
        cover: group.coverImage ?? '',
        image: group.iconImage ?? '',
      });
    };
    if (status === 'disabled') {
      toggleLink();
    }
  }, [group, branchDomain, branchKey, toggle, status]);

  const handleSkipButtonPress = useCallback(() => {
    onInviteComplete();
  }, [onInviteComplete]);

  console.log('status', status);
  console.log('shareUrl', shareUrl);

  return (
    <YStack flex={1} gap="$2xl">
      <ContactBook
        multiSelect
        searchable
        searchPlaceholder="Filter by nickname, @p"
        onSelectedChange={setInvitees}
      />
      <Button
        hero
        onPress={handleInviteButtonPress}
        disabled={
          invitees.length === 0 &&
          (status !== 'ready' || typeof shareUrl !== 'string')
        }
      >
        {invitees.length === 0 ? (
          <Button.Text>
            Invite friends that aren't on Tlon{' '}
            {status === 'loading' ||
              (typeof shareUrl !== 'string' && <LoadingSpinner />)}
          </Button.Text>
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
