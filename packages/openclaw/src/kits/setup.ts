/**
 * Kit setup conversation: when a group's install config shows
 * `setup: "pending"`, enqueue a synthetic turn carrying the kit's
 * `install.setup`-triggered instruction into the primary place's session,
 * then poke `setup-done` so the config flips to `"done"`.
 *
 * v1 semantics are fire-once: a sharedMap keyed by group+installId guards
 * against double-fire inside this process (the `setup-done` poke closes the
 * loop durably on the ship). Setup only fires when the bot's ship is listed
 * in the config's `agents`.
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
  enqueueSystemEvent: (
    text: string,
    opts: {
      sessionKey: string;
      contextKey?: string | null;
      deliveryContext?: { channel: 'tlon'; to: string; accountId?: string };
    }
  ) => unknown;
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
 * Returns true when the synthetic turn was enqueued.
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

  let enqueued = false;
  if (content && primaryNest && route) {
    const contextLine = formatKitContextLine({
      label: 'Kit setup',
      kitId: entry.kit.id,
      groupFlag,
      places: entry.places,
    });
    deps.enqueueSystemEvent(`${contextLine}\n${content.trim()}`, {
      sessionKey: route.sessionKey,
      contextKey: `tlon:kit-setup:${groupFlag}:${entry.installId}`,
      deliveryContext: {
        channel: 'tlon',
        to: `tlon:${primaryNest}`,
        ...(route.accountId ? { accountId: route.accountId } : {}),
      },
    });
    enqueued = true;
    deps.log?.(
      `[tlon] kits: enqueued setup conversation for ${entry.installId} in ${groupFlag} → ${primaryNest}`
    );
  }

  try {
    await deps.poke({
      app: 'kits',
      mark: 'kits-action-1',
      json: { 'setup-done': { flag: groupFlag } },
    });
  } catch (err) {
    deps.error?.(
      `[tlon] kits: setup-done poke failed for ${groupFlag}: ${String(err)}`
    );
  }
  return enqueued;
}

export const _testing = {
  clearFired: () => setupFired.clear(),
  markFired: (groupFlag: string, installId: string) =>
    setupFired.set(setupFireKey(groupFlag, installId), Date.now()),
};
