import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { RoleChip } from './ChannelPermissions';
import {
  MEMBERS_MARKER,
  MEMBER_ROLE_OPTION,
  groupRolesToOptions,
} from './channelFormUtils';

interface RoleChipsDisplayProps {
  groupRoles: db.GroupRole[];
  readers: string[];
  onRemoveRole: (roleId: string) => void;
}

/**
 * Computes the roles to display as chips (excluding admin).
 */
export function useDisplayedRoles(groupRoles: db.GroupRole[], readers: string[]) {
  const allRoles = useMemo(() => groupRolesToOptions(groupRoles), [groupRoles]);

  return useMemo(() => {
    const rolesWithMembers = [MEMBER_ROLE_OPTION, ...allRoles];
    return rolesWithMembers
      .filter((role) => readers.includes(role.value))
      .filter((role) => role.value !== 'admin')
      .map((role) => ({ label: role.label, value: role.value }));
  }, [readers, allRoles]);
}

/**
 * Displays the role chips for channel permissions.
 * Used by both CreateChannelPermissionsScreen and EditChannelPrivacyScreen.
 */
export function RoleChipsDisplay({
  groupRoles,
  readers,
  onRemoveRole,
}: RoleChipsDisplayProps) {
  const displayedRoles = useDisplayedRoles(groupRoles, readers);

  return (
    <>
      <Text size="$label/l">Who can access this channel?</Text>
      <YStack gap="$l">
        <Text size="$label/l">Roles</Text>
        <XStack gap="$s" flexWrap="wrap" width="100%">
          {displayedRoles.map((role) => (
            <RoleChip
              key={role.value}
              role={role}
              onRemove={
                role.value !== 'admin'
                  ? () => onRemoveRole(role.value)
                  : undefined
              }
            />
          ))}
        </XStack>
      </YStack>
    </>
  );
}

interface PermissionActionButtonsProps {
  onSelectRoles: () => void;
  onCreateRole: () => void;
}

/**
 * The "Add roles" and "Create new role" buttons.
 * Used by both CreateChannelPermissionsScreen and EditChannelPrivacyScreen.
 */
export function PermissionActionButtons({
  onSelectRoles,
  onCreateRole,
}: PermissionActionButtonsProps) {
  return (
    <XStack gap="$m">
      <Button preset="positive" onPress={onSelectRoles} label="Add roles" />
      <Button preset="positive" onPress={onCreateRole} label="Create new role" />
    </XStack>
  );
}

/**
 * Hook for removing a role from readers/writers.
 */
export function useHandleRemoveRole(
  setReaders: React.Dispatch<React.SetStateAction<string[]>>,
  setWriters: React.Dispatch<React.SetStateAction<string[]>>
) {
  return useCallback(
    (roleId: string) => {
      if (roleId === 'admin') return;
      setReaders((prev) => prev.filter((r) => r !== roleId));
      if (roleId === MEMBERS_MARKER) {
        setWriters((prev) => prev.filter((w) => w !== roleId));
      }
    },
    [setReaders, setWriters]
  );
}

interface ChannelPermissionStateOptions {
  initialReaders: string[];
  initialWriters: string[];
  createdRoleId?: string;
  selectedRoleIds?: string[];
  /** Called when createdRoleId is processed (e.g., to set isPrivate=true) */
  onCreatedRoleProcessed?: () => void;
}

/**
 * Hook for managing channel permission readers/writers state.
 * Handles createdRoleId and selectedRoleIds from navigation params.
 */
export function useChannelPermissionState({
  initialReaders,
  initialWriters,
  createdRoleId,
  selectedRoleIds,
  onCreatedRoleProcessed,
}: ChannelPermissionStateOptions) {
  const [readers, setReaders] = useState<string[]>(
    selectedRoleIds || initialReaders
  );
  const [writers, setWriters] = useState<string[]>(initialWriters);

  // Handle newly created role being returned from AddRole screen
  useEffect(() => {
    if (createdRoleId && !readers.includes(createdRoleId)) {
      setReaders((prev) => {
        const withAdmin = prev.includes('admin') ? prev : ['admin', ...prev];
        return [...withAdmin, createdRoleId];
      });
      onCreatedRoleProcessed?.();
    }
  }, [createdRoleId, readers, onCreatedRoleProcessed]);

  // Handle selected roles being returned from SelectChannelRoles screen
  useEffect(() => {
    if (selectedRoleIds) {
      setReaders(selectedRoleIds);
    }
  }, [selectedRoleIds]);

  const handleRemoveRole = useHandleRemoveRole(setReaders, setWriters);

  return {
    readers,
    setReaders,
    writers,
    setWriters,
    handleRemoveRole,
  };
}

/**
 * Hook to sync permission state with react-hook-form.
 * Works with any form schema that includes readers/writers fields.
 */
export function usePermissionFormSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (name: string, value: any) => void,
  readers: string[],
  writers: string[],
  isPrivate?: boolean
) {
  useEffect(() => {
    if (isPrivate !== undefined) {
      setValue('isPrivate', isPrivate);
    }
  }, [isPrivate, setValue]);

  useEffect(() => {
    setValue('readers', readers);
  }, [readers, setValue]);

  useEffect(() => {
    setValue('writers', writers);
  }, [writers, setValue]);
}

/**
 * Process readers/writers arrays for submission.
 * If MEMBERS_MARKER is present, returns empty array (everyone has access).
 * Otherwise filters out MEMBERS_MARKER and returns the role IDs.
 */
export function processFinalPermissions(
  readers: string[],
  writers: string[],
  isPrivate = true
): { finalReaders: string[]; finalWriters: string[] } {
  const finalReaders = !isPrivate
    ? []
    : readers.includes(MEMBERS_MARKER)
      ? []
      : readers.filter((r) => r !== MEMBERS_MARKER);

  const finalWriters = !isPrivate
    ? []
    : writers.includes(MEMBERS_MARKER)
      ? []
      : writers.filter((w) => w !== MEMBERS_MARKER);

  return { finalReaders, finalWriters };
}
