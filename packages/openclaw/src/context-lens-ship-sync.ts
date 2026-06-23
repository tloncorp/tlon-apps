import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

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

const TERMINAL_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'completed',
  'no_reply',
  'timed_out',
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
  // Still oversized (e.g. hundreds of tool runs): drop the bulky arrays but
  // keep the run's identity, status, and timings inspectable.
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
}): ContextLensShipSync {
  const { owner, logger } = opts;
  const getParams = opts.getParams ?? (() => apiClientParamsSlot.get() ?? null);

  const lastStatusByLensId = new Map<string, ContextLensStatus>();
  let configuredFor: SharedApiClientParams | null = null;
  let queue: Promise<void> = Promise.resolve();

  const enqueuePoke = (label: string, json: unknown) => {
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
      enqueuePoke(`run-final ${lens.lensId}`, {
        id: lens.lensId,
        payload: buildLensRunPayload(lens),
        final: true,
      });
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
      id: lens.lensId,
      payload: buildLensRunPayload(lens),
      final: false,
    });
  };

  return {
    handleEvent,
    flush: () => queue,
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
