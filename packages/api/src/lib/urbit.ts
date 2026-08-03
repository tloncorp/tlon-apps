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
/**
 * A moon adds 32 bits below its parent, which is at most two more @p words
 * (`dostec-risfen-sampel-palnet` under `sampel-palnet`). A comet is eight
 * words and can end in any planet's name without being its moon.
 */
const MOON_MAX_EXTRA_WORDS = 2;

export function isMoonOf(ship: string, parent: string): boolean {
  const moonName = desig(ship).toLowerCase();
  const parentName = desig(parent).toLowerCase();
  if (!moonName || !parentName || moonName === parentName) {
    return false;
  }
  if (!moonName.endsWith(`-${parentName}`)) {
    return false;
  }
  // The suffix alone isn't proof, and this decides whether a post's author
  // counts as *your* agent — and so whether their A2UI renders as trusted.
  // Check the point class too, by width: anything longer than parent + 2
  // words is a comet that merely ends the same way.
  return wordCount(moonName) <= wordCount(parentName) + MOON_MAX_EXTRA_WORDS;
}

function wordCount(name: string): number {
  return name.split('-').length;
}
