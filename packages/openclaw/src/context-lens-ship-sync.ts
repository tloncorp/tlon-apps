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

/**
 * Build the opaque run payload poked to %context-lens, serialized to a JSON
 * string (the agent stores payloads as cords — embedding $json in Hoon mark
 * sample types breaks ford tube builds). The lens snapshot is passed
 * through with per-field truncation (tool args/results, previews) and a
 * total size cap, since the ship stores it verbatim and ames pokes should
 * stay small. Full untruncated runs remain on gateway disk (Phase 2 store).
 */
export function buildLensRunPayload(lens: ContextLens): string {
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
 * Mirror context-lens runs to the bot ship's %context-lens agent, which fans them
 * out to owner ships for durable, mobile-reachable history.
 *
 * - terminal status → `%run-final`
 * - non-terminal status transitions → `%run-event` milestones
 *
 * Pokes ride the monitor-published api-client params (the same slot the
 * gateway-status heartbeat uses). The agent's `owners` set is configured
 * lazily: once per params-slot instance, ordered before any run poke via a
 * serial queue, so monitor restarts re-assert the config.
 */
export function createContextLensShipSync(opts: {
  owners: string[];
  logger: SyncLogger;
  getParams?: () => SharedApiClientParams | null;
}): ContextLensShipSync {
  const { owners, logger } = opts;
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
            app: 'context-lens',
            mark: 'context-lens-action-1',
            json: { configure: { owners } },
          });
          configuredFor = params;
        }
        await params.poke({
          app: 'context-lens',
          mark: 'context-lens-action-1',
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
        'run-final': { id: lens.lensId, payload: buildLensRunPayload(lens) },
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
      'run-event': { id: lens.lensId, payload: buildLensRunPayload(lens) },
    });
  };

  return {
    handleEvent,
    flush: () => queue,
  };
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
  if (!resolveTlonAccount(api.config).contextLens.enabled) {
    return false;
  }
  const owners = resolveLensOwners(api.config);
  if (owners.length === 0) {
    api.logger.info(
      '[tlon] Context lens ship sync disabled: no owners configured (set contextLens.owners or ownerShip)'
    );
    return false;
  }
  const sync = createContextLensShipSync({ owners, logger: api.logger });
  shipSyncUnsubscribeSlot.get()?.();
  shipSyncUnsubscribeSlot.set(subscribeToContextLensEvents(sync.handleEvent));
  api.logger.info(
    `[tlon] Context lens ship sync enabled, fanning out to ${owners.join(', ')}`
  );
  return true;
}
