import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { useNavigation } from '../contexts';
import { useCurrentUserId } from '../contexts/appDataContext';
import { ActionSheet, createActionGroups } from './ActionSheet';
import { ListItem } from './ListItem';

export function GroupJoinRequestSheet({
  contact,
  contactId,
  currentUserIsAdmin,
  onOpenChange,
  open,
  onPressAccept,
  onPressReject,
}: {
  contact?: db.Contact;
  contactId: string;
  currentUserIsAdmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPressAccept: () => void;
  onPressReject: () => void;
}) {
  const currentUserId = useCurrentUserId();

  const { onPressGoToDm, onGoToUserProfile } = useNavigation();

  const profileActionGroup = useMemo(
    () =>
      createActionGroups([
        'neutral',
        {
          title: contact?.nickname ?? contactId,
          description: `View ${contact?.nickname ?? contactId}'s profile`,
          action: () => {
            onGoToUserProfile?.(contactId);
            onOpenChange(false);
          },
          startIcon: <ListItem.ContactIcon contactId={contactId} />,
          endIcon: 'ChevronRight',
        },
      ]),
    [contact?.nickname, contactId, onGoToUserProfile, onOpenChange]
  );

  const userActionGroups = useMemo(() => {
    return createActionGroups([
      'neutral',
      currentUserId !== contactId && {
        title: 'Send message',
        action: () => {
          onPressGoToDm?.([contactId]);
          onOpenChange(false);
        },
        endIcon: 'ChevronRight',
      },
      {
        title: 'Copy ID',
        description: contactId,
        render: (props) => (
          <ActionSheet.CopyAction {...props} copyText={contactId} />
        ),
      },
    ]);
  }, [contactId, currentUserId, onOpenChange, onPressGoToDm]);

  const adminActionGroups = useMemo(
    () =>
      currentUserIsAdmin
        ? createActionGroups(
            [
              'positive',
              {
                title: 'Accept request',
                action: () => {
                  onPressAccept();
                  onOpenChange(false);
                },
              },
            ],
            [
              'negative',
              {
                title: 'Reject request',
                action: () => {
                  onPressReject();
                  onOpenChange(false);
                },
              },
            ]
          )
        : [],
    [currentUserIsAdmin, onOpenChange, onPressAccept, onPressReject]
  );

  const actionGroups = useMemo(
    () => [...profileActionGroup, ...userActionGroups, ...adminActionGroups],
    [profileActionGroup, userActionGroups, adminActionGroups]
  );

  const subtitle = `From ${
    contact?.nickname ? `${contact.nickname} (${contactId})` : contactId
  }`;

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Join request" subtitle={subtitle} />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
