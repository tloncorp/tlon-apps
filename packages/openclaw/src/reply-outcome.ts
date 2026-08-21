import type { ReplyPayload } from 'openclaw/plugin-sdk/core';
import { isReplyPayloadNonTerminalToolErrorWarning } from 'openclaw/plugin-sdk/reply-payload';

export type ReplyDispatchKind = 'tool' | 'block' | 'final';

/**
 * OpenClaw can successfully deliver a final reply whose content represents an
 * unrecovered agent/tool failure. Delivery succeeded, but the task did not.
 * Recoverable tool warnings are explicitly marked by OpenClaw and must not
 * turn an otherwise successful run red.
 */
export function terminalAgentReplyError(
  payload: ReplyPayload,
  kind: ReplyDispatchKind
): Error | null {
  if (
    kind !== 'final' ||
    payload.isError !== true ||
    isReplyPayloadNonTerminalToolErrorWarning(payload)
  ) {
    return null;
  }

  return new Error('The agent ended with an unrecovered tool error.');
}
