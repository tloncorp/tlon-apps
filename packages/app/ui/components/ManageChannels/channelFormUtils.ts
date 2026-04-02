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

// Special marker for members without explicit roles
// In the backend, an empty readers/writers array means "accessible by all group members"
// We use a special string marker in the UI to represent this "Members" concept
export const MEMBERS_MARKER = '__MEMBERS_MARKER__';

export const MEMBER_ROLE_OPTION: RoleOption = {
  label: 'Members',
  value: MEMBERS_MARKER,
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
      ? ['admin', MEMBERS_MARKER] // Empty readers means Members, but admin is always included
      : readerRoles.includes('admin')
        ? readerRoles
        : ['admin', ...readerRoles] // Ensure admin is present
    : [];

  const writers = isPrivate
    ? writerRoles.length === 0
      ? ['admin', MEMBERS_MARKER] // Empty writers means Members, but admin is always included
      : writerRoles.includes('admin')
        ? writerRoles
        : ['admin', ...writerRoles] // Ensure admin is present
    : [];

  return {
    readers,
    writers,
    isPrivate,
  };
};
