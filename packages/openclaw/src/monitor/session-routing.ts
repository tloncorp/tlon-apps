import { resolvePinnedMainDmOwnerFromAllowlist } from 'openclaw/plugin-sdk/conversation-runtime';
import type { OpenClawConfig, PluginRuntime } from 'openclaw/plugin-sdk/core';
import {
  type ResolvedAgentRoute,
  resolveInboundLastRouteSessionKey,
} from 'openclaw/plugin-sdk/routing';

import { canonicalizeNest, normalizeShip } from '../targets.js';

/**
 * Durable last-route update for a Tlon inbound turn. Mirrors the SDK's
 * `InboundLastRouteUpdate` shape; the monitor's record call site passes this
 * straight to `core.channel.session.recordInboundSession`, which type-checks it against the
 * real SDK type. We keep a local alias here so the pure helper has no dependency
 * on internal SDK type paths.
 *
 * NOTE: `sessionKey` here is the *last-route* session key (where the consumer
 * reads delivery state from), which is NOT necessarily the same as the
 * top-level `sessionKey` used for origin metadata. `recordInboundSession`
 * writes durable delivery state under `update.sessionKey`.
 */
export type TlonUpdateLastRoute = {
  sessionKey: string;
  channel: 'tlon';
  to: string;
  accountId?: string;
  threadId?: string | number;
  mainDmOwnerPin?: {
    ownerRecipient: string;
    senderRecipient: string;
    onSkip?: (params: {
      ownerRecipient: string;
      senderRecipient: string;
    }) => void;
  };
};

export type TlonInboundRouteInput = {
  cfg: OpenClawConfig;
  route: ResolvedAgentRoute;
  /** The finalized inbound ctx; only `SessionKey` is read. */
  ctxSessionKey?: string | null;
  isGroup: boolean;
  groupChannel?: string | null;
  senderShip: string;
  parentId?: string | number | null;
  deliverParentId?: string | number | null;
  effectiveOwnerShip?: string | null;
  effectiveDmAllowlist?: string[];
};

export type TlonInboundRouteRecord = {
  /** Session key for origin-metadata recording (`recordSessionMetaFromInbound`). */
  recordSessionKey: string;
  /** Session key the durable delivery route is written under (and read from). */
  lastRouteSessionKey: string;
  /** Provider-qualified delivery target, or null when it cannot be built. */
  target: string | null;
  /**
   * The durable route update, or `undefined` when route persistence is
   * intentionally skipped (origin metadata is still recorded by the caller).
   */
  updateLastRoute?: TlonUpdateLastRoute;
  /** Set when `updateLastRoute` is omitted, for a distinctive caller log. */
  skippedReason?:
    | 'group-missing-channel'
    | 'group-invalid-channel'
    | 'group-route-targets-main-session';
};

/**
 * Build the parameters for persisting a Tlon inbound turn's durable session
 * route. Pure: no I/O, no SDK store access. The caller passes the result to
 * `recordInboundSession` (see `recordTlonInboundRoute`).
 *
 * Routing rules:
 * - DM: persist `tlon:<senderShip>`. When the last-route session is the agent
 *   main session and a single owner is pinned, attach `mainDmOwnerPin` so a
 *   non-owner DM cannot silently overwrite the owner/main route.
 * - Group/channel: persist `tlon:<groupChannel>` only when the last-route
 *   session is NOT the main session (avoid clobbering a broad shared session).
 *   Skip — but still record origin metadata — when `groupChannel` is missing.
 */
