import type * as db from '@tloncorp/shared/db';

import {
  MEMBER_ROLE_OPTION,
  groupRolesToOptions,
} from '../../ui/components/ManageChannels/channelFormUtils';
import type { RoleOption } from '../../ui/components/ManageChannels/channelFormUtils';

export const toggleSelectedIds = (
  selectedIds: string[],
  targetId: string
): string[] =>
  selectedIds.includes(targetId)
    ? selectedIds.filter((id) => id !== targetId)
    : [...selectedIds, targetId];

export const ensureSelectedId = (
  selectedIds: string[],
  targetId?: string
): string[] => {
  if (!targetId || selectedIds.includes(targetId)) {
    return selectedIds;
  }

  return [...selectedIds, targetId];
};

export const areAllIdsSelected = (
  allIds: string[],
  selectedIds: string[]
): boolean => allIds.every((id) => selectedIds.includes(id));

export const toggleAllSelectedIds = (
  allIds: string[],
  selectedIds: string[]
): string[] =>
  areAllIdsSelected(allIds, selectedIds)
    ? selectedIds.filter((id) => !allIds.includes(id))
    : Array.from(new Set([...selectedIds, ...allIds]));

export const hasSelectedIdsChanged = (
  initialIds: string[],
  selectedIds: string[]
): boolean => {
  if (initialIds.length !== selectedIds.length) {
    return true;
  }

  const initialIdSet = new Set(initialIds);
  return selectedIds.some((id) => !initialIdSet.has(id));
};

export const getAddedSelectedIds = (
  initialIds: string[],
  selectedIds: string[]
): string[] => selectedIds.filter((id) => !initialIds.includes(id));

export const getRemovedSelectedIds = (
  initialIds: string[],
  selectedIds: string[]
): string[] => initialIds.filter((id) => !selectedIds.includes(id));

export const appendCreatedRole = (
  roles: db.GroupRole[],
  createdRoleId?: string,
  createdRoleTitle?: string
): db.GroupRole[] => {
  if (
    !createdRoleId ||
    !createdRoleTitle ||
    roles.some((role) => role.id === createdRoleId)
  ) {
    return roles;
  }

  return [
    ...roles,
    {
      id: createdRoleId,
      title: createdRoleTitle,
    } as db.GroupRole,
  ];
};

export const getSelectableRoleOptions = (
  groupRoles: db.GroupRole[],
  createdRoleId?: string,
  createdRoleTitle?: string
): RoleOption[] => [
  ...groupRolesToOptions(
    appendCreatedRole(groupRoles, createdRoleId, createdRoleTitle)
  ).filter((role) => role.value !== 'admin'),
  MEMBER_ROLE_OPTION,
];
