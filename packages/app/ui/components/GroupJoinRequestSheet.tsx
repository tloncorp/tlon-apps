import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

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
  onPressGoToProfile,
}: {
  contact?: db.Contact;
  contactId: string;
  currentUserIsAdmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPressAccept: () => void;
  onPressReject: () => void;
  onPressGoToProfile: (contactId: string) => void;
}) {
  const profileActionGroup = useMemo(
    () =>
      createActionGroups([
        'neutral',
        {
          title: contact?.nickname ?? contactId,
          description: `View ${contact?.nickname ?? contactId}'s profile`,
          action: () => {
            onPressGoToProfile?.(contactId);
            onOpenChange(false);
          },
          startIcon: <ListItem.ContactIcon contactId={contactId} />,
          endIcon: 'ChevronRight',
        },
      ]),
    [contact?.nickname, contactId, onPressGoToProfile, onOpenChange]
  );

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
    () => [...profileActionGroup, ...adminActionGroups],
    [profileActionGroup, adminActionGroups]
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
