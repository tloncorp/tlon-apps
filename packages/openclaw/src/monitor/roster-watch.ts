/**
 * Bot-roster change detection.
 *
 * The bot fleet (accounts/agents/bindings) is generated from the steward
 * roster at boot, so a roster change can only take effect via a gateway
 * restart. The default account's monitor watches /v1/roster and decides
 * when a fact actually changes the running fleet.
 */

/** JSON shape of steward-roster-update-1 facts over the HTTP channel. */
export type RosterFact = {
  init?: Record<string, unknown>;
  minted?: { ship?: string };
  configured?: { ship?: string };
  retired?: { ship?: string };
};

/**
 * Returns a human-readable reason when a roster fact requires a gateway
 * restart to apply, or null when the running fleet already reflects it.
 * `configuredMoons` is the set of normalized moon @p currently running
 * (the default account's moon + every generated fleet account's moon).
 *
 * %init (the subscription snapshot) and %configured (profile/config
 * tweaks picked up per-turn) never restart; a %minted bot we don't run
 * or a %retired bot we still run does.
 */
export function rosterChangeRequiresRestart(
  fact: RosterFact,
  configuredMoons: ReadonlySet<string>,
  normalize: (ship: string) => string
): string | null {
  const minted = fact?.minted?.ship;
  if (typeof minted === 'string' && !configuredMoons.has(normalize(minted))) {
    return `minted ${minted}`;
  }
  const retired = fact?.retired?.ship;
  if (typeof retired === 'string' && configuredMoons.has(normalize(retired))) {
    return `retired ${retired}`;
  }
  return null;
}
