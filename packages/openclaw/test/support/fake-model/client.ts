/**
 * fakeModel — test-side client for the scripted fake model server.
 *
 * Tests pre-register the exact sequence of model responses before sending
 * a prompt; the fake server plays them back by call count. The fake never
 * parses prompt content. An unregistered or exhausted key fails HTTP 400
 * so collisions and missing setup surface loudly.
 *
 * Usage:
 *
 *   await fakeModel.reset();
 *   await fakeModel.script("post-channel-basic", [
 *     {
 *       kind: "tool_call",
 *       name: "message",
 *       args: { action: "send", target, message: token },
 *     },
 *     { kind: "text", content: "Done" },
 *   ]);
 *   await fixtures.client.prompt(
 *     `[tlon-test:post-channel-basic] post something into the channel`,
 *   );
 *
 * Trailing / extra model calls: some flows make ONE more model turn than they
 * have logical responses (e.g. a DM reply that emits its text and then makes a
 * trailing turn). By default an extra call past the last scripted step is a
 * loud 400 (it usually means a test under-specified its flow). A flow that
 * legitimately makes a bounded number of extra turns opts in explicitly:
 *
 *   await fakeModel.script(key, [{ kind: "text", content: "ack" }], {
 *     allowExtraCalls: 1,
 *   });
 *
 * Stale-history bleed is handled server-side: openclaw re-sends conversation
 * history and DMs share one per-peer session, so an old `[tlon-test:KEY]` tag
 * can ride into a later, untagged engaging turn. The server selects the script
 * by the tag on the *latest user turn* first, and treats a prior-epoch tag that
 * is no longer registered as a benign no-op (flagged `stale`) rather than a
 * 400. See bucket2-redesign.md §4.
 */

export type Step =
  | { kind: 'text'; content: string }
  | { kind: 'tool_call'; name: string; args: Record<string, unknown> };

export interface ScriptOptions {
  /**
   * Number of model calls past the last scripted step to tolerate, returning
   * benign filler (200) instead of a 400. Use for a flow that legitimately
   * makes a trailing model turn. Default 0 (exhaustion is a loud 400).
   */
  allowExtraCalls?: number;
}

const baseUrl = (() => {
  const fromEnv = process.env.FAKE_MODEL_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }
  return 'http://localhost:4000';
})();

async function postScript(
  key: string,
  steps: Step[],
  opts: ScriptOptions = {}
): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/_scripts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key,
      steps,
      allowExtraCalls: opts.allowExtraCalls ?? 0,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `fakeModel.script("${key}") failed: ${res.status} ${detail}`
    );
  }
}

async function deleteScripts(): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/_scripts`, { method: 'DELETE' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`fakeModel.reset failed: ${res.status} ${detail}`);
  }
}

export interface ReceivedCall {
  /** [tlon-test:KEY] tag selected for the request, or null if none. */
  key: string | null;
  /** Server-side timestamp (ms) when the call arrived. */
  at: number;
  /** Model identifier from the request body. */
  model: string | null;
  /** Whether the client requested streaming. */
  stream: boolean;
  /** Number of messages in the request. */
  messageCount: number;
  /**
   * Concatenated text content of all user-role messages in the request,
   * separated by newlines. Use this to assert that specific substrings
   * (blob transcriptions, filenames, mentioned ship names, etc.) made it
   * into the model's input — a real plumbing assertion, not just "the bot
   * replied with something".
   */
  userText: string;
  /** Epoch (reset generation) the server was in when the call arrived. */
  epoch: number;
  /** Epoch in which this call's key was last registered, or null if never. */
  registeredEpoch: number | null;
  /**
   * True when `epoch > registeredEpoch` — a reset() ran between the key's
   * registration and this call's arrival, so the tag rode in on re-sent
   * session history from a prior test. A DIAGNOSTIC classification only: the
   * server serves such calls benignly (it does not 400 on them).
   */
  stale: boolean;
  /**
   * How the key was selected: 'latest-user' (tag on the newest user turn),
   * 'history-active' (continuation; last historical tag still registered),
   * 'history-inactive' (last historical tag no longer registered), or 'none'.
   */
  provenance: 'latest-user' | 'history-active' | 'history-inactive' | 'none';
}

async function getReceived(
  key?: string
): Promise<{ calls: ReceivedCall[]; epoch: number }> {
  const url = key
    ? `${baseUrl}/v1/_received?key=${encodeURIComponent(key)}`
    : `${baseUrl}/v1/_received`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`fakeModel.received failed: ${res.status} ${detail}`);
  }
  const body = (await res.json()) as { calls?: ReceivedCall[]; epoch?: number };
  return { calls: body.calls ?? [], epoch: body.epoch ?? 0 };
}

async function getReceivedCalls(key?: string): Promise<ReceivedCall[]> {
  return (await getReceived(key)).calls;
}

/**
 * All cross-epoch (stale) calls recorded since the last reset. Use to REPORT
 * stale-history bleed by class in verification — not as a hard assertion, since
 * a stale call is served benignly and is an inherent (harmless) consequence of
 * untagged engaging turns + persistent session history.
 */
async function getStaleCalls(): Promise<ReceivedCall[]> {
  return (await getReceivedCalls()).filter((c) => c.stale);
}

export const fakeModel = {
  baseUrl,
  script: postScript,
  reset: deleteScripts,
  received: getReceivedCalls,
  staleCalls: getStaleCalls,
};
