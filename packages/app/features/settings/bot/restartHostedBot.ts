import * as api from '@tloncorp/api';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hosting answers the reload once it has signalled the pod; tlawn then stops
 * the gateway and starts a fresh one, and `/running` keeps answering for the
 * old process until it is gone. So a restart counts as confirmed only once
 * the bot has been seen down and then up again.
 */
export const STOP_TIMEOUT_MS = 15_000;
export const START_TIMEOUT_MS = 30_000;
export const POLL_MS = 1_500;

type ShipRestart = {
  active: Promise<boolean>;
  /** One more restart after this one, for a save that landed during it. */
  followUp: Promise<boolean> | null;
};
const restarts = new Map<string, ShipRestart>();
const listeners = new Set<() => void>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

/**
 * Only the user's own hosted bot runs under Hosting's supervisor, which is
 * what a reload goes to. Another owned bot, or any bot of a self-hosted
 * user, picks a change up whenever it next restarts on its own.
 */
export function isHostedBotOfCurrentUser(
  botShip: string,
  currentUserId: string
): boolean {
  if (botShip !== api.getBotUserIdForUser(currentUserId)) {
    return false;
  }
  try {
    return api.getCurrentUserIsHosted();
  } catch {
    return false;
  }
}

/** Whether a restart of this ship's bot is under way, follow-up included. */
export function isRestarting(ship: string): boolean {
  return restarts.has(ship);
}

export function subscribeToRestarts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Follows `isRestarting` for one ship. Kept outside any screen so that a
 * screen the navigator reuses for another bot, or one reopened mid-restart,
 * shows the restart only when it is that bot's.
 */
export function useHostedBotRestarting(ship: string | null): boolean {
  const getSnapshot = useCallback(
    () => ship !== null && restarts.has(ship),
    [ship]
  );
  return useSyncExternalStore(subscribeToRestarts, getSnapshot, getSnapshot);
}

/**
 * True once Hosting no longer sees the gateway up. A probe that fails says
 * nothing about the gateway, so it is not taken as down.
 */
async function awaitBotStopped(ship: string): Promise<boolean> {
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  for (;;) {
    try {
      if (!(await api.isBotRunning(ship))) {
        return true;
      }
    } catch {
      // Hosting itself did not answer; keep probing.
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await sleep(POLL_MS);
  }
}

async function runRestart(ship: string): Promise<boolean> {
  await api.reloadBot(ship);
  if (!(await awaitBotStopped(ship))) {
    return false;
  }
  return api.awaitBotRunning(ship, {
    timeoutMs: START_TIMEOUT_MS,
    pollIntervalMs: POLL_MS,
  });
}

function launch(ship: string): Promise<boolean> {
  const entry: ShipRestart = { active: Promise.resolve(false), followUp: null };
  entry.active = runRestart(ship).finally(() => {
    if (restarts.get(ship) !== entry) {
      return;
    }
    restarts.delete(ship);
    // A queued follow-up launches right after this and registers itself;
    // announcing the gap in between would flash the ship as idle.
    if (!entry.followUp) {
      notify();
    }
  });
  restarts.set(ship, entry);
  notify();
  return entry.active;
}

/**
 * Restarts the hosted bot's gateway, the way applying bot settings does, so
 * it starts on its current workspace. Resolves true once the bot has been
 * seen to go down and come back, false when that could not be confirmed in
 * time, and rejects when Hosting refuses the reload.
 *
 * A call made while a restart is under way gets one follow-up restart after
 * it, shared with every other call that arrives meanwhile: the new gateway
 * may already have read its workspace before the later save landed.
 */
export function restartHostedBot(ship: string): Promise<boolean> {
  const entry = restarts.get(ship);
  if (!entry) {
    return launch(ship);
  }
  if (!entry.followUp) {
    entry.followUp = entry.active.then(
      () => launch(ship),
      () => launch(ship)
    );
  }
  return entry.followUp;
}
