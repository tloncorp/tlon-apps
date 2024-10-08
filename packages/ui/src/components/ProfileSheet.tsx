import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { useCurrentUserId } from '../contexts/appDataContext';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { Button } from './Button';
import { ProfileBlock } from './ProfileBlock';

export function ProfileButton({
  label,
  onPress,
  hero,
  secondary,
}: {
  label: string;
  onPress: () => void;
  hero?: boolean;
  secondary?: boolean;
}) {
  return (
    <Button hero={hero} secondary={secondary} onPress={onPress}>
      <Button.Text>{label}</Button.Text>
    </Button>
  );
}

export function ProfileSheet({
  contact,
  contactId,
  onOpenChange,
  open,
  currentUserIsAdmin,
  groupIsOpen,
  userIsBanned,
  onPressBan,
  onPressUnban,
  onPressKick,
  onPressGoToDm,
}: {
  contact?: db.Contact;
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserIsAdmin?: boolean;
  groupIsOpen?: boolean;
  userIsBanned?: boolean;
  onPressKick?: () => void;
  onPressBan?: () => void;
  onPressUnban?: () => void;
  onPressGoToDm?: () => void;
}) {
  const currentUserId = useCurrentUserId();

  const handleBlock = useCallback(() => {
    if (contact && contact.isBlocked) {
      store.unblockUser(contactId);
    } else {
      store.blockUser(contactId);
    }
    onOpenChange(false);
  }, [contact, contactId, onOpenChange]);

  const isAdminnable = currentUserIsAdmin && currentUserId !== contactId;

  const actions: ActionGroup[] = createActionGroups(
    [
      'neutral',
      {
        title: 'Send message',
        action: () => {
          onPressGoToDm?.();
          onOpenChange(false);
        },
        endIcon: 'ChevronRight',
      },
      {
        title: 'Copy user ID',
        render: (props) => (
          <ActionSheet.CopyAction {...props} copyText={contactId} />
        ),
      },
    ],
    isAdminnable && [
      'neutral',
      {
        title: 'Kick User',
        action: () => {
          onPressKick?.();
          onOpenChange(false);
        },
      },
      groupIsOpen
        ? userIsBanned
          ? {
              title: 'Unban User',
              action: onPressUnban,
            }
          : {
              title: 'Ban User',
              action: onPressBan,
            }
        : null,
    ],
    currentUserId !== contactId && [
      'negative',
      {
        title: contact?.isBlocked ? 'Unblock' : 'Block',
        action: handleBlock,
      },
    ]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock>
          <ProfileBlock contactId={contactId} />
        </ActionSheet.ContentBlock>
        <ActionSheet.SimpleActionGroupList actionGroups={actions} />
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
