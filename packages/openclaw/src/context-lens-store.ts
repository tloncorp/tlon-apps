import fs from 'node:fs';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { resolveStateDir } from 'openclaw/plugin-sdk/state-paths';

import { subscribeToContextLensEvents } from './context-lens-events.js';
import type { ContextLens, ContextLensStatus } from './context-lens.js';
import { sharedSlot } from './shared-state.js';
import { resolveTlonAccount } from './types.js';

export const DEFAULT_STORE_RETAIN_DAYS = 30;
export const DEFAULT_STORE_MAX_STORED = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'completed',
  'no_reply',
  'timed_out',
  'error',
]);

export type ContextLensStore = {
  save: (lens: ContextLens) => void;
  get: (lensId: string) => ContextLens | null;
  size: () => number;
  filePath: string;
};

type StoreLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

const storeSlot = sharedSlot<ContextLensStore>('contextLens.store');

// Replace semantics for the shared event-bus subscription: plugin re-inits
// (fresh module contexts) must not stack additional store writers.
const storeUnsubscribeSlot = sharedSlot<() => void>(
  'contextLens.store.unsubscribe'
);

export function getContextLensStore(): ContextLensStore | null {
  return storeSlot.get();
}

export function setContextLensStore(store: ContextLensStore | null): void {
  storeSlot.set(store);
}

export function defaultContextLensStorePath(): string {
  return path.join(resolveStateDir(), 'tlon', 'context-lens-runs.jsonl');
}

function lensFinalizedAt(lens: ContextLens): number {
  return lens.lifecycle.completedAt ?? lens.updatedAt ?? lens.createdAt;
}

/**
 * Durable JSONL store for finalized context-lens runs. The in-memory
 * registry stays the hot cache; this file is the restart backstop so
 * `/run` can still resolve lensIds stamped into old channel posts.
 *
 * Append-only with last-write-wins per lensId on load; compaction
 * rewrites the file when retention drops entries.
 */
export function createContextLensStore(opts: {
  filePath: string;
  retainDays?: number | null;
  maxStored?: number | null;
  logger?: StoreLogger;
}): ContextLensStore {
  const filePath = opts.filePath;
  const retainMs = (opts.retainDays ?? DEFAULT_STORE_RETAIN_DAYS) * DAY_MS;
  const maxStored = opts.maxStored ?? DEFAULT_STORE_MAX_STORED;
  const logger = opts.logger;

  // Insertion-ordered oldest→newest by finalization time.
  const runs = new Map<string, ContextLens>();

  const isRetained = (lens: ContextLens, now: number) =>
    lensFinalizedAt(lens) > now - retainMs;

  const compact = () => {
    const lines = [...runs.values()]
      .map((lens) => JSON.stringify(lens))
      .join('\n');
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, lines.length > 0 ? `${lines}\n` : '', {
      mode: 0o600,
    });
    fs.renameSync(tmpPath, filePath);
  };

  const pruneRuns = (now: number): boolean => {
    let dropped = false;
    for (const [lensId, lens] of runs) {
      if (!isRetained(lens, now)) {
        runs.delete(lensId);
        dropped = true;
      }
    }
    while (runs.size > maxStored) {
      const oldest = runs.keys().next().value;
      if (!oldest) {
        break;
      }
      runs.delete(oldest);
      dropped = true;
    }
    return dropped;
  };

  const load = () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    let malformed = 0;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const lens = JSON.parse(trimmed) as ContextLens;
        if (typeof lens?.lensId !== 'string' || !lens.lensId) {
          malformed += 1;
          continue;
        }
        // Re-insert so a later duplicate moves to the newest position.
        runs.delete(lens.lensId);
        runs.set(lens.lensId, lens);
      } catch {
        malformed += 1;
      }
    }
    if (malformed > 0) {
      logger?.warn(
        `[tlon] Context lens store skipped ${malformed} malformed line(s) in ${filePath}`
      );
    }
    const loadedCount = runs.size;
    const dropped = pruneRuns(Date.now());
    if (dropped || malformed > 0) {
      compact();
    }
    logger?.info(
      `[tlon] Context lens store loaded ${runs.size}/${loadedCount} run(s) from ${filePath}`
    );
  };

  load();

  return {
    filePath,
    save: (lens) => {
      const now = Date.now();
      if (!isRetained(lens, now)) {
        return;
      }
      runs.delete(lens.lensId);
      runs.set(lens.lensId, lens);
      if (pruneRuns(now)) {
        compact();
        return;
      }
      fs.appendFileSync(filePath, `${JSON.stringify(lens)}\n`, { mode: 0o600 });
    },
    get: (lensId) => {
      const lens = runs.get(lensId);
      if (!lens || !isRetained(lens, Date.now())) {
        return null;
      }
      return lens;
    },
    size: () => runs.size,
  };
}

/**
 * Wire the disk store to the lens event stream: every event whose lens has
 * reached a terminal status is persisted (last write wins, so a later
 * "final" snapshot for the same lensId replaces the earlier one).
 *
 * Returns the store, or null when the lens or its store is disabled.
 */
export function initContextLensStore(api: {
  config: OpenClawConfig;
  logger: StoreLogger;
}): ContextLensStore | null {
  const lensConfig = resolveTlonAccount(api.config).contextLens;
  if (!lensConfig.enabled || !lensConfig.store.enabled) {
    return null;
  }
  let store: ContextLensStore;
  try {
    store = createContextLensStore({
      filePath: lensConfig.store.path ?? defaultContextLensStorePath(),
      retainDays: lensConfig.store.retainDays,
      maxStored: lensConfig.store.maxStored,
      logger: api.logger,
    });
  } catch (error) {
    api.logger.warn(
      `[tlon] Context lens store unavailable, continuing without durable history: ${String(error)}`
    );
    return null;
  }
  setContextLensStore(store);
  storeUnsubscribeSlot.get()?.();
  storeUnsubscribeSlot.set(
    subscribeToContextLensEvents((event) => {
      if (!TERMINAL_STATUSES.has(event.lens.status)) {
        return;
      }
      try {
        store.save(event.lens);
      } catch (error) {
        api.logger.warn(
          `[tlon] Context lens store write failed for ${event.lens.lensId}: ${String(error)}`
        );
      }
    })
  );
  return store;
}
