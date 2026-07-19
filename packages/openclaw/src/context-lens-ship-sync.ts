import fs from 'node:fs';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import {
  type ContextLensEvent,
  subscribeToContextLensEvents,
} from './context-lens-events.js';
import {
  type ContextLensStore,
  getContextLensStore,
  lensFinalizedAt,
} from './context-lens-store.js';
import type { ContextLens, ContextLensStatus } from './context-lens.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';
import { normalizeShip } from './targets.js';
import { resolveTlonAccount } from './types.js';

const PAYLOAD_SCHEMA_VERSION = 1;
const MAX_SUMMARY_CHARS = 4_096;
const MAX_PAYLOAD_CHARS = 50 * 1_024;
const MAX_TRACKED_RUNS = 1_000;
const MAX_SYNCED_IDS = 1_000;
const REPLAY_POLL_MS = 2_000;
const REPLAY_GIVE_UP_MS = 10 * 60_000;
const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const REPLAY_MAX_RUNS = 50;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 10 * 60_000;

const TERMINAL_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'completed',
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

type SyncLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

const apiClientParamsSlot = sharedSlot<SharedApiClientParams>(
  API_CLIENT_PARAMS_SLOT
);

// The host re-initializes the plugin in fresh module contexts (run starts,
// reloads) while the event bus listener set lives in shared state — without
// replace semantics every re-init would stack another subscriber and each
// run would be poked N times.
const shipSyncUnsubscribeSlot = sharedSlot<() => void>(
  'contextLens.shipSync.unsubscribe'
);
const replayCancelSlot = sharedSlot<() => void>(
  'contextLens.shipSync.replayCancel'
);
const finalRetryCancelSlot = sharedSlot<() => void>(
  'contextLens.shipSync.finalRetryCancel'
);

export function syncedLensIdsPath(storeFilePath: string): string {
  return `${storeFilePath}.synced.json`;
}

