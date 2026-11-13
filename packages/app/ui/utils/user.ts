import {
  COMET_UNVERIFIED_MARKER,
  MOON_SEPARATOR,
  PET_NAME_SIGIL,
} from '@tloncorp/api/lib/petName';
import { shipToDisplayId } from '@tloncorp/api/lib/urbit';

// Screen readers would spell out a pet name's punctuation; read its words.
function spokenDisplayId(display: string): string {
  const unverified = PET_NAME_SIGIL + COMET_UNVERIFIED_MARKER;
  const body = display.startsWith(unverified)
    ? `unverified ${display.slice(unverified.length)}`
    : display.slice(PET_NAME_SIGIL.length);
  return body.split(MOON_SEPARATOR).join(' of ').replace(/[.-]/g, ' ');
}

/**
 * Format a user ID for display. Ship names are never shown as text; a user
 * without a nickname is shown as their pet name (e.g.
 * '@brightly.tireless.butter.dhole').
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
    ariaLabel: spokenDisplayId(display),
  };
}
