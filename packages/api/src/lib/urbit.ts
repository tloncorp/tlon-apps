// Urbit-specific but not application-specific utitilies.
// (Application-specific Urbit utilities should go in the urbit/ api submodule.)

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
