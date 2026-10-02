import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { isWeb } from 'tamagui';

import { useCurrentUserId } from '../contexts/appDataContext';
import { useSheetDismissalAction } from '../hooks/useSheetDismissalAction';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { ProfileBlock } from './ProfileBlock';

function RoleAssignmentSheet({
  onAssignRole,
  onRemoveRole,
  roles,
  selectedUserRoles,
  contactIsHost,
  closeParent,
  open,
  onOpenChange,
  onNativeDismissed,
  trigger,
}: {
  onAssignRole: (roleId: string) => void;
  onRemoveRole: (roleId: string) => void;
  roles: db.GroupRole[];
  selectedUserRoles: string[];
  contactIsHost: boolean;
  closeParent: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNativeDismissed: () => void;
  trigger?: ReactNode;
}) {
  // Suppresses rapid double-taps between the role tap and the inner sheet's
  // open=false commit. Reset on the false → true edge so the picker is fully
  // usable on the next open (including immediately after a host/admin guard).
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      closingRef.current = false;
    }
  }, [open]);

  const handleRoleAction = (role: db.GroupRole) => {
    if (closingRef.current) {
      return;
    }
    if (!role.id) {
      console.error('Role ID is required');
      return;
    }
    // Host/admin guard: the group host cannot have their `admin` role removed.
    // Tapping it closes the inner picker (acknowledging the tap) but does
    // NOT mutate state and does NOT close the parent profile sheet.
    const isGuardedHostAdmin =
      contactIsHost &&
      role.id === 'admin' &&
      selectedUserRoles.includes(role.id);

    closingRef.current = true;

    if (isGuardedHostAdmin) {
      onOpenChange(false);
      return;
    }

    if (selectedUserRoles.includes(role.id)) {
      onRemoveRole(role.id);
    } else {
      onAssignRole(role.id);
    }
    closeParent();
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
      onOpenChange={onOpenChange}
      onNativeDismissed={onNativeDismissed}
      mode="popover"
      modal
      trigger={trigger}
    >
      {roleActions}
    </ActionSheet>
  );
}

export function ProfileSheet({
  contact,
  contactId,
  onOpenChange,
  onNativeDismissed,
  open,
  currentUserIsAdmin,
  groupHostId,
  userIsBanned,
  userIsInvited,
  onPressGoToProfile,
  onPressBan,
  onPressUnban,
  onPressKick,
  onPressRevokeInvite,
  onPressAsignRole,
  onPressRemoveRole,
  roles,
  selectedUserRoles,
}: {
  contact?: db.Contact;
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNativeDismissed?: () => void;
  currentUserIsAdmin?: boolean;
  groupHostId?: string;
  userIsBanned?: boolean;
  userIsInvited?: boolean;
  onPressKick?: () => void;
  onPressRevokeInvite?: () => void;
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

  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();
  const nativeRoleSheet = Platform.OS !== 'web' && isWindowNarrow;
  const {
    dismissThenRun,
    onDismissed: onRoleDismissed,
    cancel: cancelRoleClose,
    presentationKey,
  } = useSheetDismissalAction({
    open: rolePickerOpen,
    onOpenChange: setRolePickerOpen,
    waitForDismissal: nativeRoleSheet,
  });

  // Stable reference to the latest `onOpenChange` so the deferred close doesn't
  // read a stale closure if the prop identity changes between schedule and fire.
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const requestParentClose = useCallback(() => {
    dismissThenRun(() => onOpenChangeRef.current(false));
  }, [dismissThenRun]);

  useEffect(() => {
    if (!open) {
      cancelRoleClose();
      setRolePickerOpen(false);
    }
  }, [open, cancelRoleClose]);

  useEffect(() => {
    cancelRoleClose();
    setRolePickerOpen(false);
  }, [contactId, cancelRoleClose]);

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
      Alert.alert(`Kick ${displayName}?`, message, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Kick User',
          style: 'destructive',
          onPress: onPressKick,
        },
      ]);
    }
    onOpenChange(false);
  }, [contact, contactId, onOpenChange, onPressKick]);

  const isAdminnable = currentUserIsAdmin;

  const handleRevokeInvite = useCallback(() => {
    onPressRevokeInvite?.();
    onOpenChange(false);
  }, [onPressRevokeInvite, onOpenChange]);

  const roleSheetProps = {
    open: rolePickerOpen,
    onOpenChange: setRolePickerOpen,
    onNativeDismissed: onRoleDismissed,
    roles: roles ?? [],
    selectedUserRoles: selectedUserRoles ?? [],
    contactIsHost,
    closeParent: requestParentClose,
    onAssignRole: (roleId: string) => onPressAsignRole?.(roleId),
    onRemoveRole: (roleId: string) => onPressRemoveRole?.(roleId),
  };

  const actions: ActionGroup[] = createActionGroups(
    isAdminnable &&
      !userIsInvited &&
      roles && [
        'neutral',
        {
          title: 'Assign Role',
          render: (props) => {
            const assignRole = (
              <ActionSheet.Action
                {...props}
                action={{
                  title: 'Assign role',
                  action: () => setRolePickerOpen(true),
                }}
              />
            );
            // The native picker is a sibling sheet mounted below; web anchors
            // its popover to this row.
            return nativeRoleSheet ? (
              assignRole
            ) : (
              <RoleAssignmentSheet
                key={presentationKey}
                {...roleSheetProps}
                trigger={assignRole}
              />
            );
          },
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
    isAdminnable &&
      userIsInvited &&
      onPressRevokeInvite && [
        'neutral',
        {
          title: 'Revoke Invite',
          action: handleRevokeInvite,
        },
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
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      onNativeDismissed={onNativeDismissed}
      modal
    >
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
      {/* Native dismissal must survive an optimistic change to admin controls. */}
      {nativeRoleSheet && (
        <RoleAssignmentSheet
          key={`${contactId}:${presentationKey}`}
          {...roleSheetProps}
        />
      )}
    </ActionSheet>
  );
}
