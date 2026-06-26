import fs from 'node:fs';
import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { resolveStateDir } from 'openclaw/plugin-sdk/state-paths';

import { subscribeToContextLensEvents } from './context-lens-events.js';
import type { ContextLens, ContextLensStatus } from './context-lens.js';
import { sharedSlot } from './shared-state.js';
import { resolveLensAccountId, resolveTlonAccount } from './types.js';

export const DEFAULT_STORE_RETAIN_DAYS = 30;
export const DEFAULT_STORE_MAX_STORED = 500;
export const DEFAULT_MAX_INFLIGHT = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

const ABORTED_BY_RECOVERY_ERROR = 'Gateway stopped before this run finished';

const TERMINAL_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'completed',
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

export type ContextLensStore = {
  save: (lens: ContextLens) => void;
  get: (lensId: string) => ContextLens | null;
  /** Retained runs, oldest→newest by finalization time. */
  list: () => ContextLens[];
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

// Recovery of interrupted runs is a once-per-process boot operation: a plugin
// re-init mid-run must not re-read the checkpoint and abort runs that are
// still live in the current process.
const recoveredSlot = sharedSlot<boolean>('contextLens.inflight.recovered');

export function getContextLensStore(): ContextLensStore | null {
  return storeSlot.get();
}

export function setContextLensStore(store: ContextLensStore | null): void {
  storeSlot.set(store);
}

export function defaultContextLensStorePath(): string {
  return path.join(resolveStateDir(), 'tlon', 'context-lens-runs.jsonl');
}

export function lensFinalizedAt(lens: ContextLens): number {
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
    list: () => {
      const now = Date.now();
      return [...runs.values()].filter((lens) => isRetained(lens, now));
    },
    size: () => runs.size,
  };
}

export function inflightCheckpointPath(storeFilePath: string): string {
  return `${storeFilePath}.inflight.jsonl`;
}

/**
 * Sidecar checkpoint of runs that are currently in flight. A run only reaches
 * the durable store on a terminal event, so a SIGKILL/crash mid-run (or a
 * SIGTERM that abandons the run without finalizing) would otherwise leave no
 * trace on the gateway and a frozen in-flight copy on the ship. This file
 * keeps the latest non-terminal snapshot per run; on the next boot
 * `recoverInterruptedRuns` finalizes whatever is left as `aborted`.
 *
 * Backed by an in-memory map with whole-file atomic rewrites — the file only
 * ever holds concurrently-running runs (terminal events remove them), so it
 * stays tiny.
 */
export type InflightCheckpoint = {
  upsert: (lens: ContextLens) => void;
  remove: (lensId: string) => void;
  list: () => ContextLens[];
  clear: () => void;
  filePath: string;
};

export function createInflightCheckpoint(opts: {
  filePath: string;
  maxInflight?: number | null;
  logger?: StoreLogger;
}): InflightCheckpoint {
  const filePath = opts.filePath;
  const maxInflight = opts.maxInflight ?? DEFAULT_MAX_INFLIGHT;
  const logger = opts.logger;
  const pending = new Map<string, ContextLens>();

  const flush = () => {
    const lines = [...pending.values()]
      .map((lens) => JSON.stringify(lens))
      .join('\n');
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, lines.length > 0 ? `${lines}\n` : '', {
      mode: 0o600,
    });
    fs.renameSync(tmpPath, filePath);
  };

  const load = () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const lens = JSON.parse(trimmed) as ContextLens;
        if (typeof lens?.lensId === 'string' && lens.lensId) {
          pending.delete(lens.lensId);
          pending.set(lens.lensId, lens);
        }
      } catch {
        // Drop malformed checkpoint lines; a partial run record is not worth
        // failing boot over.
      }
    }
  };

  try {
    load();
  } catch (error) {
    logger?.warn(
      `[tlon] Context lens in-flight checkpoint load failed: ${String(error)}`
    );
  }

  return {
    filePath,
    upsert: (lens) => {
      pending.delete(lens.lensId);
      pending.set(lens.lensId, lens);
      while (pending.size > maxInflight) {
        const oldest = pending.keys().next().value;
        if (!oldest) {
          break;
        }
        pending.delete(oldest);
      }
      flush();
    },
    remove: (lensId) => {
      if (pending.delete(lensId)) {
        flush();
      }
    },
    list: () => [...pending.values()],
    clear: () => {
      if (pending.size === 0 && !fs.existsSync(filePath)) {
        return;
      }
      pending.clear();
      flush();
    },
  };
}

/**
 * Finalize an interrupted run as `aborted`: stamp completion timings and close
 * any tool runs left open when the process died, so the inspector shows a
 * coherent terminal record rather than a run frozen mid-flight.
 */
export function markLensAborted(
  lens: ContextLens,
  now = Date.now()
): ContextLens {
  const completedAt = lens.lifecycle.completedAt ?? now;
  return {
    ...lens,
    status: 'aborted',
    error: lens.error ?? ABORTED_BY_RECOVERY_ERROR,
    tools: {
      ...lens.tools,
      runs: lens.tools.runs.map((run) =>
        run.completedAt
          ? run
          : {
              ...run,
              completedAt: now,
              durationMs: now - run.startedAt,
              status: 'error' as const,
              error: run.error ?? ABORTED_BY_RECOVERY_ERROR,
            }
      ),
    },
    lifecycle: {
      ...lens.lifecycle,
      completedAt,
      durationMs: lens.lifecycle.durationMs ?? completedAt - lens.createdAt,
    },
    updatedAt: now,
  };
}

