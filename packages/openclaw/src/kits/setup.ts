/**
 * Kit setup conversation: when a group's install config shows
 * `setup: "pending"`, dispatch an active agent turn carrying the kit's
 * `install.setup`-triggered instruction into the primary place's session,
 * then poke `relay-setup-done` so the owner's ledger flips to `"done"`.
 *
 * The turn must be ACTIVE (wake the session, run the agent, deliver the
 * reply to the channel now): system events are passive — they ride along
 * with the session's next turn — and a freshly installed kit's group has no
 * traffic yet, so a passive event would never fire.
 *
 * v1 semantics are fire-once: a sharedMap keyed by group+installId guards
 * against double-fire inside this process (the `relay-setup-done` poke closes
 * the loop durably on the owner's ship). Setup only fires when the bot's ship
 * is listed in the config's `agents`.
 */
import type { Kit } from '@tloncorp/api';

import { sharedMap } from '../shared-state.js';
import {
  SETUP_TRIGGER,
  findTriggerBindingContent,
  formatKitContextLine,
  resolvePrimaryPlaceNest,
} from './ambient.js';
import type { InstalledKitConfig } from './group-config.js';

const setupFired = sharedMap<string, number>('kits.setupFired');

export function setupFireKey(groupFlag: string, installId: string): string {
  return `${groupFlag}:${installId}`;
}

export function shouldFireSetup(params: {
  entry: InstalledKitConfig;
  groupFlag: string;
  botShip: string;
}): boolean {
  const { entry, groupFlag, botShip } = params;
  if (entry.setup !== 'pending') {
    return false;
  }
  if (!entry.agents.includes(botShip)) {
    return false;
  }
  return !setupFired.has(setupFireKey(groupFlag, entry.installId));
}

export type SetupDeps = {
  botShip: string;
  /** Group-channel nest → session routing for the synthetic turn. */
  resolveGroupSessionRoute: (
    nest: string
  ) => { sessionKey: string; accountId?: string } | null;
  /**
   * Run the setup conversation as an active agent turn: wake the nest's
   * session with `text` as the user-visible input and deliver the model's
   * reply to the channel as a post. Resolution of the returned promise is
   * the turn completing, not just being queued.
   */
  dispatchKitSetupTurn: (params: {
    nest: string;
    text: string;
    groupFlag: string;
  }) => Promise<void>;
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

/**
 * Fire the setup conversation for one pending install, if eligible.
 * Returns true when the setup turn was dispatched.
 */
export async function maybeFireSetup(params: {
  groupFlag: string;
  entry: InstalledKitConfig;
  kit: Kit;
  deps: SetupDeps;
}): Promise<boolean> {
  const { groupFlag, entry, kit, deps } = params;
  if (!shouldFireSetup({ entry, groupFlag, botShip: deps.botShip })) {
    return false;
  }
  const content = findTriggerBindingContent(kit, SETUP_TRIGGER);
  if (!content) {
    deps.log?.(
      `[tlon] kits: ${entry.kit.id} has no ${SETUP_TRIGGER} binding; marking setup done without a conversation`
    );
  }
  const primaryNest = resolvePrimaryPlaceNest(entry.places);
  const route = primaryNest ? deps.resolveGroupSessionRoute(primaryNest) : null;
  if (content && (!primaryNest || !route)) {
    deps.error?.(
      `[tlon] kits: cannot resolve setup session for ${entry.installId} in ${groupFlag}; skipping`
    );
    return false;
  }

  // Guard before any side effect so a concurrent reconcile cannot double-fire.
  setupFired.set(setupFireKey(groupFlag, entry.installId), Date.now());

  let dispatched = false;
  if (content && primaryNest && route) {
    const contextLine = formatKitContextLine({
      label: 'Kit setup',
      kitId: entry.kit.id,
      groupFlag,
      places: entry.places,
    });
    // Fire-and-forget: the turn can take a full model run, and reconcile
    // must not block on it. Failures are logged; the fire-once guard above
    // intentionally still holds (no automatic retry of a half-run setup).
    void deps
      .dispatchKitSetupTurn({
        nest: primaryNest,
        text: `${contextLine}\n${content.trim()}`,
        groupFlag,
      })
      .catch((err) =>
        deps.error?.(
          `[tlon] kits: setup turn for ${entry.installId} in ${groupFlag} failed: ${String(err)}`
        )
      );
    dispatched = true;
    deps.log?.(
      `[tlon] kits: dispatched setup conversation for ${entry.installId} in ${groupFlag} → ${primaryNest}`
    );
  }

  // The install ledger lives on the OWNER's %kits, so completion is reported
  // via our own ship's %relay-setup-done, which forwards %setup-done to the
  // owner over Ames.
  try {
    await deps.poke({
      app: 'kits',
      mark: 'kits-action-1',
      json: { 'relay-setup-done': { flag: groupFlag } },
    });
  } catch (err) {
    deps.error?.(
      `[tlon] kits: relay-setup-done poke failed for ${groupFlag}: ${String(err)}`
    );
  }
  return dispatched;
}

export const _testing = {
  clearFired: () => setupFired.clear(),
  markFired: (groupFlag: string, installId: string) =>
    setupFired.set(setupFireKey(groupFlag, installId), Date.now()),
};
