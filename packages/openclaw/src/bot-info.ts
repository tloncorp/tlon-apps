import { contactSelfFieldPoke } from '@tloncorp/api';

// Contact-profile key under which the bot publishes its identity claim (wire
// contract: docs/bot-info.md in tlon-apps).
export const BOT_INFO_CONTACT_KEY = 'bot-info';
// The client rejects raw claims above this size. The backend's 10kB jam cap
// covers the whole profile, so a publish failure is a real, non-fatal outcome
// regardless.
export const BOT_INFO_MAX_BYTES = 512;

const HARNESS = 'openclaw';

export type BotInfoPublishResult = 'published' | 'cleared' | 'unchanged';

export interface BotInfoPokeApi {
  poke(params: { app: string; mark: string; json: unknown }): Promise<unknown>;
}

export interface BotInfoScryApi {
  scry(path: string): Promise<unknown>;
}

export const SELF_CONTACT_SCRY_PATH = '/contacts/v1/self.json';

// A poke that fails transiently would otherwise leave a healthy long-lived bot
// unidentified until an unrelated SSE reconnect or a restart, so the write is
// retried in place. Reads are never retried: a failed read is handled by
// skipping entirely (see SelfContactRead).
export const BOT_INFO_PUBLISH_ATTEMPTS = 3;
export const BOT_INFO_PUBLISH_BACKOFF_MS: readonly number[] = [2_000, 8_000];

// The signal is the monitor's opts.abortSignal: a shutdown or config-reload
// restart during the 2s/8s backoff must cancel the pending timer and stop the
// retry loop, or a retired monitor lingers and retries against its stale SSE
// client (same pattern as the authentication backoff in monitor/index.ts).
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

// Exported for the timer/listener-cleanup tests; production always reaches it
// through the Sleeper default.
export const defaultSleep: Sleeper = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

// Serialize the identity claim. Byte-stable: JSON key order follows
// construction order, which is fixed here, so compare-then-poke does not
// false-positive.
//
// `harnessVersion` is a diagnostic rider: it is omitted when the host does not
// report a version, never allowed to invalidate the claim. Callers log that
// omission — for this runtime it always means something is broken.
export function buildBotInfoJson(params: {
  version: string;
  harnessVersion?: string | null;
}): string {
  const harnessVersion = params.harnessVersion?.trim();
  const value = JSON.stringify({
    v: 1,
    harness: HARNESS,
    version: params.version,
    ...(harnessVersion ? { harnessVersion } : {}),
  });
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > BOT_INFO_MAX_BYTES) {
    throw new Error(
      `bot info exceeds ${BOT_INFO_MAX_BYTES} UTF-8 bytes: ${bytes}`
    );
  }
  return value;
}

// A self-contact read that failed is not the same as one that succeeded
// without the key: only the latter proves the key is absent. Publishing on a
// failed read defeats compare-then-poke exactly when the ship is unhealthy.
export type SelfContactRead =
  | { ok: true; contact: unknown }
  | { ok: false; error: unknown };

export async function readSelfContact(
  api: BotInfoScryApi
): Promise<SelfContactRead> {
  try {
    return { ok: true, contact: await api.scry(SELF_CONTACT_SCRY_PATH) };
  } catch (error) {
    return { ok: false, error };
  }
}

// Runtime shape check for the `bot-info` field on a self-contact map: only a
// %text field carrying a string is a published claim.
export function readBotInfoValue(selfContact: unknown): string | null {
  if (!selfContact || typeof selfContact !== 'object') {
    return null;
  }
  const field = (selfContact as Record<string, unknown>)[BOT_INFO_CONTACT_KEY];
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return null;
  }
  const candidate = field as { type?: unknown; value?: unknown };
  if (candidate.type !== 'text' || typeof candidate.value !== 'string') {
    return null;
  }
  return candidate.value;
}

// Poke the identity claim into the bot's own contact profile. `%self` is a
// merge, so nickname/avatar survive. Passing null clears the key (the
// documented rollback/retirement procedure — see docs/bot-info.md): contact
// keys only die by explicit null. Retried up to BOT_INFO_PUBLISH_ATTEMPTS with
// bounded backoff; the last failure rethrows so callers keep today's non-fatal
// log-and-continue.
export async function publishBotInfo(
  api: BotInfoPokeApi,
  desiredValue: string | null,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotInfoPublishResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      // The wire shape (app/mark/self-merge semantics) is owned by the api
      // lib; only the transport is ours, for abort-signal and retry control.
      await api.poke(
        contactSelfFieldPoke(
          BOT_INFO_CONTACT_KEY,
          desiredValue === null ? null : { type: 'text', value: desiredValue }
        )
      );
      return desiredValue === null ? 'cleared' : 'published';
    } catch (error) {
      if (attempt >= BOT_INFO_PUBLISH_ATTEMPTS) {
        throw error;
      }
      // An aborted sleep rejects, which lands in syncBotInfo's catch as a
      // non-fatal 'skipped' — the retired monitor stops retrying.
      await sleep(
        BOT_INFO_PUBLISH_BACKOFF_MS[
          Math.min(attempt - 1, BOT_INFO_PUBLISH_BACKOFF_MS.length - 1)
        ],
        abortSignal
      );
    }
  }
}

// Compare-then-poke: only write when the published value actually changed.
// Content comparison is the version/change detection — no fingerprint
// persistence. Non-fatal: callers log and continue (next boot retries).
// A failed self-contact read yields 'skipped': the current value is unknown,
// so there is nothing to compare against.
export async function maybePublishBotInfo(
  api: BotInfoPokeApi,
  selfContact: SelfContactRead,
  desiredValue: string,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotInfoPublishResult | 'skipped'> {
  if (!selfContact.ok) {
    return 'skipped';
  }
  const currentValue = readBotInfoValue(selfContact.contact);
  if (currentValue === desiredValue) {
    return 'unchanged';
  }
  return publishBotInfo(api, desiredValue, sleep, abortSignal);
}

// Boot and reconnect both land here: read the self-contact, compare, poke on
// difference. Reconnect matters because a failed boot publish — or a key
// cleared while the monitor stays alive — would otherwise persist until the
// process restarts. Never throws; the result is for logging only.
export async function syncBotInfo(
  api: BotInfoPokeApi & BotInfoScryApi,
  desiredValue: string,
  selfContact?: SelfContactRead,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotInfoPublishResult | 'skipped'> {
  try {
    return await maybePublishBotInfo(
      api,
      selfContact ?? (await readSelfContact(api)),
      desiredValue,
      sleep,
      abortSignal
    );
  } catch {
    return 'skipped';
  }
}
