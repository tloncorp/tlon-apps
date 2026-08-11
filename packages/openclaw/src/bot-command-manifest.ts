import { BOT_COMMANDS_CONTACT_KEY } from './commands-registry.js';

export type BotCommandManifestPublishResult =
  | 'published'
  | 'cleared'
  | 'unchanged';

export interface BotCommandManifestPokeApi {
  poke(params: { app: string; mark: string; json: unknown }): Promise<unknown>;
}

export interface BotCommandManifestScryApi {
  scry(path: string): Promise<unknown>;
}

export const SELF_CONTACT_SCRY_PATH = '/contacts/v1/self.json';

// A poke that fails transiently would otherwise leave a healthy long-lived bot
// unadvertised until an unrelated SSE reconnect or a restart, so the write is
// retried in place. Reads are never retried: a failed read is handled by
// skipping entirely (see SelfContactRead).
export const BOT_COMMANDS_PUBLISH_ATTEMPTS = 3;
export const BOT_COMMANDS_PUBLISH_BACKOFF_MS: readonly number[] = [
  2_000, 8_000,
];

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

// A self-contact read that failed is not the same as one that succeeded
// without the key: only the latter proves the key is absent. Publishing on a
// failed read defeats compare-then-poke exactly when the ship is unhealthy.
export type SelfContactRead =
  | { ok: true; contact: unknown }
  | { ok: false; error: unknown };

export async function readSelfContact(
  api: BotCommandManifestScryApi
): Promise<SelfContactRead> {
  try {
    return { ok: true, contact: await api.scry(SELF_CONTACT_SCRY_PATH) };
  } catch (error) {
    return { ok: false, error };
  }
}

// Runtime shape check for the `bot-commands` field on a self-contact map:
// only a %text field carrying a string is a published manifest value.
export function readBotCommandsValue(selfContact: unknown): string | null {
  if (!selfContact || typeof selfContact !== 'object') {
    return null;
  }
  const field = (selfContact as Record<string, unknown>)[
    BOT_COMMANDS_CONTACT_KEY
  ];
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return null;
  }
  const candidate = field as { type?: unknown; value?: unknown };
  if (candidate.type !== 'text' || typeof candidate.value !== 'string') {
    return null;
  }
  return candidate.value;
}

// Poke the advertised manifest into the bot's own contact profile. `%self`
// is a merge, so nickname/avatar survive. Passing null clears the key (the
// documented rollback/retirement procedure — see
// docs/bot-command-manifests.md): contact keys only die by explicit null.
// Retried up to BOT_COMMANDS_PUBLISH_ATTEMPTS with bounded backoff; the last
// failure rethrows so callers keep today's non-fatal log-and-continue.
export async function publishBotCommandManifest(
  api: BotCommandManifestPokeApi,
  desiredValue: string | null,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotCommandManifestPublishResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      await api.poke({
        app: 'contacts',
        mark: 'contact-action-1',
        json: {
          self: {
            [BOT_COMMANDS_CONTACT_KEY]:
              desiredValue === null
                ? null
                : { type: 'text', value: desiredValue },
          },
        },
      });
      return desiredValue === null ? 'cleared' : 'published';
    } catch (error) {
      if (attempt >= BOT_COMMANDS_PUBLISH_ATTEMPTS) {
        throw error;
      }
      // An aborted sleep rejects, which lands in syncBotCommandManifest's
      // catch as a non-fatal 'skipped' — the retired monitor stops retrying.
      await sleep(
        BOT_COMMANDS_PUBLISH_BACKOFF_MS[
          Math.min(attempt - 1, BOT_COMMANDS_PUBLISH_BACKOFF_MS.length - 1)
        ],
        abortSignal
      );
    }
  }
}

// Compare-then-poke: only write when the advertised value actually changed.
// Content comparison is the version/change detection — no fingerprint
// persistence. Non-fatal: callers log and continue (next boot retries).
// A failed self-contact read yields 'skipped': the current value is unknown,
// so there is nothing to compare against.
export async function maybePublishBotCommandManifest(
  api: BotCommandManifestPokeApi,
  selfContact: SelfContactRead,
  desiredValue: string,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotCommandManifestPublishResult | 'skipped'> {
  if (!selfContact.ok) {
    return 'skipped';
  }
  const currentValue = readBotCommandsValue(selfContact.contact);
  if (currentValue === desiredValue) {
    return 'unchanged';
  }
  return publishBotCommandManifest(api, desiredValue, sleep, abortSignal);
}

// Boot and reconnect both land here: read the self-contact, compare, poke on
// difference. Reconnect matters because a failed boot publish — or a key
// cleared while the monitor stays alive — would otherwise persist until the
// process restarts. Never throws; the result is for logging only.
export async function syncBotCommandManifest(
  api: BotCommandManifestPokeApi & BotCommandManifestScryApi,
  desiredValue: string,
  selfContact?: SelfContactRead,
  sleep: Sleeper = defaultSleep,
  abortSignal?: AbortSignal
): Promise<BotCommandManifestPublishResult | 'skipped'> {
  try {
    return await maybePublishBotCommandManifest(
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
