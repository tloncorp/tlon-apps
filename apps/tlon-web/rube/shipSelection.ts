/**
 * Which ships a run boots, authenticates, serves and waits on.
 *
 * This predicate has to give the same answer in five places that each drive a
 * different stage — rube's boot loop, Playwright's dev servers, the auth setup
 * project, the readiness poll and the dev harness. They used to hold five
 * copies of it; a ship included by one and not another hangs the run waiting
 * on a port nothing is listening to.
 *
 * Two switches, and they do not overlap:
 *
 * - `optional` ships (~bus, ~mug) come in together under
 *   `INCLUDE_OPTIONAL_SHIPS=true`, as they always have.
 * - an `n1` ship (~bud) is selected *only* by naming it in `N1_SHIP`. It is
 *   deliberately excluded from `INCLUDE_OPTIONAL_SHIPS`: that flag is what the
 *   archive preparation run and the parallel Docker image use, and neither has
 *   the N-1 pier — rube/Dockerfile bakes in zod/bus/ten/mug only, so selecting
 *   ~bud there would look for a pier that is not in the image.
 */
export interface SelectableShip {
  ship: string;
  skipSetup?: boolean;
  optional?: boolean;
  n1?: boolean;
}

/** The ship named by `N1_SHIP`, if any. */
export const n1ShipName = (): string | undefined => {
  const name = process.env.N1_SHIP?.trim();
  return name ? name : undefined;
};

export function shouldIncludeShip(ship: SelectableShip): boolean {
  if (ship.skipSetup) return false;
  if (ship.n1) return ship.ship === n1ShipName();
  if (!ship.optional) return true;
  return process.env.INCLUDE_OPTIONAL_SHIPS === 'true';
}
