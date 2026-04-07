import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { ActionSheet, createActionGroups } from './ActionSheet';
import { useContactName } from './ContactNameV2';
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
  const contactName = useContactName(contactId);

  const profileActionGroup = useMemo(
    () =>
      createActionGroups([
        'neutral',
        {
          title: contactName,
          description: `View ${contactName}'s profile`,
          action: () => {
            onPressGoToProfile?.(contactId);
            onOpenChange(false);
          },
          startIcon: <ListItem.ContactIcon contactId={contactId} />,
          endIcon: 'ChevronRight',
        },
      ]),
    [contactName, contactId, onPressGoToProfile, onOpenChange]
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

  const subtitle = useMemo(() => {
    if (contact?.nickname) {
      return `From ${contact.nickname} (${contactId})`;
    }
    return `From ${contactId}`;
  }, [contact?.nickname, contactId]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Join request" subtitle={subtitle} />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