export function buildTlonInboundRouteRecord(
  input: TlonInboundRouteInput
): TlonInboundRouteRecord {
  const {
    cfg,
    route,
    ctxSessionKey,
    isGroup,
    groupChannel,
    senderShip,
    parentId,
    deliverParentId,
    effectiveOwnerShip,
    effectiveDmAllowlist,
  } = input;

  const recordSessionKey = ctxSessionKey ?? route.sessionKey;
  const lastRouteSessionKey = resolveInboundLastRouteSessionKey({
    route,
    sessionKey: recordSessionKey,
  });

  const rawThread = deliverParentId ?? parentId;
  const threadId =
    rawThread != null && rawThread !== '' ? String(rawThread) : undefined;

  const base = { recordSessionKey, lastRouteSessionKey };

  if (isGroup) {
    const nest = groupChannel?.trim();
    if (!nest) {
      return { ...base, target: null, skippedReason: 'group-missing-channel' };
    }
    // Validate/canonicalize the nest before storing. Firehose nests are already
    // canonical, but config/settings-watched values can be malformed; a bad
    // nest would otherwise persist an unusable `lastTo`.
    const canonicalNest = canonicalizeNest(nest);
    if (!canonicalNest) {
      return { ...base, target: null, skippedReason: 'group-invalid-channel' };
    }
    const target = `tlon:${canonicalNest}`;
    // Don't overwrite a broad shared main session with a per-group route.
    if (lastRouteSessionKey === route.mainSessionKey) {
      return {
        ...base,
        target,
        skippedReason: 'group-route-targets-main-session',
      };
    }
    return {
      ...base,
      target,
      updateLastRoute: {
        sessionKey: lastRouteSessionKey,
        channel: 'tlon',
        to: target,
        ...(route.accountId ? { accountId: route.accountId } : {}),
        ...(threadId !== undefined ? { threadId } : {}),
      },
    };
  }

  // DM
  const target = `tlon:${senderShip}`;
  const mainDmOwnerPin = resolveMainDmOwnerPin({
    cfg,
    route,
    lastRouteSessionKey,
    senderShip,
    effectiveOwnerShip,
    effectiveDmAllowlist,
  });

  return {
    ...base,
    target,
    updateLastRoute: {
      sessionKey: lastRouteSessionKey,
      channel: 'tlon',
      to: target,
      ...(route.accountId ? { accountId: route.accountId } : {}),
      ...(threadId !== undefined ? { threadId } : {}),
      ...(mainDmOwnerPin ? { mainDmOwnerPin } : {}),
    },
  };
}

function resolveMainDmOwnerPin(params: {
  cfg: OpenClawConfig;
  route: ResolvedAgentRoute;
  lastRouteSessionKey: string;
  senderShip: string;
  effectiveOwnerShip?: string | null;
  effectiveDmAllowlist?: string[];
}): TlonUpdateLastRoute['mainDmOwnerPin'] | undefined {
  const {
    cfg,
    route,
    lastRouteSessionKey,
    senderShip,
    effectiveOwnerShip,
    effectiveDmAllowlist,
  } = params;

  // Only the main session can be clobbered by another DM sender; isolated
  // per-peer sessions need no pin.
  if (lastRouteSessionKey !== route.mainSessionKey) {
    return undefined;
  }

  const sender = senderShip.trim();
  if (!sender) {
    return undefined;
  }

  // Tlon's configured owner (`ownerShip`) is separate from `dmAllowlist`, and
  // owner DMs are valid even when the owner isn't allowlisted. Prefer pinning
  // the configured owner; otherwise fall back to the SDK's allowlist semantics
  // (which only pin when there is exactly one allowed sender).
  const pinnedOwner = resolvePinnedMainDmOwnerFromAllowlist({
    dmScope: cfg.session?.dmScope,
    allowFrom: effectiveOwnerShip ? [effectiveOwnerShip] : effectiveDmAllowlist,
    normalizeEntry: normalizeShip,
  });
  if (!pinnedOwner) {
    return undefined;
  }

  return {
    ownerRecipient: pinnedOwner,
    senderRecipient: normalizeShip(sender),
  };
}

/**
 * The slice of `core.channel.session` used by `recordTlonInboundRoute`. Typed
 * from the SDK runtime so the call site validates our `updateLastRoute` shape
 * against the real `InboundLastRouteUpdate` (e.g. that `channel: 'tlon'` and the
 * pin shape are accepted).
 */
type SessionRecorder = Pick<
  PluginRuntime['channel']['session'],
  'recordInboundSession'
