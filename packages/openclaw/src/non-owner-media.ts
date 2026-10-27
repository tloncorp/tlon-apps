/**
 * Outbound media gate for non-owner turns. The before_tool_call hook checks
 * the `message` tool's arguments; this checks the payload core actually
 * resolved, at the point the Tlon adapter would read or post media.
 *
 * The role comes from the active Tlon turn (AsyncLocalStorage set around the
 * monitor's dispatch): the answered sender's role or the run's sticky demotion
 * (turn-identity.ts). The session's current role is not consulted: the
 * monitor overwrites it on every inbound message, so in a group another
 * member's post would reclassify an owner's in-flight turn. Outside a Tlon
 * turn (cron, heartbeat, durable redelivery) there is no requester and media
 * passes, matching the hook's role-less rule.
 */
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

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
  // getRecordedRunRole is the security hook's sticky record: a non-owner
  // message steered into this run demotes it to 'user' for good. The
  // session's current role is deliberately ignored (see header).
  const forbidden =
    turn.senderRole === 'user' || getRecordedRunRole(turn.runId) === 'user';
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
