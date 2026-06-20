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
  fs.writeFileSync(filePath, JSON.stringify(trimmed), { mode: 0o600 });
}

function truncateSummary(value: string | undefined): string | undefined {
  if (value === undefined || value.length <= MAX_SUMMARY_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_SUMMARY_CHARS)}… [truncated]`;
}

/**
 * Build the opaque run payload poked to %steward, serialized to a JSON
 * string (the agent stores payloads as cords — embedding $json in Hoon mark
 * sample types breaks ford tube builds). The lens snapshot is passed
 * through with per-field truncation (tool args/results, previews) and a
 * total size cap, since the ship stores it verbatim and ames pokes should
 * stay small. Full untruncated runs remain on gateway disk (Phase 2 store).
 */
export function buildLensRunPayload(lens: ContextLens): string {
  // retrySeed is gateway-only (raw chat text + blob JSON): keep pokes lean
  // and avoid mirroring message bodies onto the ship a second time.
  const { retrySeed: _retrySeed, ...rest } = lens;
  const slim: ContextLens = {
    ...rest,
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
  const payload = JSON.stringify({
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    lens: slim,
  });
  if (payload.length <= MAX_PAYLOAD_CHARS) {
    return payload;
  }
  // Still oversized (e.g. hundreds of tool runs): drop the bulky arrays but
  // keep the run's identity, status, and timings inspectable.
  const skeleton: ContextLens = {
    ...slim,
    context: { ...slim.context, sources: [] },
    persistence: { ...slim.persistence, events: [] },
    tools: { ...slim.tools, runs: [] },
    outputs: [],
  };
  return JSON.stringify({
    schemaVersion: PAYLOAD_SCHEMA_VERSION,
    lens: skeleton,
    truncated: true,
  });
}

export function resolveLensOwners(
  config: OpenClawConfig,
  accountId?: string | null
): string[] {
  const account = resolveTlonAccount(config, accountId);
  const configured = account.contextLens.owners
    .map((ship) => normalizeShip(ship))
    .filter((ship) => ship.length > 0);
  if (configured.length > 0) {
    return [...new Set(configured)];
  }
  const owner = account.ownerShip ? normalizeShip(account.ownerShip) : '';
  return owner ? [owner] : [];
}

/**
 * %steward's lens module stores a single owner ship (`unit ship`). If the
 * config lists multiple `contextLens.owners`, we pick the first and ignore
 * the rest — multi-owner fan-out is no longer supported on the agent side.
 * Returns null when no owner is configured (sync stays inert).
 */
export function resolveLensOwner(
  config: OpenClawConfig,
  accountId?: string | null
): string | null {
  const owners = resolveLensOwners(config, accountId);
  return owners[0] ?? null;
}

/**
 * True when at least one context-lens consumer can read recorded runs: the
 * HTTP routes (need authToken) or the ship sync (needs resolvable owners).
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
    resolveLensOwners(config, accountId).length > 0
  );
}

export type ContextLensShipSync = {
  handleEvent: (event: ContextLensEvent) => void;
  /** Resolves when all pokes enqueued so far have settled. */
  flush: () => Promise<void>;
};

/**
 * Mirror context-lens runs to the bot ship's %steward agent (lens module),
 * which fans them out to the configured owner ship for durable, mobile-
 * reachable history.
 *
 * - terminal status → `[%entry id payload final=true]`
 * - non-terminal status transitions → `[%entry id payload final=false]`
 *
 * Pokes ride the monitor-published api-client params (the same slot the
 * gateway-status heartbeat uses). The agent's owner is configured lazily
 * (once per params-slot instance, ordered before any run poke via a serial
 * queue) so monitor restarts re-assert the config.
 */
export function createContextLensShipSync(opts: {
  /** The single configured owner ship (%steward stores `unit ship`). */
  owner: string;
  logger: SyncLogger;
  getParams?: () => SharedApiClientParams | null;
  /** Called after a final entry poke is acked — basis for boot-time replay. */
  onRunFinal?: (lens: ContextLens) => void;
}): ContextLensShipSync {
  const { owner, logger, onRunFinal } = opts;
  const getParams = opts.getParams ?? (() => apiClientParamsSlot.get() ?? null);

  const lastStatusByLensId = new Map<string, ContextLensStatus>();
  let configuredFor: SharedApiClientParams | null = null;
  let queue: Promise<void> = Promise.resolve();

  const enqueuePoke = (
    label: string,
    json: unknown,
    onSuccess?: () => void
  ) => {
    queue = queue
      .then(async () => {
        const params = getParams();
        if (!params) {
          // Monitor not connected yet (or shut down); drop rather than
          // buffer — the ship store is bounded and the gateway store keeps
          // the full run.
          return;
        }
        if (params !== configuredFor) {
          // %steward's top-level %configure is per-ship (sets the singular
          // owner); the lens module's own configure sub-action sets the
          // retention cap. We only assert the owner here; retention is left
          // at the steward default unless an operator pokes %lens
          // %configure separately.
          await params.poke({
            app: 'steward',
            mark: 'steward-action-1',
            json: { configure: { owner } },
          });
          configuredFor = params;
        }
        await params.poke({
          app: 'steward',
          mark: 'steward-action-1',
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
        `entry-final ${lens.lensId}`,
        {
          lens: {
            entry: {
              id: lens.lensId,
              payload: buildLensRunPayload(lens),
              final: true,
            },
          },
        },
        onRunFinal ? () => onRunFinal(lens) : undefined
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
    enqueuePoke(`entry-partial ${lens.lensId}`, {
      lens: {
        entry: {
          id: lens.lensId,
          payload: buildLensRunPayload(lens),
          final: false,
        },
      },
    });
  };

  return {
    handleEvent,
    flush: () => queue,
  };
}

/**
 * Re-poke terminal runs whose final %entry never reached the ship — e.g. runs
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
 * when the lens is disabled or no owners resolve (no contextLens.owners and
 * no ownerShip).
 */
export function initContextLensShipSync(api: {
  config: OpenClawConfig;
  logger: SyncLogger;
}): boolean {
  // Tear down any prior subscription/replay first: a config reload that
  // disables the lens or empties owners must not leak the previous
  // subscriber, which would keep fanning runs to the former owner list.
  const teardown = () => {
    shipSyncUnsubscribeSlot.get()?.();
    shipSyncUnsubscribeSlot.set(null);
    replayCancelSlot.get()?.();
    replayCancelSlot.set(null);
  };
  if (!resolveTlonAccount(api.config).contextLens.enabled) {
    teardown();
    return false;
  }
  const owner = resolveLensOwner(api.config);
  if (!owner) {
    teardown();
    api.logger.info(
      '[tlon] Context lens ship sync disabled: no owner configured (set contextLens.owners or ownerShip)'
    );
    return false;
  }
  const owners = resolveLensOwners(api.config);
  if (owners.length > 1) {
    api.logger.warn(
      `[tlon] Context lens ship sync: %steward stores a single owner; using ${owner}, ignoring ${owners.slice(1).join(', ')}`
    );
  }
  const sync = createContextLensShipSync({
    owner,
    logger: api.logger,
    onRunFinal: (lens) => {
      const store = getContextLensStore();
      if (!store) {
        return;
      }
      recordSyncedLensId(syncedLensIdsPath(store.filePath), lens.lensId);
    },
  });
  shipSyncUnsubscribeSlot.get()?.();
  shipSyncUnsubscribeSlot.set(subscribeToContextLensEvents(sync.handleEvent));
  startShipSyncReplay(sync, api.logger);
  api.logger.info(
    `[tlon] Context lens ship sync enabled, fanning out to ${owner}`
  );
  return true;
}
