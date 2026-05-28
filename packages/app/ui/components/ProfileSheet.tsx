import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { useCurrentUserId } from '../contexts/appDataContext';
import { useSheetCloseAfterAnimation } from '../hooks/useSheetCloseAfterAnimation';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { ProfileBlock } from './ProfileBlock';

function RoleAssignmentSheet({
  onAssignRole,
  onRemoveRole,
  roles,
  selectedUserRoles,
  contactIsHost,
  closeParent,
  cancelParentClose,
  ...actionProps
}: {
  onAssignRole: (roleId: string) => void;
  onRemoveRole: (roleId: string) => void;
  roles: db.GroupRole[];
  selectedUserRoles: string[];
  contactIsHost: boolean;
  closeParent: () => void;
  cancelParentClose: () => void;
} & Parameters<typeof ActionSheet.Action>[0]) {
  const [open, setOpen] = useState(false);
  // Suppresses rapid double-taps between the role tap and the inner sheet's
  // open=false commit. Reset on the false → true edge so the picker is fully
  // usable on the next open (including immediately after a host/admin guard).
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      closingRef.current = false;
      cancelParentClose();
    }
  }, [open, cancelParentClose]);

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
      setOpen(false);
      return;
    }

    if (selectedUserRoles.includes(role.id)) {
      onRemoveRole(role.id);
    } else {
      onAssignRole(role.id);
    }
    setOpen(false);
    // Owned by ProfileSheet (not here), so an optimistic role mutation that
    // unmounts the admin action group — and `RoleAssignmentSheet` with it —
    // doesn't cancel the pending parent close. See TLON-5891 follow-up.
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
      onOpenChange={setOpen}
      mode="popover"
      modal
      // Nested inside the parent ProfileSheet's BottomSheetModal. Use `push` so
      // Gorhom does not minimize the parent on present (TLON-5891).
      stackBehavior="push"
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

  // Owns the deferred parent-close used by `RoleAssignmentSheet`'s role-action
  // flow. Owned here (not in `RoleAssignmentSheet`) because the role action
  // that schedules the close can also unmount the admin action group as a side
  // effect — e.g. a non-host admin self-demoting via the checked `admin` role
  // flips `currentUserIsAdmin` to false, which drops the admin action group and
  // unmounts `RoleAssignmentSheet`. Owning it at this level keeps the pending
  // close alive across that subtree churn.
  const { closeAfterAnimation, cancel: clearParentCloseTimer } =
    useSheetCloseAfterAnimation();

  // Stable reference to the latest `onOpenChange` so the deferred close doesn't
  // read a stale closure if the prop identity changes between schedule and fire.
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const requestParentClose = useCallback(() => {
    closeAfterAnimation(() => onOpenChangeRef.current(false));
  }, [closeAfterAnimation]);

  // Cancel any pending parent-close when another close path takes over, when
  // the contact changes, or when ProfileSheet unmounts entirely. The hook
  // already cancels on unmount; this also covers the `!open` and contactId
  // transitions, which the hook does not.
  useEffect(() => {
    if (!open) {
      clearParentCloseTimer();
    }
  }, [open, clearParentCloseTimer]);

  useEffect(
    () => () => clearParentCloseTimer(),
    [contactId, clearParentCloseTimer]
  );

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
              contactIsHost={contactIsHost}
              closeParent={requestParentClose}
              cancelParentClose={clearParentCloseTimer}
              onAssignRole={(roleId: string) => {
                onPressAsignRole?.(roleId);
              }}
              onRemoveRole={(roleId: string) => {
                onPressRemoveRole?.(roleId);
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
    <ActionSheet open={open} onOpenChange={onOpenChange} modal>
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
