export type Step =
  | { kind: 'text'; content: string }
  | { kind: 'tool_call'; name: string; args: Record<string, unknown> };

const baseUrl = (() => {
  const fromEnv = process.env.FAKE_MODEL_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }
  return 'http://localhost:4000';
})();

async function postScript(key: string, steps: Step[]): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/_scripts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, steps }),
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
  key: string | null;
  at: number;
  model: string | null;
  stream: boolean;
  messageCount: number;
  userText: string;
}

async function getReceivedCalls(key?: string): Promise<ReceivedCall[]> {
  const url = key
    ? `${baseUrl}/v1/_received?key=${encodeURIComponent(key)}`
    : `${baseUrl}/v1/_received`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
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
