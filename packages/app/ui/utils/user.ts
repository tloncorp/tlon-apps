import * as db from '@tloncorp/shared/db';
import * as urbit from '@tloncorp/shared/urbit';
import { p } from '@urbit/aura';

const USER_ID_SEPARATORS = /([_^-])/;

/**
 * Format a user ID for display with proper aria label.
 * @param userId - The user ID to format (e.g., '~sampel-palnet')
 * @param full - Whether to show the full ID or shortened version
 * @returns Object with display string and aria label, or null if invalid
 */
export function formatUserId(
  userId: string,
  full = false
): { display: string; ariaLabel: string } | null {
  const shortenedName = full ? userId : p.cite(userId);
  if (!shortenedName) return null;

  const ariaLabel = urbit
    .desig(shortenedName)
    .split(USER_ID_SEPARATORS)
    .join(' ');

  return {
    display: shortenedName,
    ariaLabel,
  };
}

/**
 * @deprecated Use ContactNameV2 component or useContactName hook instead.
 * This function does not respect Calm mode settings.
 *
 * For components: import { ContactName } from './ContactNameV2'
 * For hooks: import { useContactName } from './ContactNameV2'
 *
 * Example migration:
 * - Before: {getDisplayName(contact)}
 * - After: <ContactName contactId={contact.id} />
 * - Or: const name = useContactName(contact.id)
 */
export function getDisplayName(contact: db.Contact): string {
  if (contact.nickname && contact.nickname.length) {
    return contact.nickname;
  }

  const formatted = formatUserId(contact.id);
  return formatted?.display ?? contact.id;
}
