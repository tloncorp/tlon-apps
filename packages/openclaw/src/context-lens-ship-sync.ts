import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { emptyContextLensActivity } from './context-lens-activity.js';
import type { ContextLensActivityEvent } from './context-lens-activity.js';
import {
  type ContextLensEvent,
  subscribeToContextLensEvents,
} from './context-lens-events.js';
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
const DEFAULT_RETRY_DELAYS_MS = [250, 1_000] as const;
const DEFAULT_NONTERMINAL_DEBOUNCE_MS = 250;

const TERMINAL_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'completed',
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

const SHIP_ACTIVITY_STATUSES = new Set([
  'pending',
  'running',
  'waiting',
  'completed',
  'error',
  'blocked',
  'cancelled',
]);

/**
 * Keep Ames traffic bounded while still making native chat progress legible:
 * %steward receives plans and item state transitions, but not command output,
 * thinking, streamed text deltas, or unknown/no-op states. Repeated item states
 * are deduplicated per run by createContextLensShipSync.
 */
export function isDurableActivityMilestone(
  activity: ContextLensActivityEvent | undefined
): boolean {
  if (!activity || activity.retention === 'ephemeral') {
    return false;
  }
  if (
    activity.kind === 'item' &&
    (activity.source === 'codex-app-server-completion' ||
      activity.title?.trim().toLowerCase() === 'reasoning') &&
    !activity.progressText?.trim()
  ) {
    // These high-volume app-server markers are intentionally hidden by chat.
    // Keep them in the final Lens snapshot for debugging, but do not spend an
    // Ames poke on every intermediate state transition.
    return false;
  }
  if (activity.kind === 'plan') {
    return true;
  }
  if (activity.kind === 'approval') {
    return (
      activity.status !== undefined &&
      SHIP_ACTIVITY_STATUSES.has(activity.status)
    );
  }
  if (
    activity.kind === 'tool' ||
    activity.kind === 'item' ||
    activity.kind === 'commentary' ||
    activity.kind === 'request_input' ||
    activity.kind === 'patch' ||
    activity.kind === 'compaction' ||
    activity.kind === 'error'
  ) {
    return (
      activity.status !== undefined &&
      SHIP_ACTIVITY_STATUSES.has(activity.status)
    );
  }
  return false;
}

