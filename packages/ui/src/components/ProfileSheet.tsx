import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

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
  currentUserIsHost,
  groupIsOpen,
  userIsBanned,
  onPressBan,
  onPressUnban,
  onPressKick,
  onPressGoToDm,
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
  currentUserIsHost?: boolean;
  groupIsOpen?: boolean;
  userIsBanned?: boolean;
  onPressKick?: () => void;
  onPressBan?: () => void;
  onPressUnban?: () => void;
  onPressGoToDm?: () => void;
  onPressAsignRole?: (roleId: string) => void;
  onPressRemoveRole?: (roleId: string) => void;
  roles?: db.GroupRole[];
  selectedUserRoles?: string[];
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

  const isAdminnable = currentUserIsAdmin;

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
    isAdminnable &&
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
                if (currentUserIsHost && roleId === 'admin') {
                  return;
                }
                onPressRemoveRole?.(roleId);
                onOpenChange(false);
              }}
              {...props}
            />
          ),
        },
        currentUserId !== contactId && {
          title: 'Kick User',
          action: () => {
            onPressKick?.();
            onOpenChange(false);
          },
        },
        groupIsOpen && currentUserId !== contactId
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
          <ProfileBlock height={200} contactId={contactId} />
        </ActionSheet.ContentBlock>
        <ActionSheet.SimpleActionGroupList actionGroups={actions} />
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