export function loadSyncedLensIds(filePath: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function recordSyncedLensId(filePath: string, lensId: string): void {
  const ids = loadSyncedLensIds(filePath);
  ids.delete(lensId);
  ids.add(lensId);
  const trimmed = [...ids].slice(-MAX_SYNCED_IDS);
  // Atomic rewrite: a crash mid-write must not leave invalid JSON, which
  // would read back as an empty ledger and trigger a full (if idempotent)
  // replay on the next boot.
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(trimmed), { mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function truncateSummary(value: string | undefined): string | undefined {
  if (value === undefined || value.length <= MAX_SUMMARY_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_SUMMARY_CHARS)}… [truncated]`;
}

/** The run record poked to %steward as the lens action's `payload`. */
export type LensRunPayload = {
  schemaVersion: number;
  lens: ContextLens;
  truncated?: boolean;
};

/**
 * Build the run payload poked to %steward (lens module) as a JSON object —
 * the agent stores it as a typed $json value, so it travels as structured
 * JSON, not a serialized cord. The lens snapshot is passed through with
 * per-field truncation (tool args/results, previews) and a total size cap,
 * since the ship stores it verbatim and ames pokes should stay small. Full
 * untruncated runs remain on gateway disk (Phase 2 store).
 */
export function buildLensRunPayload(lens: ContextLens): LensRunPayload {
  // retrySeed (raw chat text + blob field) rides along on the lens snapshot
  // so the agent is the durable source of truth for retry: any gateway,
  // current or future, can replay a run by scrying %steward for the payload
  // regardless of local cache state. Message text is already on the ship in
  // the original DM/channel, so mirroring it here does not introduce new
  // exposure; it does grow per-poke Ames traffic by roughly 1-10KB.
  const slim: ContextLens = {
    ...lens,
    context: {
      ...lens.context,
      sources: lens.context.sources.map((source) => ({
        ...source,
        preview: truncateSummary(source.preview),
      })),
    },
    tools: {
      ...lens.tools,
      runs: lens.tools.runs.map((run) => ({
        ...run,
        argumentSummary: truncateSummary(run.argumentSummary),
        argumentDetail: truncateSummary(run.argumentDetail),
        resultSummary: truncateSummary(run.resultSummary),
      })),
    },
  };
  const payload: LensRunPayload = {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    lens: slim,
  };
  if (JSON.stringify(payload).length <= MAX_PAYLOAD_CHARS) {
    return payload;
  }
  // Still oversized (e.g. hundreds of tool runs or a giant message): drop
  // the bulky arrays but keep run identity, retrySeed, and status; retry
  // remains possible because retrySeed survives the skeletonization.
  const skeleton: ContextLens = {
    ...slim,
    context: { ...slim.context, sources: [] },
    persistence: { ...slim.persistence, events: [] },
    tools: { ...slim.tools, runs: [] },
    outputs: [],
  };
  return {
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    lens: skeleton,
    truncated: true,
  };
}

export function resolveLensOwner(
  config: OpenClawConfig,
  accountId?: string | null
): string | null {
  const account = resolveTlonAccount(config, accountId);
  const configured = account.contextLens.owner
    ? normalizeShip(account.contextLens.owner)
    : '';
  if (configured.length > 0) {
    return configured;
  }
  const owner = account.ownerShip ? normalizeShip(account.ownerShip) : '';
  return owner.length > 0 ? owner : null;
}

/**
 * True when at least one context-lens consumer can read recorded runs: the
 * HTTP routes (need authToken) or the ship sync (needs a resolvable owner).
 * The monitor must record runs whenever either path is live — gating the
 * registry on authToken alone starves a ship-sync-only config.
 */
export function isContextLensEffectivelyEnabled(
  config: OpenClawConfig,
  accountId?: string | null
): boolean {
  const account = resolveTlonAccount(config, accountId);
  if (!account.contextLens.enabled) {
    return false;
  }
  return (
    Boolean(account.contextLens.authToken) ||
    resolveLensOwner(config, accountId) !== null
  );
}

export type ContextLensShipSync = {
  handleEvent: (event: ContextLensEvent) => void;
  /** Resolves when all pokes enqueued so far have settled. */
  flush: () => Promise<void>;
};

/**
 * Mirror context-lens runs to the bot ship's %steward agent (lens module),
 * which fans them out to the owner ship for durable, mobile-reachable history.
 *
 * - terminal status → finalized lens poke (`final: true`)
 * - non-terminal status transitions → milestone lens pokes (`final: false`)
 *
 * Pokes ride the monitor-published api-client params (the same slot the
 * gateway-status heartbeat uses). The agent's `owner` is configured
 * lazily: once per params-slot instance, ordered before any run poke via a
 * serial queue, so monitor restarts re-assert the config.
 */
export function createContextLensShipSync(opts: {
  owner: string;
  logger: SyncLogger;
  getParams?: () => SharedApiClientParams | null;
  /** Called after a run-final poke is acked — basis for boot-time replay. */
  onRunFinal?: (lens: ContextLens) => void;
  /**
   * Called when a run-final poke is dropped (monitor not connected) or
   * rejected (ship unreachable) — basis for retry-until-synced. Milestone
   * failures do not fire this: the eventual run-final supersedes them.
   */
  onRunFinalFailure?: (lens: ContextLens) => void;
}): ContextLensShipSync {
  const { owner, logger, onRunFinal, onRunFinalFailure } = opts;
  const getParams = opts.getParams ?? (() => apiClientParamsSlot.get() ?? null);

  const lastStatusByLensId = new Map<string, ContextLensStatus>();
  let configuredFor: SharedApiClientParams | null = null;
  let queue: Promise<void> = Promise.resolve();

  const enqueuePoke = (
    label: string,
    json: unknown,
    onSuccess?: () => void,
    onFailure?: () => void
  ) => {
    queue = queue
      .then(async () => {
        const params = getParams();
        if (!params) {
          // Monitor not connected yet (or shut down); drop rather than
          // buffer — the ship store is bounded and the gateway store keeps
          // the full run. Finals report the drop so replay can heal it.
          onFailure?.();
          return;
        }
        if (params !== configuredFor) {
          await params.poke({
            app: 'steward',
            mark: 'steward-action-1',
            json: { configure: { owner } },
          });
          configuredFor = params;
        }
        await params.poke({
          app: 'steward',
          mark: 'steward-lens-action-1',
          json,
        });
        try {
          onSuccess?.();
        } catch (error) {
          logger.warn(
            `[tlon] Context lens ship sync bookkeeping failed (${label}): ${String(error)}`
          );
        }
      })
      .catch((error) => {
        // A failed %configure must retry before the next run poke.
        configuredFor = null;
        logger.warn(
          `[tlon] Context lens ship sync poke failed (${label}): ${String(error)}`
        );
        try {
          onFailure?.();
        } catch (callbackError) {
          logger.warn(
            `[tlon] Context lens ship sync failure bookkeeping failed (${label}): ${String(callbackError)}`
          );
        }
      });
  };

  const handleEvent = (event: ContextLensEvent) => {
    const lens = event.lens;
    if (lens.visibility === 'internal') {
      return;
    }
    if (TERMINAL_STATUSES.has(lens.status)) {
      lastStatusByLensId.delete(lens.lensId);
      enqueuePoke(
        `run-final ${lens.lensId}`,
        {
          entry: {
            id: lens.lensId,
            payload: buildLensRunPayload(lens),
            final: true,
          },
        },
        onRunFinal ? () => onRunFinal(lens) : undefined,
        onRunFinalFailure ? () => onRunFinalFailure(lens) : undefined
      );
      return;
    }
    if (lens.status === lastStatusByLensId.get(lens.lensId)) {
      return;
    }
    lastStatusByLensId.delete(lens.lensId);
    lastStatusByLensId.set(lens.lensId, lens.status);
    while (lastStatusByLensId.size > MAX_TRACKED_RUNS) {
      const oldest = lastStatusByLensId.keys().next().value;
      if (!oldest) {
        break;
      }
      lastStatusByLensId.delete(oldest);
    }
    enqueuePoke(`run-event ${lens.lensId}`, {
      entry: {
        id: lens.lensId,
        payload: buildLensRunPayload(lens),
        final: false,
      },
    });
  };

  return {
    handleEvent,
    flush: () => queue,
  };
}

/**
 * Re-poke terminal runs whose run-final never reached the ship — e.g. runs
 * finalized during a SIGTERM shutdown, where the store write (sync fs)
 * landed but the poke died with the process. Without this the ship copy
 * stays frozen at the last in-flight status forever. Idempotent ship-side
 * (last write wins per run id); bounded by a recency window and a count cap
 * so a first boot without a synced-ids file cannot flood the ship.
 */
export function replayUnsyncedFinalRuns(
  store: ContextLensStore,
  sync: ContextLensShipSync,
  logger: SyncLogger,
  now = Date.now()
): number {
  const synced = loadSyncedLensIds(syncedLensIdsPath(store.filePath));
  const cutoff = now - REPLAY_WINDOW_MS;
  const missed = store
    .list()
    .filter(
      (lens) =>
        TERMINAL_STATUSES.has(lens.status) &&
        lens.visibility !== 'internal' &&
        !synced.has(lens.lensId) &&
        lensFinalizedAt(lens) > cutoff
    )
    .slice(-REPLAY_MAX_RUNS);
  if (missed.length === 0) {
    return 0;
  }
  logger.info(
    `[tlon] Context lens ship sync replaying ${missed.length} unsynced terminal run(s)`
  );
  for (const lens of missed) {
    sync.handleEvent({ seq: 0, at: now, phase: 'replay', lens });
  }
  return missed.length;
}

export type LensSyncRetry = {
  /** Arm (or keep armed) a retry; no-op while one is already pending. */
  schedule: () => void;
  /** Reset the backoff after a successful sync. */
  reset: () => void;
  cancel: () => void;
};

/**
 * Exponential-backoff retry used to re-run the unsynced-final replay after a
 * mid-session failure (ship unreachable, monitor disconnected). Without this
 * a run whose run-final poke fails stays frozen at its last milestone on the
 * ship until the next gateway restart. One timer at most: replay covers all
 * unsynced finals at once, so per-run timers would just multiply pokes.
 */
export function createLensSyncRetry(opts: {
  run: () => void;
  logger: SyncLogger;
  baseMs?: number;
  maxMs?: number;
}): LensSyncRetry {
  const baseMs = opts.baseMs ?? RETRY_BASE_MS;
  const maxMs = opts.maxMs ?? RETRY_MAX_MS;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) {
      return;
    }
    const delay = Math.min(baseMs * 2 ** attempt, maxMs);
    attempt += 1;
    opts.logger.info(
      `[tlon] Context lens ship sync retrying unsynced finals in ${Math.round(delay / 1_000)}s (attempt ${attempt})`
    );
    timer = setTimeout(() => {
      timer = null;
      opts.run();
    }, delay);
    timer.unref?.();
  };
  return {
    schedule,
    reset: () => {
      attempt = 0;
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

function startShipSyncReplay(
  sync: ContextLensShipSync,
  logger: SyncLogger
): void {
  replayCancelSlot.get()?.();
  const startedAt = Date.now();
  // Poll: at init time neither the api-client params (monitor not connected)
  // nor the disk store (initialized after ship sync) exist yet.
  const timer = setInterval(() => {
    if (Date.now() - startedAt > REPLAY_GIVE_UP_MS) {
      stop();
      return;
    }
    const store = getContextLensStore();
    if (!store || !apiClientParamsSlot.get()) {
      return;
    }
    stop();
    try {
      replayUnsyncedFinalRuns(store, sync, logger);
    } catch (error) {
      logger.warn(
        `[tlon] Context lens ship sync replay failed: ${String(error)}`
      );
    }
  }, REPLAY_POLL_MS);
  timer.unref?.();
  const stop = () => clearInterval(timer);
  replayCancelSlot.set(stop);
}

/**
 * Wire ship sync to the lens event stream. Returns true when active, false
 * when the lens is disabled or no owner resolves (no contextLens.owner and
 * no ownerShip).
 */
export function initContextLensShipSync(api: {
  config: OpenClawConfig;
  logger: SyncLogger;
}): boolean {
  if (!resolveTlonAccount(api.config).contextLens.enabled) {
    return false;
  }
  const owner = resolveLensOwner(api.config);
  if (owner === null) {
    api.logger.info(
      '[tlon] Context lens ship sync disabled: no owner configured (set contextLens.owner or ownerShip)'
    );
    return false;
  }
  // Forward reference: the retry replays through `sync`, which is created
  // below with callbacks that arm/reset the retry. `run` only fires from a
  // timer, well after both bindings exist.
  const retry = createLensSyncRetry({
    logger: api.logger,
    run: () => {
      const store = getContextLensStore();
      if (!store || !apiClientParamsSlot.get()) {
        // Still disconnected (or store gone): keep backing off.
        retry.schedule();
        return;
      }
      try {
        replayUnsyncedFinalRuns(store, sync, api.logger);
      } catch (error) {
        api.logger.warn(
          `[tlon] Context lens ship sync retry failed: ${String(error)}`
        );
      }
    },
  });
  const sync = createContextLensShipSync({
    owner,
    logger: api.logger,
    onRunFinal: (lens) => {
      // The poke succeeded but the ledger write can still fail; without a
      // scheduled retry the run would stay marked unsynced until the next
      // boot replay. Arm the retry so the ledger write is re-attempted (the
      // replayed poke is idempotent ship-side).
      const store = getContextLensStore();
      if (store) {
        try {
          recordSyncedLensId(syncedLensIdsPath(store.filePath), lens.lensId);
        } catch (error) {
          api.logger.warn(
            `[tlon] Context lens sync ledger write failed: ${String(error)}`
          );
          retry.schedule();
          return;
        }
      }
      retry.reset();
    },
    onRunFinalFailure: () => retry.schedule(),
  });
  shipSyncUnsubscribeSlot.get()?.();
  shipSyncUnsubscribeSlot.set(subscribeToContextLensEvents(sync.handleEvent));
  finalRetryCancelSlot.get()?.();
  finalRetryCancelSlot.set(retry.cancel);
  startShipSyncReplay(sync, api.logger);
  api.logger.info(
    `[tlon] Context lens ship sync enabled, fanning out to ${owner}`
  );
  return true;
}
