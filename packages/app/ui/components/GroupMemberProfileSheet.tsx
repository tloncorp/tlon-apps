import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useSheetCloseAfterAnimation } from '../hooks/useSheetCloseAfterAnimation';
import { useIsAdmin } from '../utils';
import { ProfileSheet } from './ProfileSheet';

export function GroupMemberProfileSheet({
  selectedContact,
  onDismiss,
  groupId,
  onPressGoToProfile,
}: {
  selectedContact: string | null;
  onDismiss: () => void;
  groupId: string;
  onPressGoToProfile?: (contactId: string) => void;
}) {
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(groupId, currentUserId);
  const {
    group,
    groupMembers,
    groupRoles,
    bannedUsers,
    kickUser,
    banUser,
    unbanUser,
    revokeInvite,
    addUserToRole,
    removeUserFromRole,
  } = useGroupContext({ groupId });

  const selectedContactData = useMemo(
    () =>
      groupMembers?.find((m) => m.contactId === selectedContact)?.contact ??
      undefined,
    [groupMembers, selectedContact]
  );

  const selectedUserRoles = useMemo(
    () =>
      groupMembers
        ?.find((m) => m.contactId === selectedContact)
        ?.roles?.map((r) => r.roleId),
    [groupMembers, selectedContact]
  );

  // Local "is the parent sheet open" state. Controlling it (rather than
  // hardcoding `open={true}`) lets us trigger Gorhom's dismiss animation on
  // the parent BottomSheetModal before signalling the caller to unmount via
  // `onDismiss`. Without this, the parent's React component would be torn
  // down while its Gorhom queue entry was still at a visible snap point,
  // leaving a visible "orphan" sheet — the same class of bug we just fixed
  // for the nested role picker (TLON-5891).
  const [parentOpen, setParentOpen] = useState(true);
  const { closeAfterAnimation, cancel: cancelDismiss } =
    useSheetCloseAfterAnimation();

  const dismiss = useCallback(
    (afterDismiss?: () => void) => {
      setParentOpen(false);
      closeAfterAnimation(() => {
        onDismiss();
        afterDismiss?.();
      });
    },
    [closeAfterAnimation, onDismiss]
  );

  const handlePressGoToProfile = useCallback(() => {
    if (selectedContact && onPressGoToProfile) {
      dismiss(() => onPressGoToProfile(selectedContact));
    }
  }, [selectedContact, onPressGoToProfile, dismiss]);

  // Re-arm `parentOpen` when the caller mounts us for a different member.
  // GMPS only renders ProfileSheet when `selectedContact` is non-null, so
  // this effect catches the null → contact transition.
  useEffect(() => {
    if (selectedContact) {
      cancelDismiss();
      setParentOpen(true);
    }
  }, [selectedContact, cancelDismiss]);

  if (!selectedContact) {
    return null;
  }

  return (
    <ProfileSheet
      open={parentOpen}
      onOpenChange={(open) => {
        if (!open) {
          dismiss();
        }
      }}
      contactId={selectedContact}
      contact={selectedContactData}
      currentUserIsAdmin={currentUserIsAdmin}
      groupHostId={group?.hostUserId}
      userIsBanned={bannedUsers.some((b) => b.contactId === selectedContact)}
      userIsInvited={groupMembers.some(
        (m) => m.contactId === selectedContact && m.status === 'invited'
      )}
      onPressKick={() => kickUser(selectedContact)}
      onPressBan={() => banUser(selectedContact)}
      onPressUnban={() => unbanUser(selectedContact)}
      onPressRevokeInvite={() => revokeInvite(selectedContact)}
      onPressGoToProfile={
        onPressGoToProfile ? handlePressGoToProfile : undefined
      }
      onPressAsignRole={(roleId: string) =>
        addUserToRole(selectedContact, roleId)
      }
      onPressRemoveRole={(roleId: string) =>
        removeUserFromRole(selectedContact, roleId)
      }
      roles={groupRoles}
      selectedUserRoles={selectedUserRoles}
    />
  );
}
