// Urbit-specific but not application-specific utitilies.
// (Application-specific Urbit utilities should go in the urbit/ api submodule.)
import { PET_NAME_SIGIL, petNameToShip, shipToPetName } from './petName';

export function desig(ship: string): string {
  if (!ship) {
    return '';
  }

  return ship.trim().replace('~', '');
}

export function preSig(ship: string): string {
  if (!ship) {
    return '';
  }

  if (ship.trim().startsWith('~')) {
    return ship.trim();
  }

  return '~'.concat(ship.trim());
}

// What the UI shows for a ship whose owner has no nickname: its pet name
// (~sampel-palnet -> @brightly.tireless.butter.dhole). Moons show a short tag
// before their parent's name, comets their short form marked unverified; see
// petName.ts. Ship names are wire identifiers and never appear as
// user-readable text.
export function shipToDisplayId(ship: string): string | null {
  return ship
    ? shipToPetName(preSig(ship), { moon: 'tag', comet: 'short' })
    : null;
}

// A ship's pet name in its reversible form, with a moon's and a comet's names
// in full: what to copy or share, so that pasting it into search finds the
// ship again, and what a profile shows for a comet.
export function shipToFullDisplayId(ship: string): string | null {
  return ship ? shipToPetName(preSig(ship)) : null;
}

const DISPLAY_ID_PREFIX = /^@\??/;

// Whether a ship's pet name starts with typed search text, with or without the
// @ (and a comet's unverified mark), in any case. Pet names are derived from
// the ship, so a search matches them here rather than in SQL.
export function displayIdStartsWith(ship: string, text: string): boolean {
  const typed = text.trim().toLowerCase().replace(DISPLAY_ID_PREFIX, '');
  return (
    typed.length > 0 &&
    !!shipToDisplayId(ship)?.replace(DISPLAY_ID_PREFIX, '').startsWith(typed)
  );
}

// Inverse of shipToDisplayId for search input, with or without the leading @
// and in any case. Moon tags and short comet names are lossy and match no
// ship.
export function displayIdToShip(text: string): string | null {
  const name = text.trim().toLowerCase();
  if (!name) {
    return null;
  }
  return petNameToShip(
    name.startsWith(PET_NAME_SIGIL) ? name : PET_NAME_SIGIL + name
  );
}
