import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useIsAdmin } from '../utils';
import { ProfileSheet } from './ProfileSheet';

// Match BottomSheetWrapper's `quick` transition (250ms) + small buffer for
// Gorhom to fully unmount the modal portal entry before the React tree is
// torn down by `onDismiss`. See TLON-5891.
const PARENT_CLOSE_ANIMATION_MS = 300;

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

  const handlePressGoToProfile = useCallback(() => {
    if (selectedContact && onPressGoToProfile) {
      onDismiss();
      onPressGoToProfile(selectedContact);
    }
  }, [selectedContact, onPressGoToProfile, onDismiss]);

  // Local "is the parent sheet open" state. Controlling it (rather than
  // hardcoding `open={true}`) lets us trigger Gorhom's dismiss animation on
  // the parent BottomSheetModal before signalling the caller to unmount via
  // `onDismiss`. Without this, the parent's React component would be torn
  // down while its Gorhom queue entry was still at a visible snap point,
  // leaving a visible "orphan" sheet — the same class of bug we just fixed
  // for the nested role picker (TLON-5891).
  const [parentOpen, setParentOpen] = useState(true);

  // Re-arm `parentOpen` when the caller mounts us for a different member.
  // GMPS only renders ProfileSheet when `selectedContact` is non-null, so
  // this effect catches the null → contact transition.
  useEffect(() => {
    if (selectedContact) {
      setParentOpen(true);
    }
  }, [selectedContact]);

  // When the parent sheet has been told to close (either by a user gesture
  // or by a role-action's deferred parent dismiss), wait for the close
  // animation to finish, then signal the caller to unmount us. By this
  // point Gorhom has already removed the parent's portal entry via
  // `enableDismissOnClose`, so the unmount is clean.
  useEffect(() => {
    if (!parentOpen) {
      const timer = setTimeout(onDismiss, PARENT_CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [parentOpen, onDismiss]);

  if (!selectedContact) {
    return null;
  }

  return (
    <ProfileSheet
      open={parentOpen}
      onOpenChange={(open) => {
        if (!open) {
          setParentOpen(false);
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
