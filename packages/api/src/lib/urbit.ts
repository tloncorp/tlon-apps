// Urbit-specific but not application-specific utitilies.
// (Application-specific Urbit utilities should go in the urbit/ api submodule.)
import { render, tryParse } from '@urbit/aura';

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

// What the UI shows for a ship whose owner has no nickname: the ship's number
// in dotted @ud form (~sampel-palnet -> 1.624.961.343). Ship names are wire
// identifiers and never appear as user-readable text.
export function shipToDisplayId(ship: string): string | null {
  const n = ship ? tryParse('p', preSig(ship)) : null;
  return n === null ? null : render('ud', n);
}

const DISPLAY_ID_REGEX = /^(\d{1,3}(\.\d{3})+|\d+)$/;
const MAX_SHIP = 2n ** 128n;

// Inverse of shipToDisplayId for search input; also accepts undotted digits.
export function displayIdToShip(text: string): string | null {
  const trimmed = text.trim();
  if (!DISPLAY_ID_REGEX.test(trimmed)) {
    return null;
  }
  const n = BigInt(trimmed.replace(/\./g, ''));
  return n < MAX_SHIP ? render('p', n) : null;
}
