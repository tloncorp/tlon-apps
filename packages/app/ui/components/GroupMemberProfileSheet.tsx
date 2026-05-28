import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useGroupContext } from '../../hooks/useGroupContext';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useIsAdmin } from '../utils';
import { ProfileSheet } from './ProfileSheet';

// Match BottomSheetWrapper's `quick` transition (250ms) + small buffer for
// Gorhom to fully unmount the modal portal entry before the React tree is
// torn down by `onDismiss`. See TLON-5891.
const PARENT_CLOSE_ANIMATION_MS = Platform.OS === 'web' ? 0 : 300;

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
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(
    (afterDismiss?: () => void) => {
      setParentOpen(false);
      clearDismissTimer();

      const finishDismiss = () => {
        dismissTimerRef.current = null;
        onDismiss();
        afterDismiss?.();
      };

      if (PARENT_CLOSE_ANIMATION_MS === 0) {
        finishDismiss();
        return;
      }

      dismissTimerRef.current = setTimeout(
        finishDismiss,
        PARENT_CLOSE_ANIMATION_MS
      );
    },
    [clearDismissTimer, onDismiss]
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
      clearDismissTimer();
      setParentOpen(true);
    }
  }, [selectedContact, clearDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

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
