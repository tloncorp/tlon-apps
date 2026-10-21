/**
 * An owner can send a second message while the bot is still answering the
 * first. OpenClaw runs the newer message as its own turn once the current one
 * ends, so the current turn must not post onboarding cards for the stale
 * message, and it must not be treated as a failure either: retrying can never
 * succeed in that turn, and the owner's newer message will get the reply.
 *
 * The result ends the stale turn itself rather than asking the model to stop.
 * Told to stop, models retried the card or went looking for the newer
 * message, and wording strong enough to stop them was also obeyed by the
 * newer message's turn, which reads this result in its history. So the text
 * only records what happened.
 */
export const SUPERSEDED_TURN_TEXT =
  'Not posted: the owner sent a newer message before this finished, and that message gets its own reply.';

export class SupersededTurnError extends Error {
  constructor() {
    super(SUPERSEDED_TURN_TEXT);
    this.name = 'SupersededTurnError';
  }
}

/**
 * A tool result for an action a newer owner message made stale. OpenClaw
 * ends the turn after a batch in which every result sets `terminate`.
 */
export function supersededToolResult() {
  return {
    content: [{ type: 'text' as const, text: SUPERSEDED_TURN_TEXT }],
    details: { superseded: true as const },
    terminate: true,
  };
}

/** Whether a tool result reports a superseded turn. */
export function isSupersededToolOutcome(result: unknown) {
  return (
    (result as { details?: { superseded?: unknown } } | undefined)?.details
      ?.superseded === true
  );
}
