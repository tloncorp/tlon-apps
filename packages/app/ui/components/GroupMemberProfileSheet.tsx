import { useCallback, useMemo, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useIsAdmin } from '../utils';
import { ProfileSheet } from './ProfileSheet';

export function useGroupMemberProfileSheet() {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const dismiss = useCallback(() => setSelectedContact(null), []);
  return { selectedContact, setSelectedContact, dismiss };
}

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

  if (!selectedContact) {
    return null;
  }

  return (
    <ProfileSheet
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
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
