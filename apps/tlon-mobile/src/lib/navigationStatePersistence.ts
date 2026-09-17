import type * as db from '@tloncorp/shared/db';

/**
 * How long a saved position is still the one the user means to come back to.
 * The complaint this serves is losing your place when the OS evicts a
 * backgrounded app, which happens within a session; past a day the params in a
 * deep route (a post, a channel) have had time to refer to something that is
 * gone, and landing on the default is friendlier than landing on an empty
 * screen.
 */
export const NAVIGATION_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type RouteSnapshot = { name?: string };
type StateSnapshot = {
  index?: number;
  routes?: ReadonlyArray<RouteSnapshot>;
};

/**
 * The root stack is rooted at `MainTabs` through a normal session, and at
 * `OnboardingStartup` while first-run onboarding owns the root. Only the first
 * is a position worth returning to: saving the second would let a relaunch
 * restore a half-finished onboarding as though it were an ordinary screen.
 */
export function isPersistableNavigationState(state: unknown): boolean {
  const routes = (state as StateSnapshot | undefined)?.routes;
  return Array.isArray(routes) && routes[0]?.name === 'MainTabs';
}

/**
 * Whether a saved state should be handed to the navigator as its initial
 * state. Rejects anything malformed rather than throwing: the value survives
 * app upgrades, so a state written by an older route tree can arrive with a
 * shape this build no longer understands, and the default position is always a
 * safe answer.
 */
export function isRestorableNavigationState(
  saved: db.PersistedNavigationState | null | undefined,
  now: number,
  maxAgeMs: number = NAVIGATION_STATE_MAX_AGE_MS
): boolean {
  if (saved == null) {
    return false;
  }

  const { savedAt, state } = saved;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
    return false;
  }

  // A negative age is a clock that moved backwards, not a fresh state, and
  // would otherwise read as "saved moments ago" forever.
  const age = now - savedAt;
  if (age < 0 || age > maxAgeMs) {
    return false;
  }

  if (!isPersistableNavigationState(state)) {
    return false;
  }

  const { index, routes } = state as StateSnapshot;
  if (!Array.isArray(routes) || routes.length === 0) {
    return false;
  }
  return typeof index === 'number' && index >= 0 && index < routes.length;
}
