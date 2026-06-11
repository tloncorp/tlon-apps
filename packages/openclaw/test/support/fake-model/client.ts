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
 */

export type Step =
  | { kind: "text"; content: string }
  | { kind: "tool_call"; name: string; args: Record<string, unknown> };

const baseUrl = (() => {
  const fromEnv = process.env.FAKE_MODEL_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:4000";
})();

async function postScript(key: string, steps: Step[]): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/_scripts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, steps }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fakeModel.script("${key}") failed: ${res.status} ${detail}`);
  }
}

async function deleteScripts(): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/_scripts`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fakeModel.reset failed: ${res.status} ${detail}`);
  }
}

export interface ReceivedCall {
  /** [tlon-test:KEY] tag found in the request, or null if no tag. */
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
}

async function getReceivedCalls(key?: string): Promise<ReceivedCall[]> {
  const url = key
    ? `${baseUrl}/v1/_received?key=${encodeURIComponent(key)}`
    : `${baseUrl}/v1/_received`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fakeModel.received failed: ${res.status} ${detail}`);
  }
  const body = (await res.json()) as { calls?: ReceivedCall[] };
  return body.calls ?? [];
}

export const fakeModel = {
  baseUrl,
  script: postScript,
  reset: deleteScripts,
  received: getReceivedCalls,
};
