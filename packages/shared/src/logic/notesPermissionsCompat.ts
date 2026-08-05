/**
 * Temporary compatibility boundary for the current %notes permission model.
 *
 * %notes does not yet support independent writer roles, so reader roles grant
 * both read and write access. Keep every client workaround behind this helper:
 * when %notes gains writer permissions, searching for this symbol identifies
 * the UI normalization, submission, and backend-poke behavior to remove.
 */
export function notesPermissionsCompatActive(
  channelType: string | null | undefined
): boolean {
  return channelType === 'notes';
}

export const NOTES_PERMISSIONS_COMPAT_NOTICE =
  'Notebook channels do not support separate read and write permissions. Roles that can read a notebook can also edit it.';
