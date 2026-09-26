/**
 * An owner can send a second message while the bot is still answering the
 * first. OpenClaw runs the newer message as its own turn once the current one
 * ends, so the current turn must not post onboarding cards for the stale
 * message, and it must not be treated as a failure either: retrying can never
 * succeed in that turn, and the owner's newer message will get the reply.
 */
const MARKER = 'will get its own reply';

/**
 * Quoting the newer message matters: told only that "a newer message
 * arrived", models go looking for it with session tools and retry for a
 * minute, which also delays the reply to that newer message. Scoping the
 * NO_REPLY to this turn matters too: the next turn sees this result in its
 * history, and without the scope the model stays silent there as well.
 */
export function supersededTurnText(newerOwnerText?: string) {
  const text = newerOwnerText?.replace(/\s+/g, ' ').trim();
  const quoted = text
    ? ` The owner has since written: "${text.length > 200 ? `${text.slice(0, 199)}…` : text}".`
    : '';
  return `This turn is stale: a newer owner message arrived and ${MARKER} right after this one, so nothing was posted here.${quoted} End this stale turn by replying with only NO_REPLY; make no more tool calls and do not look the message up. This applies only to this turn: when the newer message's turn starts, answer it normally.`;
}

export const SUPERSEDED_TURN_TEXT = supersededTurnText();

export class SupersededTurnError extends Error {
  constructor(newerOwnerText?: string) {
    super(supersededTurnText(newerOwnerText));
    this.name = 'SupersededTurnError';
  }
}

/** A tool result for an action a newer owner message made stale. */
export function supersededToolResult(error?: SupersededTurnError) {
  return {
    content: [
      { type: 'text' as const, text: error?.message ?? SUPERSEDED_TURN_TEXT },
    ],
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
    Boolean(input.errorMessage?.includes(MARKER))
  );
}