function activityStateKey(activity: ContextLensActivityEvent): string {
  const itemKey =
    activity.itemId ??
    activity.toolCallId ??
    activity.name ??
    activity.title ??
    activity.kind;
  return `${activity.kind}:${itemKey}`;
}

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
  const activity = lens.activity ?? emptyContextLensActivity();
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
    activity: {
      ...activity,
      plan: activity.plan
        ? {
            ...activity.plan,
            title: truncateSummary(activity.plan.title),
            explanation: truncateSummary(activity.plan.explanation),
            steps: activity.plan.steps.map((step) => ({
              ...step,
              title: truncateSummary(step.title) ?? step.title,
            })),
          }
        : null,
      items: activity.items.map((item) => ({
        ...item,
        title: truncateSummary(item.title) ?? item.title,
        progressText: truncateSummary(item.progressText),
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
    activity: { ...slim.activity, items: [], truncated: true },
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
  /** Resolves when all debounce windows and pokes enqueued so far settle. */
  flush: () => Promise<void>;
};

type PendingShipPoke = {
  lensId: string;
  label: string;
  json: unknown;
  terminal: boolean;
};

type DebouncedShipPoke = {
  pending: PendingShipPoke;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Mirror context-lens runs to the bot ship's %steward agent (lens module),
 * which fans them out to the owner ship for durable, mobile-reachable history.
 *
 * - terminal status → finalized lens poke (`final: true`)
 * - non-terminal run and activity transitions → milestone lens pokes
 *   (`final: false`)
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
  retryDelaysMs?: readonly number[];
  nonterminalDebounceMs?: number;
}): ContextLensShipSync {
  const { owner, logger } = opts;
  const getParams = opts.getParams ?? (() => apiClientParamsSlot.get() ?? null);
  const retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const nonterminalDebounceMs =
    typeof opts.nonterminalDebounceMs === 'number' &&
    Number.isFinite(opts.nonterminalDebounceMs)
      ? Math.max(0, opts.nonterminalDebounceMs)
      : DEFAULT_NONTERMINAL_DEBOUNCE_MS;

  const lastStatusByLensId = new Map<string, ContextLensStatus>();
  const lastActivityStatusByLensId = new Map<
    string,
    Map<string, ContextLensActivityEvent['status']>
  >();
  const terminalLensIds = new Set<string>();
  let configuredFor: SharedApiClientParams | null = null;
  const pendingByLensId = new Map<string, PendingShipPoke>();
  const debouncedByLensId = new Map<string, DebouncedShipPoke>();
  const terminalOrder: string[] = [];
  const regularOrder: string[] = [];
  const flushWaiters: Array<() => void> = [];
  let draining = false;

  const deliverPoke = async (pending: PendingShipPoke) => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelaysMs[attempt - 1])
        );
      }

      const params = getParams();
      if (!params) {
        // Monitor not connected yet (or shut down); preserve the old
        // drop-without-buffering behavior when there was never a live
        // client. If a connected attempt already failed, keep retrying
        // in case the monitor republishes params during the backoff.
        if (attempt === 0) {
          return;
        }
        continue;
      }

      try {
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
          json: pending.json,
        });
        return;
      } catch (error) {
        lastError = error;
        // Re-assert ownership after either a configure or run poke fails;
        // the monitor may have reconnected between attempts.
        configuredFor = null;
      }
    }

    throw lastError ?? new Error('ship sync retry attempts exhausted');
  };

  const takePending = (): PendingShipPoke | undefined => {
    const takeFrom = (
      order: string[],
      terminal: boolean
    ): PendingShipPoke | undefined => {
      while (order.length > 0) {
        const lensId = order.shift()!;
        const pending = pendingByLensId.get(lensId);
        if (!pending || pending.terminal !== terminal) {
          continue;
        }
        pendingByLensId.delete(lensId);
        return pending;
      }
      return undefined;
    };
    return takeFrom(terminalOrder, true) ?? takeFrom(regularOrder, false);
  };

  const resolveFlushWaiters = () => {
    if (draining || pendingByLensId.size > 0 || debouncedByLensId.size > 0) {
      return;
    }
    for (const resolve of flushWaiters.splice(0)) {
      resolve();
    }
  };

  const drain = async () => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      let pending = takePending();
      while (pending) {
        try {
          await deliverPoke(pending);
        } catch (error) {
          // The next snapshot still re-asserts configuration after retries
          // are exhausted, so one bad run cannot poison the drain.
          configuredFor = null;
          logger.warn(
            `[tlon] Context lens ship sync poke failed (${pending.label}): ${String(error)}`
          );
        }
        pending = takePending();
      }
    } finally {
      draining = false;
      if (pendingByLensId.size > 0) {
        void drain();
      } else {
        resolveFlushWaiters();
      }
    }
  };

  const enqueuePoke = (pending: PendingShipPoke) => {
    const existing = pendingByLensId.get(pending.lensId);
    if (existing?.terminal && !pending.terminal) {
      return;
    }
    pendingByLensId.set(pending.lensId, pending);
    if (!existing) {
      (pending.terminal ? terminalOrder : regularOrder).push(pending.lensId);
    } else if (pending.terminal && !existing.terminal) {
      // The old regular-order entry becomes a harmless tombstone. Prioritize
      // the terminal snapshot so stale progress cannot delay chat closeout.
      terminalOrder.push(pending.lensId);
    }
    void drain();
  };

  const cancelDebouncedPoke = (lensId: string) => {
    const debounced = debouncedByLensId.get(lensId);
    if (!debounced) {
      return;
    }
    clearTimeout(debounced.timer);
    debouncedByLensId.delete(lensId);
  };

  const enqueueDebouncedPoke = (
    lensId: string,
    expected: DebouncedShipPoke
  ) => {
    if (debouncedByLensId.get(lensId) !== expected) {
      return;
    }
    debouncedByLensId.delete(lensId);
    if (!terminalLensIds.has(lensId)) {
      enqueuePoke(expected.pending);
    } else {
      resolveFlushWaiters();
    }
  };

  const debouncePoke = (pending: PendingShipPoke) => {
    if (nonterminalDebounceMs === 0) {
      enqueuePoke(pending);
      return;
    }
    const existing = debouncedByLensId.get(pending.lensId);
    if (existing) {
      // Keep the original deadline so a busy run cannot postpone ship-visible
      // progress forever; only replace the full snapshot delivered at it.
      existing.pending = pending;
      return;
    }
    const timer = setTimeout(() => {
      const expected = debouncedByLensId.get(pending.lensId);
      if (expected?.timer === timer) {
        enqueueDebouncedPoke(pending.lensId, expected);
      }
    }, nonterminalDebounceMs);
    const debounced = { pending, timer };
    debouncedByLensId.set(pending.lensId, debounced);
  };

  const flushDebouncedPokes = () => {
    const debounced = [...debouncedByLensId.entries()];
    debouncedByLensId.clear();
    for (const [lensId, entry] of debounced) {
      clearTimeout(entry.timer);
      if (!terminalLensIds.has(lensId)) {
        enqueuePoke(entry.pending);
      }
    }
  };

  const handleEvent = (event: ContextLensEvent) => {
    const lens = event.lens;
    if (lens.visibility === 'internal') {
      return;
    }
    if (TERMINAL_STATUSES.has(lens.status)) {
      if (terminalLensIds.has(lens.lensId)) {
        return;
      }
      terminalLensIds.add(lens.lensId);
      while (terminalLensIds.size > MAX_TRACKED_RUNS) {
        const oldest = terminalLensIds.values().next().value;
        if (!oldest) break;
        terminalLensIds.delete(oldest);
      }
      lastStatusByLensId.delete(lens.lensId);
      lastActivityStatusByLensId.delete(lens.lensId);
      cancelDebouncedPoke(lens.lensId);
      enqueuePoke({
        lensId: lens.lensId,
        label: `run-final ${lens.lensId}`,
        terminal: true,
        json: {
          entry: {
            id: lens.lensId,
            payload: buildLensRunPayload(lens),
            final: true,
          },
        },
      });
      return;
    }
    if (terminalLensIds.has(lens.lensId)) {
      return;
    }
    const statusChanged = lens.status !== lastStatusByLensId.get(lens.lensId);
    const activity = event.detail?.activity;
    let activityMilestone = isDurableActivityMilestone(activity);
    if (activityMilestone && activity?.kind !== 'plan') {
      const key = activityStateKey(activity!);
      const statuses =
        lastActivityStatusByLensId.get(lens.lensId) ??
        new Map<string, ContextLensActivityEvent['status']>();
      if (statuses.get(key) === activity!.status) {
        activityMilestone = false;
      } else {
        statuses.set(key, activity!.status);
        lastActivityStatusByLensId.set(lens.lensId, statuses);
      }
    }
    if (!statusChanged && !activityMilestone) {
      return;
    }
    if (statusChanged) {
      lastStatusByLensId.delete(lens.lensId);
      lastStatusByLensId.set(lens.lensId, lens.status);
      while (lastStatusByLensId.size > MAX_TRACKED_RUNS) {
        const oldest = lastStatusByLensId.keys().next().value;
        if (!oldest) {
          break;
        }
        lastStatusByLensId.delete(oldest);
        lastActivityStatusByLensId.delete(oldest);
      }
    }
    debouncePoke({
      lensId: lens.lensId,
      label: `run-event ${lens.lensId}`,
      terminal: false,
      json: {
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
    flush: () => {
      // Flush is also used during deterministic shutdown/tests. Promote the
      // latest snapshot from every live debounce window, then await the same
      // serialized retrying drain as immediately queued and terminal pokes.
      flushDebouncedPokes();
      if (
        !draining &&
        pendingByLensId.size === 0 &&
        debouncedByLensId.size === 0
      ) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        flushWaiters.push(resolve);
      });
    },
  };
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
  const sync = createContextLensShipSync({ owner, logger: api.logger });
  shipSyncUnsubscribeSlot.get()?.();
  shipSyncUnsubscribeSlot.set(subscribeToContextLensEvents(sync.handleEvent));
  api.logger.info(
    `[tlon] Context lens ship sync enabled, fanning out to ${owner}`
  );
  return true;
}
