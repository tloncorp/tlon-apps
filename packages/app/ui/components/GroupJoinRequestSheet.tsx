import { useMemo } from 'react';

import { ActionSheet, createActionGroups } from './ActionSheet';
import { useContactName } from './ContactNameV2';
import { ListItem } from './ListItem';
import { formatUserId } from '../utils/user';

export function GroupJoinRequestSheet({
  contactId,
  currentUserIsAdmin,
  onOpenChange,
  open,
  onPressAccept,
  onPressReject,
  onPressGoToProfile,
}: {
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

  const displayId = formatUserId(contactId)?.display;
  const subtitle =
    displayId && contactName !== displayId
      ? `From ${contactName} (${displayId})`
      : `From ${contactName}`;

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Join request" subtitle={subtitle} />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
