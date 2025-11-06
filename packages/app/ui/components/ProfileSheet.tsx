import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { useCurrentUserId } from '../contexts/appDataContext';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { ProfileBlock } from './ProfileBlock';

function RoleAssignmentSheet({
  onAssignRole,
  onRemoveRole,
  roles,
  selectedUserRoles,
  ...actionProps
}: {
  onAssignRole: (roleId: string) => void;
  onRemoveRole: (roleId: string) => void;
  roles: db.GroupRole[];
  selectedUserRoles: string[];
} & Parameters<typeof ActionSheet.Action>[0]) {
  const [open, setOpen] = useState(false);

  const handleRoleAction = (role: db.GroupRole) => {
    if (!role.id) {
      console.error('Role ID is required');
      return;
    }
    if (selectedUserRoles.includes(role.id)) {
      onRemoveRole(role.id);
    } else {
      onAssignRole(role.id);
    }
    setOpen(false);
  };

  const roleActions = (
    <ActionSheet.ActionGroup padding={1}>
      {roles.map((role) =>
        !!role.id && !!role.title ? (
          <ActionSheet.Action
            key={role.id}
            action={{
              title: role.title,
              action: () => handleRoleAction(role),
              endIcon: selectedUserRoles.includes(role.id)
                ? 'Checkmark'
                : undefined,
            }}
          />
        ) : null
      )}
    </ActionSheet.ActionGroup>
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={setOpen}
      mode="popover"
      modal
      trigger={
        <ActionSheet.Action
          {...actionProps}
          action={{ title: 'Assign role', action: () => setOpen(true) }}
        />
      }
    >
      {roleActions}
    </ActionSheet>
  );
}

export function ProfileSheet({
  contact,
  contactId,
  onOpenChange,
  open,
  currentUserIsAdmin,
  groupHostId,
  userIsBanned,
  userIsInvited,
  onPressGoToProfile,
  onPressBan,
  onPressUnban,
  onPressKick,
  onPressAsignRole,
  onPressRemoveRole,
  roles,
  selectedUserRoles,
}: {
  contact?: db.Contact;
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserIsAdmin?: boolean;
  groupHostId?: string;
  userIsBanned?: boolean;
  userIsInvited?: boolean;
  onPressKick?: () => void;
  onPressBan?: () => void;
  onPressUnban?: () => void;
  onPressGoToProfile?: () => void;
  onPressAsignRole?: (roleId: string) => void;
  onPressRemoveRole?: (roleId: string) => void;
  roles?: db.GroupRole[];
  selectedUserRoles?: string[];
}) {
  const currentUserId = useCurrentUserId();
  const contactIsHost = groupHostId === contactId;
  const contactIsAdmin = selectedUserRoles?.includes('admin');

  const handleBlock = useCallback(() => {
    if (contact && contact.isBlocked) {
      store.unblockUser(contactId);
    } else {
      store.blockUser(contactId);
    }
    onOpenChange(false);
  }, [contact, contactId, onOpenChange]);

  const handleKickUser = useCallback(() => {
    const displayName = contact?.nickname || contactId;
    const message = `This user will be removed from the group.\n\nWarning: Kicking this user will invalidate all the invitations they've sent.`;
    
    if (isWeb) {
      const confirmed = window.confirm(`Kick ${displayName}?\n\n${message}`);
      if (confirmed) {
        onPressKick?.();
      }
    } else {
      Alert.alert(
        `Kick ${displayName}?`,
        message,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Kick User',
            style: 'destructive',
            onPress: onPressKick,
          },
        ]
      );
    }
    onOpenChange(false);
  }, [contact, contactId, onOpenChange, onPressKick]);

  const isAdminnable = currentUserIsAdmin;

  const actions: ActionGroup[] = createActionGroups(
    isAdminnable &&
      !userIsInvited &&
      roles && [
        'neutral',
        {
          title: 'Assign Role',
          render: (props) => (
            <RoleAssignmentSheet
              roles={roles}
              selectedUserRoles={selectedUserRoles ?? []}
              onAssignRole={(roleId: string) => {
                onPressAsignRole?.(roleId);
                onOpenChange(false);
              }}
              onRemoveRole={(roleId: string) => {
                if (contactIsHost && roleId === 'admin') {
                  return;
                }
                onPressRemoveRole?.(roleId);
                onOpenChange(false);
              }}
              {...props}
            />
          ),
        },
        currentUserId !== contactId &&
          !userIsInvited && {
            title: 'Kick User',
            action: handleKickUser,
          },
        onPressBan &&
        onPressUnban &&
        currentUserId !== contactId &&
        !userIsInvited &&
        !contactIsHost &&
        !contactIsAdmin
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
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock>
          <ProfileBlock
            height={200}
            contactId={contactId}
            onPressGoToProfile={onPressGoToProfile}
          />
        </ActionSheet.ContentBlock>
        <ActionSheet.SimpleActionGroupList actionGroups={actions} />
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
