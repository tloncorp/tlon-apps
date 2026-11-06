import { desig } from '@tloncorp/api/lib/urbit';
import * as db from '@tloncorp/shared/db';
import { p } from '@urbit/aura';

const USER_ID_SEPARATORS = /([_^-])/;

// p.cite shortens moons in ways that lose information: star/galaxy moons get
// rendered as just their parent (impersonating it), and planet moons drop the
// parent-planet prefix. Only shorten comets — everything else shows in full.
function citeShip(userId: string): string | null {
  try {
    if (p.kind(userId) === 'comet') {
      return p.cite(userId);
    }
    return userId;
  } catch {
    return null;
  }
}

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
  const shortenedName = full ? userId : citeShip(userId);
  if (!shortenedName) return null;

  const ariaLabel = desig(shortenedName).split(USER_ID_SEPARATORS).join(' ');

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

/**
 * The point whose sigil is one glyph of this id's: its last syllable, which is
 * always a suffix and so the name of a galaxy, drawn as a single symbol.
 */
export function getSingleGlyphSigilPoint(id: string): string {
  const parts = id.replace(/^~/, '').split('-');
  const last = parts[parts.length - 1] ?? '';
  return `~${last.length > 3 ? last.slice(-3) : last}`;
}
