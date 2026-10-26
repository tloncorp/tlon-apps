/**
 * Outbound media gate for non-owner turns. The before_tool_call hook checks
 * the `message` tool's arguments; this checks the payload core actually
 * resolved, at the point the Tlon adapter would read or post media.
 *
 * The role comes from the active Tlon turn (AsyncLocalStorage set around the
 * monitor's dispatch): the answered sender's role, the run's sticky demotion
 * (turn-identity.ts), or a non-owner role stored for the turn's session since. Outside a
 * Tlon turn (cron, heartbeat, durable redelivery) there is no requester and
 * media passes, matching the hook's role-less rule.
 */
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

import { getSessionRole } from './session-roles.js';
import { getActiveTlonTurnRequester } from './turn-recorder.js';
import { getRecordedRunRole } from './turn-identity.js';

export const NON_OWNER_MEDIA_ERROR =
  'Attachments and media are owner-only for this conversation; send text only.';

const logger = createSubsystemLogger('tlon/non-owner-media');
const loggedRuns = new Set<string>();
const MAX_LOGGED_RUNS = 1_024;

/** The active Tlon turn answers a non-owner; logs once per run when true. */
export function activeTurnForbidsMedia(): boolean {
  const turn = getActiveTlonTurnRequester();
  if (!turn) return false;
  // getRecordedRunRole is the security hook's sticky record: once a
  // non-owner message demotes the run it stays 'user', even if a later owner
  // message overwrites the session's role.
  const forbidden =
    turn.senderRole === 'user' ||
    getRecordedRunRole(turn.runId) === 'user' ||
    getSessionRole(turn.sessionKey) === 'user';
  if (forbidden && !loggedRuns.has(turn.runId)) {
    loggedRuns.add(turn.runId);
    if (loggedRuns.size > MAX_LOGGED_RUNS) {
      loggedRuns.delete(loggedRuns.values().next().value!);
    }
    logger.info(
      `Dropped outbound media for a non-owner turn. Session: ${turn.sessionKey}`
    );
  }
  return forbidden;
}
