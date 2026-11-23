/**
 * Appended to every heartbeat prompt. Core only tells the model to stay
 * silent in its default heartbeat prompt; a configured prompt replaces it,
 * and models then report "nothing to do, no DM sent" in their final text,
 * which core delivers to the owner as a DM. NO_REPLY and notify=false are
 * the outcomes core drops without a delivery.
 */
export const TLON_HEARTBEAT_SILENCE_CONTEXT =
  'Your final reply to this heartbeat is delivered to your owner as a Tlon DM. ' +
  'Send one only when your owner needs to act on something or answer a question. ' +
  'Otherwise reply exactly NO_REPLY (or call heartbeat_respond with notify=false if you have it): ' +
  'no run summaries, status reports or "nothing to report" messages. ' +
  'Keep notes about the run in your workspace files instead.';
