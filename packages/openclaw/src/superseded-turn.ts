/**
 * An owner can send a second message while the bot is still answering the
 * first. OpenClaw runs the newer message as its own turn once the current one
 * ends, so the current turn must not post onboarding cards for the stale
 * message, and it must not be treated as a failure either: retrying can never
 * succeed in that turn, and the owner's newer message will get the reply.
 */
export const SUPERSEDED_TURN_TEXT =
  'A newer owner message arrived and will get its own reply, so nothing was posted. Reply with only NO_REPLY now and make no more tool calls.';

export class SupersededTurnError extends Error {
  constructor() {
    super(SUPERSEDED_TURN_TEXT);
    this.name = 'SupersededTurnError';
  }
}

/** A tool result for an action a newer owner message made stale. */
export function supersededToolResult() {
  return {
    content: [{ type: 'text' as const, text: SUPERSEDED_TURN_TEXT }],
    details: { superseded: true as const },
  };
}

/** Whether a tool result or error message reports a superseded turn. */
export function isSupersededToolOutcome(input: {
  result?: unknown;
  errorMessage?: string;
}) {
  const details = (input.result as { details?: { superseded?: unknown } })
    ?.details;
  return (
    details?.superseded === true ||
    Boolean(input.errorMessage?.includes(SUPERSEDED_TURN_TEXT))
  );
}
