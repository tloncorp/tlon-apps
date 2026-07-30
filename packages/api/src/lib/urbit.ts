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

/**
 * Whether `ship` is a moon of `parent`.
 *
 * A moon's name is its parent's name with extra syllable pairs prepended, e.g.
 * `~pinser-botter-sampel-palnet` is a moon of `~sampel-palnet`. Hosted Tlon
 * agents are always moons of the account's node, which is how a client can
 * tell its own agent from any other ship.
 */
export function isMoonOf(ship: string, parent: string): boolean {
  const moonName = desig(ship).toLowerCase();
  const parentName = desig(parent).toLowerCase();
  if (!moonName || !parentName || moonName === parentName) {
    return false;
  }
  return moonName.endsWith(`-${parentName}`);
}
