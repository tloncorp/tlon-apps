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
import { listRunnableTlonAccountIds, resolveTlonAccount } from './types.js';

const PAYLOAD_SCHEMA_VERSION = 1;
const MAX_SUMMARY_CHARS = 4_096;
const MAX_PAYLOAD_CHARS = 50 * 1_024;
const MAX_TRACKED_RUNS = 1_000;
/**
 * Bounded backoff for the post-retirement ownership re-assertion. It is the
 * only thing standing between a retired sync's in-flight %configure and the
 * former owner keeping the bot's prompt mirror, so a transient transport
 * failure must not end it.
 */
const OWNERSHIP_ASSERT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000];

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
const shipSyncUnsubscribeSlot = sharedSlot<{
  /** Stop the sync accepting events and neutralize its queued work. */
  retire: () => void;
  /** Resolves once its already-started pokes have settled. */
  flush: () => Promise<void>;
}>('contextLens.shipSync.unsubscribe');

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
  // ownerShip wins: this value is poked into %steward's SHARED core owner,
  // which now also gates prompt-edit authorization and routing — letting a
  // lens-only recipient override it would hand that ship the bot's prompts.
  // contextLens.owner remains a fallback for lens-only configs with no
  // account owner.
  const owner = account.ownerShip ? normalizeShip(account.ownerShip) : '';
  if (owner.length > 0) {
    return owner;
  }
  // The fallback only applies while the lens feature is actually on: a
  // leftover contextLens.owner in a disabled config must not become the
  // shared core owner (which would hand that ship the bot's prompts and
  // edit rights via prompt sync).
  if (!account.contextLens.enabled) {
    return null;
  }
  const configured = account.contextLens.owner
    ? normalizeShip(account.contextLens.owner)
    : '';
  return configured.length > 0 ? configured : null;
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
  /**
   * Record that this params instance already has our owner configured, so
   * the lazy configure below doesn't repeat a poke someone else just made
   * on our behalf (see the opening assertion in initContextLensShipSync).
   */
  noteConfigured: (params: SharedApiClientParams) => void;
  /** Resolves when all pokes enqueued so far have settled. */
  flush: () => Promise<void>;
  /**
   * Retire this sync: stop accepting events and neutralize work already on
   * the internal queue. Required because the queued tasks capture `owner`
   * and would otherwise be free to %configure %steward's SHARED owner with
   * it after a reload disabled the lens or pointed it at a different ship.
   */
  cancel: () => void;
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
  /**
   * Work this sync must not overlap: the queue starts chained after it.
   * Used to order a replacement behind a retired sync's in-flight
   * `%configure`, which cancellation cannot stop once the request is out —
   * if it landed after ours, %steward's SHARED owner would revert to the
   * retired sync's captured owner.
   */
  after?: Promise<void>;
}): ContextLensShipSync {
  const { owner, logger } = opts;
  const getParams = opts.getParams ?? (() => apiClientParamsSlot.get() ?? null);

  const lastStatusByLensId = new Map<string, ContextLensStatus>();
  let configuredFor: SharedApiClientParams | null = null;
  let queue: Promise<void> = opts.after
    ? opts.after.then(
        () => {},
        () => {}
      )
    : Promise.resolve();
  let cancelled = false;

  const enqueuePoke = (label: string, json: unknown) => {
    queue = queue
      .then(async () => {
        if (cancelled) {
          // Retired while this task sat on the queue. Its captured owner may
          // no longer be the configured one, and the transport it would read
          // now belongs to a replacement monitor.
          return;
        }
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
          if (cancelled) {
            // Retired while the configure was in flight. That request can't
            // be recalled, so a replacement sync orders itself after our
            // flush (see `after`) and re-asserts its own owner; don't
            // compound it by also sending this run to the old owner.
            return;
          }
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
    if (cancelled) {
      return;
    }
    const lens = event.lens;
    if (lens.visibility === 'internal') {
      return;
    }
    if (TERMINAL_STATUSES.has(lens.status)) {
      lastStatusByLensId.delete(lens.lensId);
      enqueuePoke(`run-final ${lens.lensId}`, {
        entry: {
          id: lens.lensId,
          payload: buildLensRunPayload(lens),
          final: true,
        },
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
      entry: {
        id: lens.lensId,
        payload: buildLensRunPayload(lens),
        final: false,
      },
    });
  };

  return {
    handleEvent,
    noteConfigured: (params: SharedApiClientParams) => {
      configuredFor = params;
    },
    flush: () => queue,
    cancel: () => {
      cancelled = true;
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
  // Resolve the account the process actually runs: with a sole runnable
  // NAMED account, resolving the default slot here could capture a
  // top-level contextLens.owner fallback and later reconfigure %steward's
  // SHARED owner to a ship that account never named — re-fanning its
  // prompts (and edit rights) there. With several runnable accounts the
  // default slot remains the shared-transport owner, matching the other
  // single-transport gates.
  const runnable = listRunnableTlonAccountIds(api.config);
  const accountId = runnable.length === 1 ? runnable[0] : undefined;
  // Retire any previous listener BEFORE a disabled/no-owner return: a
  // reload that turns the lens off must not leave the old closure
  // subscribed — a later lens event would %configure %steward's SHARED
  // owner with its captured former owner, handing that ship the bot's
  // prompt mirror and edit rights again.
  // Returns the retired sync's flush so a replacement can order its own
  // pokes after any request that was already in flight.
  const retirePrevious = (): Promise<void> => {
    const previous = shipSyncUnsubscribeSlot.get();
    shipSyncUnsubscribeSlot.set(null);
    if (!previous) {
      return Promise.resolve();
    }
    previous.retire();
    return previous.flush().catch(() => {});
  };

  /**
   * Retire the previous sync and, once its in-flight work settles,
   * re-assert whatever ownership the CURRENT config implies. Cancellation
   * cannot recall a %configure already sent, so on a path that installs no
   * replacement (lens disabled, or no owner resolves) a late configure
   * would otherwise be the last word — restoring the captured former owner
   * and handing it the bot's prompt mirror and edit rights again.
   *
   * The pending assertion takes the retirement slot the sync would have
   * held, so it stays part of the shared ordering chain: a later reload
   * retires it (it then stops before poking) and chains its own pokes after
   * it, instead of racing an assertion that resolved its owner from a
   * since-replaced config.
   */
  const retireAndAssertOwnership = (opts?: {
    onConfigured?: (params: SharedApiClientParams) => void;
  }): {
    assertion: Promise<void>;
    supersede: () => void;
  } => {
    const settled = retirePrevious();
    let superseded = false;
    let wake: (() => void) | null = null;
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        // A pending retry must never hold the process open at shutdown.
        timer.unref?.();
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    const assertion = (async () => {
      await settled;
      const current = resolveLensOwner(api.config, accountId);
      const json = current
        ? { configure: { owner: current } }
        : { unconfigure: null };
      let failure: unknown = 'no monitor transport available';
      for (let attempt = 0; !superseded; attempt += 1) {
        const params = apiClientParamsSlot.get();
        if (params) {
          try {
            await params.poke({
              app: 'steward',
              mark: 'steward-action-1',
              json,
            });
            opts?.onConfigured?.(params);
            return;
          } catch (error) {
            failure = error;
          }
        }
        // The retired sync's %configure may still land, so one swallowed
        // transport failure would leave the former owner configured until
        // some unrelated reconcile. Retry on a bounded backoff instead.
        if (attempt >= OWNERSHIP_ASSERT_RETRY_DELAYS_MS.length) {
          break;
        }
        await pause(OWNERSHIP_ASSERT_RETRY_DELAYS_MS[attempt]);
      }
      if (superseded) {
        // A newer init owns the ordering chain now and asserts its own state.
        return;
      }
      // Prompt sync re-asserts the same state on its next reconcile.
      api.logger.warn(
        `[tlon] Could not re-assert %steward ownership after retiring the lens sync: ${String(failure)}`
      );
    })();
    return {
      assertion,
      supersede: () => {
        superseded = true;
        wake?.();
      },
    };
  };

  /** Retire, assert, and park the assertion in the shared ordering chain. */
  const retireAndPark = (): void => {
    const { assertion, supersede } = retireAndAssertOwnership();
    shipSyncUnsubscribeSlot.set({ retire: supersede, flush: () => assertion });
  };
  if (!resolveTlonAccount(api.config, accountId).contextLens.enabled) {
    // Nothing replaces this sync, so nothing would otherwise order itself
    // after its in-flight poke — re-assert the current ownership once that
    // settles.
    retireAndPark();
    return false;
  }
  const owner = resolveLensOwner(api.config, accountId);
  if (owner === null) {
    retireAndPark();
    api.logger.info(
      '[tlon] Context lens ship sync disabled: no owner configured (set contextLens.owner or ownerShip)'
    );
    return false;
  }
  // Retire first, then assert THIS owner immediately rather than waiting
  // for a lens event: cancellation stops queued tasks but cannot recall a
  // request already sent, so a retired sync's in-flight %configure would
  // otherwise be the last word — for however long it takes the next run to
  // produce an event, and forever if none does. The new sync's queue
  // chains after that assertion for the same reason.
  let noteConfigured: (params: SharedApiClientParams) => void = () => {};
  const { assertion, supersede } = retireAndAssertOwnership({
    // Only ever called after the retirement settles, so the assignment
    // below has run by then.
    onConfigured: (params) => noteConfigured(params),
  });
  const sync = createContextLensShipSync({
    owner,
    logger: api.logger,
    after: assertion,
  });
  noteConfigured = sync.noteConfigured;
  const unsubscribe = subscribeToContextLensEvents(sync.handleEvent);
  // The slot holds a full teardown, not just the unsubscribe: dropping the
  // event handler alone leaves already-queued pokes (and the pending
  // assertion) free to run with this sync's captured owner.
  shipSyncUnsubscribeSlot.set({
    retire: () => {
      supersede();
      sync.cancel();
      unsubscribe();
    },
    // The sync's queue starts chained on the assertion, so flushing it
    // covers both.
    flush: sync.flush,
  });
  api.logger.info(
    `[tlon] Context lens ship sync enabled, fanning out to ${owner}`
  );
  return true;
}