>;
type RecordInboundCtx = Parameters<
  SessionRecorder['recordInboundSession']
>[0]['ctx'];

/**
 * Persist a Tlon inbound turn's session route. Always records origin metadata
 * (even when `record.updateLastRoute` is omitted) and fails open: a persistence
 * failure is logged but never blocks the live reply.
 */
export async function recordTlonInboundRoute(deps: {
  session: SessionRecorder;
  storePath: string;
  ctxPayload: RecordInboundCtx;
  record: TlonInboundRouteRecord;
  messageId?: string;
  accountId?: string;
  logError?: (msg: string) => void;
  logDebug?: (msg: string) => void;
}): Promise<void> {
  const { session, storePath, ctxPayload, record, messageId, accountId } = deps;

  if (
    record.skippedReason === 'group-missing-channel' ||
    record.skippedReason === 'group-invalid-channel'
  ) {
    // Anomalous (a group turn with no/malformed channel nest); surface outside
    // debug too.
    deps.logError?.(
      `[tlon] route persistence skipped (${record.skippedReason}): ` +
        `messageId=${messageId ?? '?'} lastRouteSessionKey=${record.lastRouteSessionKey}`
    );
  } else if (record.skippedReason) {
    // Normal policy outcome (e.g. a group route that targets the shared main
    // session); debug-only to avoid high-volume logs for an expected case.
    deps.logDebug?.(
      `[tlon] route persistence skipped (${record.skippedReason}): ` +
        `messageId=${messageId ?? '?'} lastRouteSessionKey=${record.lastRouteSessionKey} ` +
        `target=${record.target ?? '(none)'}`
    );
  }

  // When a main-session DM is pinned to an owner, the SDK skips the durable
  // route update for a non-owner sender. Wire an onSkip so that decision is
  // observable instead of silently looking like a successful write.
  const pin = record.updateLastRoute?.mainDmOwnerPin;
  const updateLastRoute: TlonUpdateLastRoute | undefined =
    record.updateLastRoute
      ? {
          ...record.updateLastRoute,
          ...(pin
            ? {
                mainDmOwnerPin: {
                  ...pin,
                  onSkip: ({ ownerRecipient, senderRecipient }) =>
                    deps.logDebug?.(
                      `[tlon] durable route update skipped by owner pin: ` +
                        `messageId=${messageId ?? '?'} owner=${ownerRecipient} ` +
                        `sender=${senderRecipient} lastRouteSessionKey=${record.lastRouteSessionKey}`
                    ),
                },
              }
            : {}),
        }
      : undefined;

  try {
    await session.recordInboundSession({
      storePath,
      sessionKey: record.recordSessionKey,
      ctx: ctxPayload,
      updateLastRoute,
      onRecordError: (err) => {
        deps.logError?.(`[tlon] failed updating session meta: ${String(err)}`);
      },
    });
  } catch (err) {
    deps.logError?.(
      `[tlon] failed recording inbound session route: ${String(err)} ` +
        `(messageId=${messageId ?? '?'} storePath=${storePath} ` +
        `recordSessionKey=${record.recordSessionKey} ` +
        `lastRouteSessionKey=${record.lastRouteSessionKey} ` +
        `target=${record.target ?? '(none)'} accountId=${accountId ?? '(none)'} ` +
        `hadUpdateLastRoute=${Boolean(record.updateLastRoute)})`
    );
  }
}

/**
 * Whether the SDK will skip the durable route update because a main-session DM
 * is pinned to an owner different from the sender. A built `updateLastRoute`
 * does not guarantee a write, so diagnostics should report this rather than
 * imply the route was persisted.
 */
export function routeUpdateWillSkipByPin(
  update?: TlonUpdateLastRoute
): boolean {
  const pin = update?.mainDmOwnerPin;
  if (!pin) {
    return false;
  }
  return pin.ownerRecipient !== pin.senderRecipient;
}

/**
 * Run the durable route-record step before reply dispatch. The bug this fixes
 * lives at exactly this boundary: route-dependent sends that happen during
 * dispatch must observe the persisted route, so recording must complete first.
 * Keeping this ordering in one place gives the monitor a testable guard.
 */