/**
 * On boot, finalize runs that a previous process left in flight: each leftover
 * checkpoint snapshot is marked `aborted` and saved to the durable store,
 * where ship-sync's boot replay picks it up and overwrites the ship's frozen
 * in-flight copy. Skips runs already terminal on disk (a stale checkpoint line
 * whose terminal removal was lost to the crash). Clears the checkpoint after.
 */
export function recoverInterruptedRuns(opts: {
  store: ContextLensStore;
  checkpoint: InflightCheckpoint;
  logger?: StoreLogger;
  now?: number;
}): number {
  const { store, checkpoint, logger } = opts;
  const now = opts.now ?? Date.now();
  const pending = checkpoint.list();
  if (pending.length === 0) {
    return 0;
  }
  let recovered = 0;
  let failed = 0;
  for (const lens of pending) {
    if (TERMINAL_STATUSES.has(lens.status)) {
      continue;
    }
    const existing = store.get(lens.lensId);
    if (existing && TERMINAL_STATUSES.has(existing.status)) {
      continue;
    }
    try {
      store.save(markLensAborted(lens, now));
      recovered += 1;
    } catch (error) {
      failed += 1;
      logger?.warn(
        `[tlon] Context lens recovery failed for ${lens.lensId}: ${String(error)}`
      );
    }
  }
  // Keep the checkpoint when any save failed so the next boot can retry —
  // a transient write hiccup must not permanently drop the only inflight
  // snapshot.
  if (failed === 0) {
    checkpoint.clear();
  }
  if (recovered > 0) {
    logger?.info(
      `[tlon] Context lens recovered ${recovered} interrupted run(s) as aborted`
    );
  }
  return recovered;
}

/**
 * Wire the disk store to the lens event stream: every event whose lens has
 * reached a terminal status is persisted (last write wins, so a later
 * "final" snapshot for the same lensId replaces the earlier one). Non-terminal
 * events are checkpointed to a sidecar so an interrupted run can be recovered
 * as `aborted` on the next boot.
 *
 * Returns the store, or null when the lens or its store is disabled.
 */
export function initContextLensStore(api: {
  config: OpenClawConfig;
  logger: StoreLogger;
}): ContextLensStore | null {
  const lensConfig = resolveTlonAccount(
    api.config,
    resolveLensAccountId(api.config)
  ).contextLens;
  if (!lensConfig.enabled || !lensConfig.store.enabled) {
    // A re-init that disables the store (or the whole lens) must tear down any
    // store + writer left over from a prior init, or terminal events would keep
    // landing in the old JSONL despite persistence being off.
    const previousStore = getContextLensStore();
    storeUnsubscribeSlot.get()?.();
    storeUnsubscribeSlot.set(null);
    setContextLensStore(null);
    // Clearing the writer can't run the terminal `checkpoint.remove` for any
    // run still in flight, so a leftover sidecar would make a later re-enable
    // (or restart on the same path) recover a run that actually finished while
    // persistence was off. Drop the checkpoint along with the store.
    if (previousStore) {
      try {
        createInflightCheckpoint({
          filePath: inflightCheckpointPath(previousStore.filePath),
          logger: api.logger,
        }).clear();
      } catch (error) {
        api.logger.warn(
          `[tlon] Context lens checkpoint teardown failed: ${String(error)}`
        );
      }
    }
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

  const checkpoint = createInflightCheckpoint({
    filePath: inflightCheckpointPath(store.filePath),
    logger: api.logger,
  });
  // Once per process: a mid-run re-init must not re-read the checkpoint and
  // abort runs still live in this process.
  if (!recoveredSlot.get()) {
    recoveredSlot.set(true);
    try {
      recoverInterruptedRuns({ store, checkpoint, logger: api.logger });
    } catch (error) {
      api.logger.warn(`[tlon] Context lens recovery failed: ${String(error)}`);
    }
  }

  storeUnsubscribeSlot.get()?.();
  storeUnsubscribeSlot.set(
    subscribeToContextLensEvents((event) => {
      const lens = event.lens;
      if (TERMINAL_STATUSES.has(lens.status)) {
        try {
          checkpoint.remove(lens.lensId);
        } catch (error) {
          api.logger.warn(
            `[tlon] Context lens checkpoint clear failed for ${lens.lensId}: ${String(error)}`
          );
        }
        try {
          store.save(lens);
        } catch (error) {
          api.logger.warn(
            `[tlon] Context lens store write failed for ${lens.lensId}: ${String(error)}`
          );
        }
        return;
      }
      try {
        checkpoint.upsert(lens);
      } catch (error) {
        api.logger.warn(
          `[tlon] Context lens checkpoint write failed for ${lens.lensId}: ${String(error)}`
        );
      }
    })
  );
  return store;
}
