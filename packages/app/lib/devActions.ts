// Tiny pluggable registry for dev-only actions surfaced from the
// AppInfoScreen. The implementation often lives in a platform package
// (e.g. apps/tlon-mobile for the bg-task trigger) which can't be
// imported by packages/app, so we let it register itself on startup
// and AppInfoScreen reads via the getter below.
//
// Only mounted under `__DEV__`. Production builds shouldn't see this.

type DevAction = () => void | Promise<void>;

const handlers: Record<string, DevAction> = {};

export function registerDevAction(name: string, fn: DevAction) {
  handlers[name] = fn;
}

export function getDevAction(name: string): DevAction | undefined {
  return handlers[name];
}

export const DEV_ACTION_RUN_BACKGROUND_SYNC = 'runBackgroundSync';
