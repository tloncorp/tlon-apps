import { shipToDisplayId } from '@tloncorp/api/lib/urbit';

/**
 * Format a user ID for display. Ship names are never shown as text; a user
 * without a nickname is shown as their ship's number (e.g. '1.624.961.343').
 * @param userId - The user ID to format (e.g., '~sampel-palnet')
 * @returns Object with display string and aria label, or null if invalid
 */
export function formatUserId(
  userId: string
): { display: string; ariaLabel: string } | null {
  const display = shipToDisplayId(userId);
  if (!display) return null;

  return {
    display,
    ariaLabel: display,
  };
}