export async function recordRouteThenDispatch<T>(steps: {
  record: () => Promise<void>;
  dispatch: () => Promise<T>;
}): Promise<T> {
  await steps.record();
  return steps.dispatch();
}

/**
 * The monitor's "build ctx → record route → dispatch" boundary, as a single
 * testable unit (this is where the original webchat-leak bug lived). Builds the
 * Tlon route record, persists it, and only then runs `dispatch`. The monitor
 * delegates its entire record+dispatch to this so the ordering is covered by a
 * unit test rather than only by the monitor's structure.
 */
export async function recordTlonRouteAndDispatch<T>(params: {
  session: Pick<
    PluginRuntime['channel']['session'],
    'recordInboundSession' | 'resolveStorePath'
  >;
  cfg: OpenClawConfig;
  route: ResolvedAgentRoute;
  ctxPayload: RecordInboundCtx;
  ctxSessionKey?: string | null;
  isGroup: boolean;
  groupChannel?: string | null;
  senderShip: string;
  parentId?: string | number | null;
  deliverParentId?: string | number | null;
  effectiveOwnerShip?: string | null;
  effectiveDmAllowlist?: string[];
  messageId?: string;
  sessionStore?: string;
  logError?: (msg: string) => void;
  logDebug?: (msg: string) => void;
  /** Called with the built record, before persistence (used for debug logging). */
  onRecord?: (record: TlonInboundRouteRecord) => void;
  dispatch: () => Promise<T>;
}): Promise<T> {
  const record = buildTlonInboundRouteRecord({
    cfg: params.cfg,
    route: params.route,
    ctxSessionKey: params.ctxSessionKey,
    isGroup: params.isGroup,
    groupChannel: params.groupChannel,
    senderShip: params.senderShip,
    parentId: params.parentId,
    deliverParentId: params.deliverParentId,
    effectiveOwnerShip: params.effectiveOwnerShip,
    effectiveDmAllowlist: params.effectiveDmAllowlist,
  });
  params.onRecord?.(record);

  return recordRouteThenDispatch({
    // Fail open across the *entire* persistence step — including
    // resolveStorePath, which can throw on bad session-store config — so a
    // persistence failure never suppresses the live Tlon reply.
    record: async () => {
      let storePath: string;
      try {
        storePath = params.session.resolveStorePath(params.sessionStore, {
          agentId: params.route.agentId,
        });
      } catch (err) {
        params.logError?.(
          `[tlon] failed resolving session store path: ${String(err)} ` +
            `(messageId=${params.messageId ?? '?'})`
        );
        return;
      }
      await recordTlonInboundRoute({
        session: params.session,
        storePath,
        ctxPayload: params.ctxPayload,
        record,
        messageId: params.messageId,
        accountId: params.route.accountId,
        logError: params.logError,
        logDebug: params.logDebug,
      });
    },
    dispatch: params.dispatch,
  });
}

/**
 * Build a Tlon `deliveryContext` for an enqueued system event (reactions,
 * group-join notices). System-event turns resolve delivery from the event's
 * `deliveryContext` or the session store; attaching this ensures a later
 * system/heartbeat turn driven by the event routes to Tlon instead of falling
 * back to webchat, even on a session that hasn't persisted an inbound route yet.
 * `to` is the provider-qualified target (`tlon:~ship` for DMs, `tlon:<nest>` for
 * channels), matching `OriginatingTo` and the durable route.
 */
export function tlonDeliveryContext(
  to: string,
  accountId?: string
): { channel: 'tlon'; to: string; accountId?: string } {
  return { channel: 'tlon', to, ...(accountId ? { accountId } : {}) };
}

/** Route-debug gate: enabled via `TLON_OPENCLAW_ROUTE_DEBUG=1`. */
export function isRouteDebugEnabled(): boolean {
  return process.env.TLON_OPENCLAW_ROUTE_DEBUG === '1';
}
