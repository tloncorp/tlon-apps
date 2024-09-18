import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share } from 'react-native';
import { isWeb } from 'tamagui';

import { useBranchDomain, useBranchKey, useCurrentUserId } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import { ActionSheet } from './ActionSheet';
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
  const currentUser = useCurrentUserId();
  const branchDomain = useBranchDomain();
  const branchKey = useBranchKey();
  const { status, shareUrl, toggle } = store.useLureLinkStatus({
    flag: group.id,
    branchDomain: branchDomain,
    branchKey: branchKey,
  });
  const { doCopy } = useCopy(shareUrl || '');
  const currentUserIsAdmin = useMemo(
    () =>
      group?.members?.some(
        (m) =>
          m.contactId === currentUser &&
          m.roles?.some((r) => r.roleId === 'admin')
      ) ?? false,
    [currentUser, group?.members]
  );

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
    if (status === 'disabled' && currentUserIsAdmin) {
      toggleLink();
    }
  }, [group, branchDomain, branchKey, toggle, status, currentUserIsAdmin]);

  const handleSkipButtonPress = useCallback(() => {
    onInviteComplete();
  }, [onInviteComplete]);

  const buttonText = useMemo(() => {
    if (invitees.length === 0 && status === 'ready') {
      return `Invite friends that aren't on Tlon`;
    }

    if (invitees.length === 0) {
      return `Invite`;
    }

    return `Invite ${invitees.length} and continue`;
  }, [invitees, status]);

  return (
    <>
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
          onPress={handleInviteButtonPress}
          disabled={
            invitees.length === 0 &&
            (status !== 'ready' || typeof shareUrl !== 'string')
          }
        >
          <Button.Text>{buttonText}</Button.Text>
        </Button>
        {/* <Button hero secondary onPress={handleSkipButtonPress}>
          <Button.Text color="$primaryText">Skip</Button.Text>
        </Button> */}
      </ActionSheet.ContentBlock>
    </>
  );
};

export const InviteUsersWidget = React.memo(InviteUsersWidgetComponent);
