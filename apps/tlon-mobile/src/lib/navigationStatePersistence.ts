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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a param carries something `JSON.stringify` would silently drop. The
 * one case in the route tree is a callback the pushing screen passes for the
 * pushed one to hand its result back — `SelectRoleMembers` and its `onSave`.
 * Restoring that route would mount it without the callback, and it would throw
 * the moment the user backed out of it.
 */
function hasNonSerializableParams(value: unknown): boolean {
  if (typeof value === 'function' || typeof value === 'symbol') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasNonSerializableParams);
  }
  if (isPlainObject(value)) {
    return Object.values(value).some(hasNonSerializableParams);
  }
  return false;
}

function stripOneShotParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...params };
  for (const key of ONE_SHOT_PARAM_KEYS) {
    delete next[key];
  }
  // `navigate(parent, { screen, params })` records the instruction on the
  // *parent* route, and rehydration merges that inner `params` back into the
  // child — so a one-shot key sitting there is replayed even though the child
  // route's own params were cleaned. Follow the instruction down.
  if (typeof next.screen === 'string' && isPlainObject(next.params)) {
    next.params = stripOneShotParams(next.params);
  }
  return next;
}

function sanitizeRoute(route: RouteSnapshot): RouteSnapshot | null {
  if (route.params && hasNonSerializableParams(route.params)) {
    return null;
  }

  const next: RouteSnapshot = { ...route };

  if (next.params) {
    next.params = stripOneShotParams(next.params);
  }

  if (next.state?.routes) {
    const state = sanitizeState(next.state);
    if (state == null) {
      return null;
    }
    next.state = state;
  }

  return next;
}

function sanitizeState(state: StateSnapshot): StateSnapshot | null {
  const routes: RouteSnapshot[] = [];
  for (const route of state.routes ?? []) {
    const sanitized = sanitizeRoute(route);
    // A route that cannot be restored takes what sits above it with it: the
    // stack below is still a position, but the routes above are only reachable
    // through the one being dropped.
    if (sanitized == null) {
      break;
    }
    routes.push(sanitized);
  }

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
  if (trimmed.length === 0) {
    return null;
  }
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
 * The top-level tab a saved position was focused on, or null when the position
 * is deeper than the tab navigator — anything pushed above `MainTabs` is a
 * position in its own right, not a tab to re-select.
 */
export function getFocusedTopLevelTab(state: unknown): string | null {
  const root = (state as StateSnapshot | undefined)?.routes?.[
    (state as StateSnapshot | undefined)?.index ?? 0
  ];
  if (root?.name !== 'MainTabs') {
    return null;
  }
  const tabs = root.state;
  return tabs?.routes?.[tabs.index ?? 0]?.name ?? null;
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
