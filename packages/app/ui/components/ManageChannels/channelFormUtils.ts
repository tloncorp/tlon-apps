import * as db from '@tloncorp/shared/db';

/**
 * Form schema for channel privacy settings.
 * Used by EditChannelPrivacyScreenView and CreateChannelSheet.
 */
export interface ChannelPrivacyFormSchema {
  isPrivate: boolean;
  readers: string[];
  writers: string[];
}

export interface RoleOption {
  label: string;
  value: string;
}

export const ADMIN_ROLE_ID = 'admin';

// Special marker for members without explicit roles
// In the backend, an empty readers/writers array means "accessible by all group members"
// We use a special string marker in the UI to represent this "Members" concept
export const MEMBERS_MARKER = '__MEMBERS_MARKER__';

export const MEMBER_ROLE_OPTION: RoleOption = {
  label: 'Members',
  value: MEMBERS_MARKER,
};

export const getDefaultPrivateRoleIds = (): string[] => [
  ADMIN_ROLE_ID,
  MEMBERS_MARKER,
];

export const ensureAdminRole = (roleIds: string[]): string[] =>
  roleIds.includes(ADMIN_ROLE_ID) ? roleIds : [ADMIN_ROLE_ID, ...roleIds];

export const addRoleIdToSelection = (
  roleIds: string[],
  roleId?: string
): string[] => {
  if (!roleId) {
    return roleIds;
  }

  const nextRoleIds = ensureAdminRole(roleIds);
  return nextRoleIds.includes(roleId) ? nextRoleIds : [...nextRoleIds, roleId];
};

/**
 * Converts group roles to option format for selectors.
 */
export const groupRolesToOptions = (groupRoles: db.GroupRole[]): RoleOption[] =>
  groupRoles.map((role) => ({
    label: role.title ?? 'Unknown role',
    value: role.id ?? '',
  }));

/**
 * Maps role IDs to their full option objects.
 */
export const mapRoleIdsToOptions = (
  roleIds: string[],
  allRoles: RoleOption[]
): RoleOption[] =>
  roleIds.map((roleId) => {
    const role = allRoles.find((r) => r.value === roleId);
    return { label: role?.label ?? roleId, value: roleId };
  });

/**
 * Computes default privacy form values from a channel's current state.
 * Handles the conversion between backend format (empty array = all members)
 * and UI format (MEMBERS_MARKER represents all members).
 */
export const getChannelPrivacyDefaults = (
  channel?: db.Channel | null
): ChannelPrivacyFormSchema => {
  const readerRoles = channel?.readerRoles?.map((r) => r.roleId) ?? [];
  const writerRoles = channel?.writerRoles?.map((r) => r.roleId) ?? [];
  const isPrivate = readerRoles.length > 0 || writerRoles.length > 0;

  const readers = isPrivate
    ? readerRoles.length === 0
      ? getDefaultPrivateRoleIds() // Empty readers means Members, but admin is always included
      : ensureAdminRole(readerRoles) // Ensure admin is present
    : [];

  const writers = isPrivate
    ? writerRoles.length === 0
      ? getDefaultPrivateRoleIds() // Empty writers means Members, but admin is always included
      : ensureAdminRole(writerRoles) // Ensure admin is present
    : [];

  return {
    readers,
    writers,
    isPrivate,
  };
};

export const getCreateChannelPrivacyDefaults = (
  selectedRoleIds?: string[]
): ChannelPrivacyFormSchema => ({
  isPrivate: true,
  readers: selectedRoleIds ?? getDefaultPrivateRoleIds(),
  writers: getDefaultPrivateRoleIds(),
});

export const getSelectedRolePermissions = (
  selectedRoleIds: string[],
  currentWriters: string[]
): Pick<ChannelPrivacyFormSchema, 'readers' | 'writers'> => ({
  readers: selectedRoleIds,
  writers: currentWriters.filter((writerId) =>
    selectedRoleIds.includes(writerId)
  ),
});

export const getChannelPrivacyToggleValues = (
  isPrivate: boolean
): ChannelPrivacyFormSchema =>
  isPrivate
    ? {
        isPrivate: true,
        readers: getDefaultPrivateRoleIds(),
        writers: getDefaultPrivateRoleIds(),
      }
    : {
        isPrivate: false,
        readers: [],
        writers: [],
      };

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
      : readers.filter((readerId) => readerId !== MEMBERS_MARKER);

  const finalWriters = !isPrivate
    ? []
    : writers.includes(MEMBERS_MARKER)
      ? []
      : writers.filter((writerId) => writerId !== MEMBERS_MARKER);

  return { finalReaders, finalWriters };
}
