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

/**
 * Params that carry a one-time instruction rather than a position. Almost
 * nothing clears its own params after acting on them, so persisting these
 * would replay the instruction on every launch inside the window: reopening an
 * invite preview that was already dismissed, or reopening the composer and
 * keyboard on a channel entered through a share link.
 */
const ONE_SHOT_PARAM_KEYS = [
  'previewGroupId',
  'previewGroupFromInviteNotification',
  'startDraft',
  'startInEdit',
  'focusTitle',
  'selectedPostId',
  'disableTransition',
];

/**
 * Screens that are a momentary overlay on top of a position rather than a
 * position themselves. Coming back into a full-screen media viewer after a
 * relaunch is disorienting, and its `uri` may since have expired.
 */
const TRANSIENT_ROUTE_NAMES = ['MediaViewer'];

type RouteSnapshot = {
  name?: string;
  params?: Record<string, unknown>;
  state?: StateSnapshot;
};
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

function stripOneShotParams(route: RouteSnapshot): RouteSnapshot {
  const next: RouteSnapshot = { ...route };

  if (next.params) {
    const params = { ...next.params };
    for (const key of ONE_SHOT_PARAM_KEYS) {
      delete params[key];
    }
    next.params = params;
  }

  if (next.state?.routes) {
    next.state = sanitizeState(next.state);
  }

  return next;
}

function sanitizeState(state: StateSnapshot): StateSnapshot {
  const routes = (state.routes ?? []).map(stripOneShotParams);
  // Only trailing overlays are dropped: one buried under later pushes is not
  // what the user is looking at, and removing it would renumber the stack.
  let end = routes.length;
  while (
    end > 1 &&
    TRANSIENT_ROUTE_NAMES.includes(routes[end - 1]?.name ?? '')
  ) {
    end -= 1;
  }
  const trimmed = routes.slice(0, end);
  const index = Math.min(state.index ?? trimmed.length - 1, trimmed.length - 1);
  return { ...state, routes: trimmed, index: Math.max(index, 0) };
}

/**
 * The position worth writing down, with one-time instructions and trailing
 * overlays removed. Returns null when there is nothing worth saving.
 */
export function sanitizeNavigationStateForPersistence(
  state: unknown
): object | null {
  if (!isPersistableNavigationState(state)) {
    return null;
  }
  return sanitizeState(state as StateSnapshot);
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
  currentUserId: string | null,
  maxAgeMs: number = NAVIGATION_STATE_MAX_AGE_MS
): boolean {
  if (saved == null) {
    return false;
  }

  // Logout clears this key, but not before returning, so a force-quit inside
  // that window can leave one account's position for the next one to find.
  // Ids this ship cannot resolve would otherwise be restored as routes.
  if (saved.userId == null || saved.userId !== currentUserId) {
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
