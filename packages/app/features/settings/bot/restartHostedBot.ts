import * as api from '@tloncorp/api';

/**
 * Hosting answers the reload once it has signalled the pod; tlawn then stops
 * the gateway and starts a fresh one. Polling at once can find the old
 * process still up and call the restart finished before it has begun.
 */
export const RESTART_SETTLE_MS = 3_000;
export const RESTART_TIMEOUT_MS = 30_000;
export const RESTART_POLL_MS = 1_500;

const inFlight = new Map<string, Promise<boolean>>();

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

/**
 * Restarts the hosted bot's gateway, the way applying bot settings does, so
 * it starts on its current workspace. Resolves true once the bot reports
 * running again and false if it has not within the timeout; rejects when
 * Hosting refuses the reload. Overlapping calls for one ship share a single
 * restart instead of queueing another behind it.
 */
export function restartHostedBot(ship: string): Promise<boolean> {
  const existing = inFlight.get(ship);
  if (existing) {
    return existing;
  }
  const restart = (async () => {
    await api.reloadBot(ship);
    await new Promise((resolve) => setTimeout(resolve, RESTART_SETTLE_MS));
    return api.awaitBotRunning(ship, {
      timeoutMs: RESTART_TIMEOUT_MS,
      pollIntervalMs: RESTART_POLL_MS,
    });
  })().finally(() => {
    if (inFlight.get(ship) === restart) {
      inFlight.delete(ship);
    }
  });
  inFlight.set(ship, restart);
  return restart;
}
