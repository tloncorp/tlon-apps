/**
 * Kit package store: fetches full kit packages (manifest + files) from the
 * bot ship's own %kits agent.
 *
 * Read path: scry `/kits/v1/kits/<id>.json` → `{ kit: { manifest, files } }`.
 * When the package is not in the local library yet, poke
 * `kits-action-1 {"fetch":{"ship":<publisher>,"id":<id>}}` and re-scry with
 * backoff (the %kits agents complete the transfer ship-to-ship).
 */
import type { Kit } from '@tloncorp/api';

export type KitRef = {
  id: string;
  publisher: string;
  /** Pinned install version; logged on mismatch, not enforced (v1). */
  version?: string;
};

export type KitPackageStore = {
  /** Cached kit package, fetching from the publisher when missing. */
  get(ref: KitRef): Promise<Kit | null>;
  invalidate(id: string): void;
  clear(): void;
};

/** Re-scry delays after a fetch poke; sums to ~30s. */
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function asKit(value: unknown): Kit | null {
  const kit = (value as { kit?: unknown } | null)?.kit as
    | { manifest?: unknown; files?: unknown }
    | undefined;
  if (!kit || typeof kit !== 'object') {
    return null;
  }
  const manifest = kit.manifest as { id?: unknown } | undefined;
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    typeof manifest.id !== 'string' ||
    !manifest.id
  ) {
    return null;
  }
  if (!kit.files || typeof kit.files !== 'object' || Array.isArray(kit.files)) {
    return null;
  }
  return kit as Kit;
}

export function createKitPackageStore(deps: {
  scry: (path: string) => Promise<unknown>;
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  log?: (msg: string) => void;
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}): KitPackageStore {
  const retryDelaysMs = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = deps.sleep ?? defaultSleep;
  const cache = new Map<string, Kit>();
  const inFlight = new Map<string, Promise<Kit | null>>();

  const scryKit = async (id: string): Promise<Kit | null> => {
    let response: unknown;
    try {
      response = await deps.scry(`/kits/v1/kits/${id}.json`);
    } catch {
      // 404 (not in library yet) and transport errors both surface as
      // throws from the scry helper; treat both as "missing" and let the
      // fetch/backoff path decide.
      return null;
    }
    return asKit(response);
  };

  const fetchKit = async (ref: KitRef): Promise<Kit | null> => {
    const direct = await scryKit(ref.id);
    if (direct) {
      return direct;
    }
    deps.log?.(
      `[tlon] kits: package ${ref.id} not in library; fetching from ${ref.publisher}`
    );
    try {
      await deps.poke({
        app: 'kits',
        mark: 'kits-action-1',
        json: { fetch: { ship: ref.publisher, id: ref.id } },
      });
    } catch (err) {
      deps.log?.(
        `[tlon] kits: fetch poke for ${ref.id} failed: ${String(err)}`
      );
      return null;
    }
    for (const delayMs of retryDelaysMs) {
      await sleep(delayMs);
      const kit = await scryKit(ref.id);
      if (kit) {
        return kit;
      }
    }
    deps.log?.(
      `[tlon] kits: package ${ref.id} still missing after fetch from ${ref.publisher}`
    );
    return null;
  };

  return {
    async get(ref: KitRef): Promise<Kit | null> {
      const cached = cache.get(ref.id);
      if (cached) {
        return cached;
      }
      const pending = inFlight.get(ref.id);
      if (pending) {
        return pending;
      }
      const task = fetchKit(ref)
        .then((kit) => {
          if (kit) {
            cache.set(ref.id, kit);
            if (ref.version && kit.manifest.version !== ref.version) {
              deps.log?.(
                `[tlon] kits: install pins ${ref.id}@${ref.version} but library has ` +
                  `${kit.manifest.version}; using library copy (v1 has no side-by-side versions)`
              );
            }
          }
          return kit;
        })
        .finally(() => {
          inFlight.delete(ref.id);
        });
      inFlight.set(ref.id, task);
      return task;
    },
    invalidate(id: string): void {
      cache.delete(id);
    },
    clear(): void {
      cache.clear();
    },
  };
}
