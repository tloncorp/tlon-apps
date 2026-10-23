import { getGatewayRestartPreflight } from './docker-logs.js';

/**
 * Wait until the gateway reports no queued work, pending replies, embedded
 * runs or active tasks, then return; throw if it is still busy at the
 * deadline. Use it before resetting the fake model (a reset under an active run
 * recreates the exhausted-script error path) and before sending a second
 * message into a session whose previous run may still be finishing (on core
 * 2026.5.28 a message queued behind an active run leaves both replies
 * undelivered and the runtime busy for every later test file). A no-op without
 * TEST_COMPOSE_FILE (dev mode, no gateway to ask).
 */
export async function waitForRuntimeIdle(
  label: string,
  timeoutMs = 90_000
): Promise<void> {
  const composeFile = process.env.TEST_COMPOSE_FILE ?? '';
  if (!composeFile) return;
  const deadline = Date.now() + timeoutMs;
  let preflight = getGatewayRestartPreflight(composeFile, 10_000);
  while (preflight.counts.totalActive > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    preflight = getGatewayRestartPreflight(composeFile, 10_000);
  }
  if (preflight.counts.totalActive > 0) {
    throw new Error(
      `Runtime not idle ${label}: ${JSON.stringify(preflight.counts)} ` +
        `(${preflight.summary})`
    );
  }
}
