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
  /**
   * The gateway's job service. Setup runs as a one-shot `at` job with an
   * `agentTurn` payload because that is the only mechanism that *starts* a
   * turn: enqueueSystemEvent only queues text for whenever the session next
   * runs, so a workspace whose human never speaks first would wait forever
   * for its own introduction. The job store is also durable, so a restart
   * between fire and run does not lose the instruction.
   */
  cron: {
    add: (input: {
      name: string;
      description: string;
      enabled: boolean;
      schedule: { kind: string; [key: string]: unknown };
      sessionTarget: string;
      wakeMode: string;
      payload: { kind: string; [key: string]: unknown };
    }) => Promise<unknown>;
  };
  nowMs?: () => number;
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
 * Returns true when the setup turn was scheduled.
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

  let fired = false;
  if (content && primaryNest && route) {
    const contextLine = formatKitContextLine({
      label: 'Kit setup',
      kitId: entry.kit.id,
      groupFlag,
      places: entry.places,
    });
    // A one-shot job due immediately. `at` jobs delete after they run, the
    // session target routes the reply into the kit's primary place, and
    // session-targeted jobs must carry an agentTurn payload (the host
    // rejects any other pairing).
    const at = (deps.nowMs ?? Date.now)();
    try {
      await deps.cron.add({
        name: `tlon:kit-setup:${groupFlag}:${entry.installId}`,
        description: `Kit ${entry.kit.id} setup for ${groupFlag}`,
        enabled: true,
        schedule: { kind: 'at', atMs: at },
        sessionTarget: `session:${route.sessionKey}`,
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: `${contextLine}\n${content.trim()}`,
        },
      });
      fired = true;
      deps.log?.(
        `[tlon] kits: scheduled setup turn for ${entry.installId} in ${groupFlag} → ${primaryNest}`
      );
    } catch (err) {
      // Roll the guard back: nothing happened, so a later reconcile should
      // be allowed to try again.
      setupFired.delete(setupFireKey(groupFlag, entry.installId));
      deps.error?.(
        `[tlon] kits: setup turn scheduling failed for ${groupFlag}: ${String(err)}`
      );
      return false;
    }
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
  return fired;
}

export const _testing = {
  clearFired: () => setupFired.clear(),
  markFired: (groupFlag: string, installId: string) =>
    setupFired.set(setupFireKey(groupFlag, installId), Date.now()),
};
