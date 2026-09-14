/**
 * Which ships a run boots, authenticates, serves and waits on.
 *
 * This predicate has to give the same answer in five places that each drive a
 * different stage — rube's boot loop, Playwright's dev servers, the auth setup
 * project, the readiness poll and the dev harness. They used to hold five
 * copies of it; a ship included by one and not another hangs the run waiting
 * on a port nothing is listening to.
 *
 * `INCLUDE_OPTIONAL_SHIPS` is all-or-nothing: turning it on boots ~bus and
 * ~mug as well and un-skips the specs gated on it. The N-1 desk job wants
 * exactly ~zod, ~ten and the pinned N-1 pier, so `N1_SHIP` names the single
 * optional ship to add instead.
 */
export interface SelectableShip {
  ship: string;
  skipSetup?: boolean;
  optional?: boolean;
}

/** The optional ship named by `N1_SHIP`, if any. */
export const n1ShipName = (): string | undefined => {
  const name = process.env.N1_SHIP?.trim();
  return name ? name : undefined;
};

export function shouldIncludeShip(ship: SelectableShip): boolean {
  if (ship.skipSetup) return false;
  if (!ship.optional) return true;
  return (
    process.env.INCLUDE_OPTIONAL_SHIPS === 'true' || ship.ship === n1ShipName()
  );
}
