/**
 * Helpers for model-engaging test turns.
 *
 * Any message that engages the bot's agent loop (owner DMs always do; @mentions
 * and thread replies in watched channels do) becomes a model call. openclaw
 * re-sends the whole conversation history on every call and DMs share one
 * long-lived per-peer session, so an *untagged* engaging turn inherits the last
 * `[tlon-test:KEY]` tag still sitting in history — typically a prior test's key
 * — and misroutes (see bucket2-redesign.md).
 *
 * The durable fix is server-side (provenance-aware key selection + benign
 * handling of stale prior-epoch tags). This helper is the front-line fix: give
 * every engaging setup turn (thread-anchor parents, probes) its OWN key so it
 * never inherits a foreign one. A grep for raw `sendPost` / `sendReply` /
 * `sendDm` / `prompt` then becomes a review tool for the intentional, knowingly
 * non-engaging exceptions, rather than the audit itself.
 */
import {
  type ScriptOptions,
  type Step,
  fakeModel,
} from '../support/fake-model/client.js';

const DEFAULT_ACK: Step[] = [{ kind: 'text', content: 'ack' }];

/**
 * Register a (benign by default) script for `key` and return the
 * `[tlon-test:KEY]` tag to embed in the engaging turn's content.
 *
 * Defaults to `allowExtraCalls: 1` because these engaging flows make one
 * trailing model turn beyond their single text response.
 */
export async function registerEngagingTurn(
  key: string,
  steps: Step[] = DEFAULT_ACK,
  opts: ScriptOptions = { allowExtraCalls: 1 }
): Promise<string> {
  await fakeModel.script(key, steps, opts);
  return `[tlon-test:${key}]`;
}
