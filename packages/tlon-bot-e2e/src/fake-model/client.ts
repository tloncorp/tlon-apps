import type {
  FakeModelReceivedResponse,
  ModelAuxiliaryCallKind,
  ReceivedCall,
  ScriptOptions,
  Step,
} from './types.js';

export type {
  FakeModelReceivedResponse,
  ModelAuxiliaryCallKind,
  ReceivedCall,
  ScriptOptions,
  Step,
};

export const DEFAULT_FAKE_MODEL_BASE_URL = 'http://localhost:4000';

export function normalizeFakeModelBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function fakeModelBaseUrlFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string {
  const fromEnv = env.FAKE_MODEL_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return normalizeFakeModelBaseUrl(fromEnv);
  }
  return DEFAULT_FAKE_MODEL_BASE_URL;
}

export class FakeModelClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeFakeModelBaseUrl(baseUrl);
  }

  script = async (
    key: string,
    steps: Step[],
    opts: ScriptOptions = {}
  ): Promise<void> => {
    const res = await fetch(`${this.baseUrl}/v1/_scripts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key,
        steps,
        allowExtraCalls: opts.allowExtraCalls ?? 0,
        allowedAuxiliaryCalls: opts.allowedAuxiliaryCalls ?? [],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `fakeModel.script("${key}") failed: ${res.status} ${detail}`
      );
    }
  };

  reset = async (): Promise<void> => {
    const res = await fetch(`${this.baseUrl}/v1/_scripts`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`fakeModel.reset failed: ${res.status} ${detail}`);
    }
  };

  receivedWithEpoch = async (
    key?: string
  ): Promise<FakeModelReceivedResponse> => {
    const url = key
      ? `${this.baseUrl}/v1/_received?key=${encodeURIComponent(key)}`
      : `${this.baseUrl}/v1/_received`;
    const res = await fetch(url);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`fakeModel.received failed: ${res.status} ${detail}`);
    }
    const body = (await res.json()) as Partial<FakeModelReceivedResponse>;
    const calls = body.calls ?? [];
    return {
      calls,
      count: body.count ?? calls.length,
      epoch: body.epoch ?? 0,
    };
  };

  received = async (key?: string): Promise<ReceivedCall[]> => {
    return (await this.receivedWithEpoch(key)).calls;
  };

  staleCalls = async (): Promise<ReceivedCall[]> => {
    return (await this.received()).filter((call) => call.stale);
  };
}
