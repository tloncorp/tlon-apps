import { createHash, randomUUID } from 'node:crypto';

import { sharedMap, sharedSlot } from './shared-state.js';

export type ContextLensTrigger =
  | 'cron'
  | 'dm'
  | 'mention'
  | 'thread'
  | 'reaction'
  | 'owner-listen'
  | 'owner-blob'
  | 'summarization'
  | 'tool'
  | 'retry'
  | 'unknown';

export type ContextLensRunKind =
  | 'conversation'
  | 'cron'
  | 'owner_listen'
  | 'summarization'
  | 'internal';

export type ContextLensVisibility = 'owner' | 'participants' | 'internal';

export type ContextLensStatus =
  | 'assembling'
  | 'queued'
  | 'dispatching'
  | 'tool_running'
  | 'delivering'
  | 'completed'
  | 'no_reply'
  | 'timed_out'
  | 'aborted'
  | 'error';

export type ContextLensTriggerDetails = {
  type: ContextLensTrigger;
  messageId: string;
  authorShip?: string;
  conversationId?: string;
  conversationKind: 'dm' | 'channel' | 'internal';
  receivedAt?: number;
  preview?: string;
};

/**
 * Snapshot of the original dispatch inputs, captured at lens creation so an
 * owner-requested retry can re-dispatch the message faithfully. Gateway-only:
 * stripped from ship-sync payloads (chat content the owner can already read,
 * and pokes must stay small) but persisted in the JSONL store so retries
 * survive gateway restarts.
 */
export type ContextLensRetrySeed = {
  messageText: string;
  blobField?: string | null;
  parentId?: string | null;
  isThreadReply?: boolean;
  replyParentId?: string | null;
  cachesHistory?: boolean;
};

export type ContextLensSourceKind =
  | 'message'
  | 'memory'
  | 'identity'
  | 'system'
  | 'tool_result'
  | 'other';

export type ContextLensSource = {
  kind: ContextLensSourceKind;
  label: string;
  sourceId?: string;
  included: boolean;
  reason?: string;
  tokenEstimate?: number;
  preview?: string;
};

export type ContextLensToolRun = {
  id: string;
  toolCallId?: string;
  callIndex: number;
  name: string;
  phase?: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'error' | 'blocked';
  argumentSummary?: string;
  argumentDetail?: string;
  resultSummary?: string;
  error?: string;
};

export type ContextLensOutput = {
  messageId: string;
  conversationId: string;
  kind: 'dm' | 'channel';
  sentAt: number;
  preview?: string;
  chunkIndex?: number;
};

export type ContextLensPersistenceEvent = {
  kind: 'memory' | 'conversation_state' | 'tool_cache' | 'artifact' | 'other';
  action: 'read' | 'created' | 'updated' | 'skipped' | 'deleted';
  location: 'openclaw' | 'urbit' | 'tlon-desk' | 'external';
  status: 'ok' | 'failed' | 'skipped';
  key?: string;
  reason?: string;
  at: number;
};

export type ContextLens = {
  lensId: string;
  messageId: string;
  sessionKeyHash: string | null;
  chatType: 'dm' | 'channel' | 'internal';
  runKind: ContextLensRunKind;
  visibility: ContextLensVisibility;
  trigger: ContextLensTrigger;
  triggerDetails: ContextLensTriggerDetails;
  /** lensId of the run this one retries, when trigger is "retry". */
  retryOf?: string;
  retrySeed?: ContextLensRetrySeed;
  model: string | null;
  provider: string | null;
  context: {
    currentMessage: boolean;
    threadMessages: number;
    channelMessages: number;
    citedPosts: number;
    attachments: number;
    pendingNudge: boolean;
    sources: ContextLensSource[];
  };
  persistence: {
    postsReply: boolean;
    updatesSettings: boolean;
    writesMedia: boolean;
    emitsTelemetry: boolean;
    cachesHistory: boolean;
    events: ContextLensPersistenceEvent[];
  };
  tools: {
    ownerOnlyAvailable: string[];
    called: string[];
    callCount: number;
    lastStartedAt: number | null;
    runs: ContextLensToolRun[];
  };
  outputs: ContextLensOutput[];
  lifecycle: {
    queuedAt: number | null;
    queuedMs: number;
    dispatchStartedAt: number | null;
    firstToolStartedAt: number | null;
    completedAt: number | null;
    durationMs: number | null;
    timeoutMs: number | null;
    timedOut: boolean;
    deliveredMessageCount: number;
    queuedFinal: boolean;
    queuedFinalCount: number;
    queuedBlockCount: number;
  };
  status: ContextLensStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type CreateContextLensInput = {
  messageId: string;
  chatType: ContextLens['chatType'];
  runKind?: ContextLensRunKind;
  visibility?: ContextLensVisibility;
  trigger?: ContextLensTrigger;
  sessionKey?: string | null;
  senderShip?: string;
  conversationId?: string;
  receivedAt?: number;
  preview?: string;
  retryOf?: string;
  retrySeed?: ContextLensRetrySeed;
  now?: number;
  ttlMs?: number;
};

/**
 * Patch shape for registry update(): top-level fields are optional, and the
 * nested objects may themselves be partial because update() deep-merges them
 * over the existing lens.
 */
export type ContextLensPatch = Partial<
  Omit<
    ContextLens,
    'context' | 'persistence' | 'tools' | 'triggerDetails' | 'lifecycle'
  >
> & {
  context?: Partial<ContextLens['context']>;
  persistence?: Partial<ContextLens['persistence']>;
  tools?: Partial<ContextLens['tools']>;
  triggerDetails?: Partial<ContextLens['triggerDetails']>;
  lifecycle?: Partial<ContextLens['lifecycle']>;
};

export type ContextLensRegistry = ReturnType<typeof createContextLensRegistry>;

type ActiveContextLensBinding = {
  registry: ContextLensRegistry;
  lensId: string;
  background: boolean;
  finalizeTimer?: ReturnType<typeof setTimeout>;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_LENSES = 200;
const MAX_RETRY_SEED_TEXT_CHARS = 16_384;
const MAX_RETRY_SEED_BLOB_CHARS = 8_192;
// Long enough for the gateway to deliver the run's reply (cron DMs etc.)
// after the last tool result, so the outbound stamp/output land on the lens
// before it finalizes.
const BACKGROUND_FINALIZE_IDLE_MS = 30_000;
const activeLensesBySession = sharedMap<string, ActiveContextLensBinding>(
  'contextLens.activeLensesBySession'
);
const backgroundContextLensesSlot = sharedSlot<ContextLensRegistry>(
  'contextLens.backgroundRegistry'
);

export function hashSessionKey(sessionKey: string): string {
  return createHash('sha256').update(sessionKey).digest('hex').slice(0, 16);
}

function defaultRunKind(
  trigger: ContextLensTrigger | undefined,
  chatType: ContextLens['chatType']
): ContextLensRunKind {
  if (trigger === 'cron') {
    return 'cron';
  }
  if (trigger === 'owner-listen' || trigger === 'owner-blob') {
    return 'owner_listen';
  }
  if (trigger === 'summarization') {
    return 'summarization';
  }
  if (chatType === 'internal') {
    return 'internal';
  }
  return 'conversation';
}

function cloneLens(lens: ContextLens): ContextLens {
  return {
    ...lens,
    context: {
      ...lens.context,
      sources: lens.context.sources.map((source) => ({ ...source })),
    },
    persistence: {
      ...lens.persistence,
      events: lens.persistence.events.map((event) => ({ ...event })),
    },
    tools: {
      ownerOnlyAvailable: [...lens.tools.ownerOnlyAvailable],
      called: [...lens.tools.called],
      callCount: lens.tools.callCount,
      lastStartedAt: lens.tools.lastStartedAt,
      runs: lens.tools.runs.map((run) => ({ ...run })),
    },
    outputs: lens.outputs.map((output) => ({ ...output })),
    lifecycle: { ...lens.lifecycle },
    triggerDetails: { ...lens.triggerDetails },
    ...(lens.retrySeed ? { retrySeed: { ...lens.retrySeed } } : {}),
  };
}

function capRetrySeed(seed: ContextLensRetrySeed): ContextLensRetrySeed {
  const capped: ContextLensRetrySeed = {
    ...seed,
    messageText: seed.messageText.slice(0, MAX_RETRY_SEED_TEXT_CHARS),
  };
  // A truncated blob would be unparseable JSON — drop it instead.
  if (
    typeof seed.blobField === 'string' &&
    seed.blobField.length > MAX_RETRY_SEED_BLOB_CHARS
  ) {
    delete capped.blobField;
  }
  return capped;
}

export const RETRYABLE_STATUSES: ReadonlySet<ContextLensStatus> = new Set([
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

export type RetryDispatch = {
  messageId: string;
  senderShip: string;
  messageText: string;
  blobField?: string | null;
  isGroup: boolean;
  channelNest?: string;
  parentId?: string | null;
  isThreadReply?: boolean;
  replyParentId?: string | null;
  cachesHistory?: boolean;
  /** True when dispatching from the truncated preview because the run predates retrySeed. */
  degraded: boolean;
};

export type RetryDispatchResult =
  | { ok: true; dispatch: RetryDispatch }
  | { ok: false; reason: string };

/**
 * Reconstruct processMessage params from a finalized lens so an owner can
 * re-run it. Pure eligibility + mapping; the caller owns dedup and dispatch.
 */
export function buildRetryDispatch(lens: ContextLens): RetryDispatchResult {
  if (!RETRYABLE_STATUSES.has(lens.status)) {
    return { ok: false, reason: `status ${lens.status} is not retryable` };
  }
  if (
    lens.triggerDetails.conversationKind === 'internal' ||
    lens.runKind === 'internal'
  ) {
    return { ok: false, reason: 'internal runs cannot be retried' };
  }
  const senderShip = lens.triggerDetails.authorShip;
  if (!senderShip) {
    return { ok: false, reason: 'original run has no author ship' };
  }
  const isGroup = lens.triggerDetails.conversationKind === 'channel';
  const conversationId = lens.triggerDetails.conversationId;
  if (isGroup && !conversationId) {
    return { ok: false, reason: 'channel run has no conversation id' };
  }
  const seed = lens.retrySeed;
  const messageText = seed?.messageText ?? lens.triggerDetails.preview ?? '';
  if (!messageText.trim()) {
    return { ok: false, reason: 'no message text available to retry' };
  }
  return {
    ok: true,
    dispatch: {
      messageId: lens.messageId,
      senderShip,
      messageText,
      blobField: seed?.blobField ?? null,
      isGroup,
      ...(isGroup && conversationId ? { channelNest: conversationId } : {}),
      parentId: seed?.parentId ?? null,
      isThreadReply: seed?.isThreadReply ?? false,
      replyParentId: seed?.replyParentId ?? null,
      cachesHistory: seed?.cachesHistory ?? true,
      degraded: !seed,
    },
  };
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

export function createContextLensRegistry(
  opts: {
    ttlMs?: number;
    maxEntries?: number;
    visibilityDefault?: ContextLensVisibility;
    disabled?: boolean;
  } = {}
) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = opts.maxEntries ?? MAX_LENSES;
  const visibilityDefault = opts.visibilityDefault ?? 'owner';
  const disabled = opts.disabled ?? false;
  const lenses = new Map<string, ContextLens>();

  const prune = (now = Date.now()) => {
    for (const [lensId, lens] of lenses) {
      if (lens.expiresAt <= now) {
        lenses.delete(lensId);
      }
    }

    while (lenses.size > maxEntries) {
      const oldest = lenses.keys().next().value;
      if (!oldest) {
        break;
      }
      lenses.delete(oldest);
    }
  };

  const create = (input: CreateContextLensInput): ContextLens => {
    const now = input.now ?? Date.now();
    prune(now);

    const lens: ContextLens = {
      lensId: randomUUID(),
      messageId: input.messageId,
      sessionKeyHash: input.sessionKey
        ? hashSessionKey(input.sessionKey)
        : null,
      chatType: input.chatType,
      runKind: input.runKind ?? defaultRunKind(input.trigger, input.chatType),
      visibility: input.visibility ?? visibilityDefault,
      trigger: input.trigger ?? 'unknown',
      triggerDetails: {
        type: input.trigger ?? 'unknown',
        messageId: input.messageId,
        ...(input.senderShip ? { authorShip: input.senderShip } : {}),
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : {}),
        conversationKind: input.chatType,
        ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
        ...(input.preview ? { preview: input.preview } : {}),
      },
      ...(input.retryOf ? { retryOf: input.retryOf } : {}),
      ...(input.retrySeed ? { retrySeed: capRetrySeed(input.retrySeed) } : {}),
      model: null,
      provider: null,
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
        sources: [
          {
            kind: 'message',
            label: 'Current message',
            sourceId: input.messageId,
            included: true,
            reason: 'trigger',
            ...(input.preview ? { preview: input.preview } : {}),
          },
        ],
      },
      persistence: {
        postsReply: false,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: false,
        events: [],
      },
      tools: {
        ownerOnlyAvailable: [],
        called: [],
        callCount: 0,
        lastStartedAt: null,
        runs: [],
      },
      outputs: [],
      lifecycle: {
        queuedAt: null,
        queuedMs: 0,
        dispatchStartedAt: null,
        firstToolStartedAt: null,
        completedAt: null,
        durationMs: null,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 0,
        queuedFinal: false,
        queuedFinalCount: 0,
        queuedBlockCount: 0,
      },
      status: 'assembling',
      error: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + (input.ttlMs ?? ttlMs),
    };

    // When disabled, hand back a lens without storing it: every later
    // get()/update()/record*() misses the map and no-ops, so call sites
    // need no enabled checks of their own.
    if (!disabled) {
      lenses.set(lens.lensId, lens);
      prune(now);
    }
    return cloneLens(lens);
  };

  const update = (
    lensId: string | null | undefined,
    patch: ContextLensPatch
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }

    const next: ContextLens = {
      ...existing,
      ...patch,
      context: { ...existing.context, ...patch.context },
      persistence: { ...existing.persistence, ...patch.persistence },
      tools: { ...existing.tools, ...patch.tools },
      outputs: patch.outputs ?? existing.outputs,
      triggerDetails: { ...existing.triggerDetails, ...patch.triggerDetails },
      lifecycle: { ...existing.lifecycle, ...patch.lifecycle },
      updatedAt: patch.updatedAt ?? Date.now(),
    };
    lenses.set(lensId, next);
    return cloneLens(next);
  };

  const setStatus = (
    lensId: string | null | undefined,
    status: ContextLensStatus,
    error?: unknown
  ) =>
    update(lensId, {
      status,
      ...(error === undefined ? {} : { error: serializeError(error) }),
    });

  const recordContext = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['context']>
  ) => update(lensId, { context: patch });

  const recordPersistence = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['persistence']>
  ) => update(lensId, { persistence: patch });

  const recordContextSource = (
    lensId: string | null | undefined,
    source: ContextLensSource
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const existingIndex = existing.context.sources.findIndex(
      (item) =>
        item.kind === source.kind &&
        item.label === source.label &&
        (item.sourceId ?? '') === (source.sourceId ?? '')
    );
    const sources =
      existingIndex >= 0
        ? existing.context.sources.map((item, index) =>
            index === existingIndex ? { ...item, ...source } : item
          )
        : [...existing.context.sources, source];
    return update(lensId, {
      context: {
        ...existing.context,
        sources,
      },
    });
  };

  const recordPersistenceEvent = (
    lensId: string | null | undefined,
    event: Omit<ContextLensPersistenceEvent, 'at'> & { at?: number }
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    return update(lensId, {
      persistence: {
        ...existing.persistence,
        events: [
          ...existing.persistence.events,
          { ...event, at: event.at ?? Date.now() },
        ],
      },
    });
  };

  const recordLifecycle = (
    lensId: string | null | undefined,
    patch: Partial<ContextLens['lifecycle']>
  ) => update(lensId, { lifecycle: patch as ContextLens['lifecycle'] });

  const recordToolCall = (
    lensId: string | null | undefined,
    toolName: string,
    detail: {
      phase?: string;
      argumentSummary?: string;
      argumentDetail?: string;
      toolCallId?: string;
    } = {}
  ) => {
    if (!lensId || !toolName) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    if (
      detail.toolCallId &&
      existing.tools.runs.some((run) => run.toolCallId === detail.toolCallId)
    ) {
      return cloneLens(existing);
    }
    const now = Date.now();
    const called = existing.tools.called.includes(toolName)
      ? existing.tools.called
      : [...existing.tools.called, toolName];
    const callIndex = existing.tools.callCount + 1;
    return update(lensId, {
      tools: {
        ...existing.tools,
        called,
        callCount: callIndex,
        lastStartedAt: now,
        runs: [
          ...existing.tools.runs,
          {
            id: detail.toolCallId ?? `${toolName}-${callIndex}`,
            ...(detail.toolCallId ? { toolCallId: detail.toolCallId } : {}),
            callIndex,
            name: toolName,
            ...(detail.phase ? { phase: detail.phase } : {}),
            startedAt: now,
            completedAt: null,
            durationMs: null,
            status: 'running',
            ...(detail.argumentSummary
              ? { argumentSummary: detail.argumentSummary }
              : {}),
            ...(detail.argumentDetail
              ? { argumentDetail: detail.argumentDetail }
              : {}),
          },
        ],
      },
      lifecycle: {
        ...existing.lifecycle,
        firstToolStartedAt: existing.lifecycle.firstToolStartedAt ?? now,
      },
    });
  };

  const completeOpenToolRuns = (
    lensId: string | null | undefined,
    status: ContextLensToolRun['status'] = 'completed',
    error?: unknown
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const now = Date.now();
    return update(lensId, {
      tools: {
        ...existing.tools,
        runs: existing.tools.runs.map((run) =>
          run.completedAt
            ? run
            : {
                ...run,
                completedAt: now,
                durationMs: now - run.startedAt,
                status,
                ...(error === undefined
                  ? {}
                  : { error: serializeError(error) }),
              }
        ),
      },
    });
  };

  const completeToolRun = (
    lensId: string | null | undefined,
    toolName: string,
    detail: {
      durationMs?: number;
      error?: unknown;
      resultSummary?: string;
      status?: ContextLensToolRun['status'];
      toolCallId?: string;
    } = {}
  ) => {
    if (!lensId || !toolName) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    const now = Date.now();
    let completed = false;
    const hasToolCallIdMatch = detail.toolCallId
      ? existing.tools.runs.some(
          (run) => !run.completedAt && run.toolCallId === detail.toolCallId
        )
      : false;
    const runs = existing.tools.runs.map((run) => {
      const matchesToolCallId =
        hasToolCallIdMatch && run.toolCallId === detail.toolCallId;
      const matchesFallbackName = !hasToolCallIdMatch && run.name === toolName;
      if (
        completed ||
        run.completedAt ||
        (!matchesToolCallId && !matchesFallbackName)
      ) {
        return run;
      }
      completed = true;
      const durationMs =
        typeof detail.durationMs === 'number'
          ? detail.durationMs
          : now - run.startedAt;
      const status: ContextLensToolRun['status'] =
        detail.status ?? (detail.error === undefined ? 'completed' : 'error');
      return {
        ...run,
        completedAt: now,
        durationMs,
        status,
        ...(detail.resultSummary
          ? { resultSummary: detail.resultSummary }
          : {}),
        ...(detail.error === undefined
          ? {}
          : { error: serializeError(detail.error) }),
      };
    });
    if (!completed) {
      return null;
    }
    const nextStatus =
      existing.status === 'tool_running' &&
      !runs.some((run) => run.status === 'running')
        ? 'dispatching'
        : existing.status;
    return update(lensId, {
      status: nextStatus,
      tools: {
        ...existing.tools,
        runs,
      },
    });
  };

  const recordOutput = (
    lensId: string | null | undefined,
    output: ContextLensOutput
  ) => {
    if (!lensId) {
      return null;
    }
    const existing = lenses.get(lensId);
    if (!existing) {
      return null;
    }
    return update(lensId, {
      outputs: [...existing.outputs, output],
    });
  };

  return {
    create,
    update,
    setStatus,
    recordContext,
    recordContextSource,
    recordPersistence,
    recordPersistenceEvent,
    recordLifecycle,
    recordToolCall,
    completeToolRun,
    completeOpenToolRuns,
    recordOutput,
    get: (lensId: string) => {
      prune();
      const lens = lenses.get(lensId);
      return lens ? cloneLens(lens) : null;
    },
    listRecent: () => {
      prune();
      return [...lenses.values()]
        .toSorted((a, b) => b.createdAt - a.createdAt)
        .map(cloneLens);
    },
    destroy: (lensId: string) => lenses.delete(lensId),
    clear: () => lenses.clear(),
    prune,
  };
}

export type ContextLensSessionKeys =
  | string
  | readonly string[]
  | null
  | undefined;

function normalizeSessionKeys(sessionKeys: ContextLensSessionKeys): string[] {
  const list =
    typeof sessionKeys === 'string' ? [sessionKeys] : sessionKeys ?? [];
  return [
    ...new Set(list.map((key) => key.trim()).filter((key) => key.length > 0)),
  ];
}

/**
 * Hook session keys can differ from the bound key in two ways: core hands
 * tool hooks the per-peer key form regardless of the configured dmScope
 * (callers bind under every form to cover that), and thread sessions append
 * a `:thread:<id>` suffix that was never bound. Fall back to the thread's
 * parent key on a miss.
 */
function resolveActiveBinding(
  sessionKey: string | null | undefined
): { key: string; binding: ActiveContextLensBinding } | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const direct = activeLensesBySession.get(key);
  if (direct) {
    return { key, binding: direct };
  }
  const threadIndex = key.indexOf(':thread:');
  if (threadIndex > 0) {
    const parentKey = key.slice(0, threadIndex);
    const binding = activeLensesBySession.get(parentKey);
    if (binding) {
      return { key: parentKey, binding };
    }
  }
  return null;
}

export function bindContextLensToSession(
  sessionKeys: ContextLensSessionKeys,
  registry: ContextLensRegistry,
  lensId: string
): void {
  for (const key of normalizeSessionKeys(sessionKeys)) {
    activeLensesBySession.set(key, { registry, lensId, background: false });
  }
}

export function unbindContextLensFromSession(
  sessionKeys: ContextLensSessionKeys,
  lensId: string
): void {
  for (const key of normalizeSessionKeys(sessionKeys)) {
    const binding = activeLensesBySession.get(key);
    if (binding?.lensId === lensId) {
      if (binding.finalizeTimer) {
        clearTimeout(binding.finalizeTimer);
      }
      activeLensesBySession.delete(key);
    }
  }
}

function getBackgroundContextLensRegistry(): ContextLensRegistry {
  const existing = backgroundContextLensesSlot.get();
  if (existing) {
    return existing;
  }
  const registry = createContextLensRegistry();
  backgroundContextLensesSlot.set(registry);
  return registry;
}

export function ensureBackgroundContextLensForSession(
  sessionKey: string | null | undefined,
  input: {
    runKind?: ContextLensRunKind;
    trigger?: ContextLensTrigger;
    preview?: string;
  } = {}
): { lens: ContextLens; created: boolean } | null {
  const key = sessionKey?.trim();
  if (!key) {
    return null;
  }
  const resolved = resolveActiveBinding(key);
  if (resolved) {
    const existing = resolved.binding;
    if (existing.finalizeTimer) {
      clearTimeout(existing.finalizeTimer);
      const cleared = { ...existing };
      delete cleared.finalizeTimer;
      activeLensesBySession.set(resolved.key, cleared);
    }
    const lens = existing.registry.get(existing.lensId);
    return lens ? { lens, created: false } : null;
  }

  const registry = getBackgroundContextLensRegistry();
  const sessionKeyHash = hashSessionKey(key);
  const runKind = input.runKind ?? 'internal';
  const lens = registry.create({
    messageId: `${runKind}:${sessionKeyHash}:${Date.now()}`,
    chatType: 'internal',
    runKind,
    visibility: 'owner',
    trigger: input.trigger ?? 'tool',
    sessionKey: key,
    conversationId: `session:${sessionKeyHash}`,
    receivedAt: Date.now(),
    preview: input.preview,
  });
  activeLensesBySession.set(key, {
    registry,
    lensId: lens.lensId,
    background: true,
  });
  return { lens, created: true };
}

/**
 * Most recently updated background lens that is still bound (not yet
 * finalized). Used by the outbound send path to stamp gateway-delivered
 * messages (cron announcements, CLI sends) with a lens pointer — those
 * sends carry no session context, so this correlation is best-effort:
 * the binding's bounded lifetime (finalized after a short idle window)
 * keeps stale matches out.
 */
export function getActiveBackgroundContextLens(): ContextLens | null {
  let best: ContextLens | null = null;
  for (const binding of activeLensesBySession.values()) {
    if (!binding.background) {
      continue;
    }
    const lens = binding.registry.get(binding.lensId);
    if (!lens) {
      continue;
    }
    if (!best || lens.updatedAt > best.updatedAt) {
      best = lens;
    }
  }
  return best;
}

export function recordBackgroundContextLensOutput(
  lensId: string,
  output: ContextLensOutput
): ContextLens | null {
  const registry = getBackgroundContextLensRegistry();
  const lens = registry.recordOutput(lensId, output);
  if (!lens) {
    return null;
  }
  // Mirror the dispatch deliver path: without these the run inspector shows
  // "Persistence: none" for background runs that did post messages.
  registry.recordPersistence(lensId, { postsReply: true });
  return (
    registry.recordPersistenceEvent(lensId, {
      kind: 'conversation_state',
      action: 'created',
      location: 'urbit',
      status: 'ok',
      key: 'reply',
      reason: 'posted gateway-delivered message',
    }) ?? lens
  );
}

export function recordContextLensToolStartForSession(
  sessionKey: string | null | undefined,
  toolName: string,
  detail: {
    phase?: string;
    argumentSummary?: string;
    argumentDetail?: string;
    toolCallId?: string;
  } = {}
): ContextLens | null {
  const binding = resolveActiveBinding(sessionKey)?.binding;
  if (!binding) {
    return null;
  }
  const lens = binding.registry.recordToolCall(
    binding.lensId,
    toolName,
    detail
  );
  if (!lens) {
    return null;
  }
  return binding.registry.setStatus(binding.lensId, 'tool_running');
}

export function recordContextLensToolResultForSession(
  sessionKey: string | null | undefined,
  toolName: string,
  detail: {
    durationMs?: number;
    error?: unknown;
    resultSummary?: string;
    status?: ContextLensToolRun['status'];
    toolCallId?: string;
  } = {}
): ContextLens | null {
  const binding = resolveActiveBinding(sessionKey)?.binding;
  if (!binding) {
    return null;
  }
  return binding.registry.completeToolRun(binding.lensId, toolName, detail);
}

export function finalizeBackgroundContextLensForSession(
  sessionKey: string | null | undefined
): ContextLens | null {
  const resolved = resolveActiveBinding(sessionKey);
  if (!resolved?.binding.background) {
    return null;
  }
  const { key, binding } = resolved;
  if (binding.finalizeTimer) {
    clearTimeout(binding.finalizeTimer);
  }
  const lens = binding.registry.get(binding.lensId);
  if (!lens || lens.tools.runs.some((run) => run.status === 'running')) {
    return null;
  }
  const completedAt = Date.now();
  binding.registry.recordLifecycle(binding.lensId, {
    completedAt,
    durationMs: completedAt - lens.createdAt,
    deliveredMessageCount: 0,
  });
  const completed = binding.registry.setStatus(binding.lensId, 'completed');
  activeLensesBySession.delete(key);
  return completed;
}

export function scheduleBackgroundContextLensFinalization(
  sessionKey: string | null | undefined,
  onFinalize: (lens: ContextLens) => void,
  idleMs = BACKGROUND_FINALIZE_IDLE_MS
): void {
  const resolved = resolveActiveBinding(sessionKey);
  if (!resolved?.binding.background) {
    return;
  }
  const { key, binding } = resolved;
  if (binding.finalizeTimer) {
    clearTimeout(binding.finalizeTimer);
  }
  const finalizeTimer = setTimeout(() => {
    const finalLens = finalizeBackgroundContextLensForSession(key);
    if (finalLens) {
      onFinalize(finalLens);
    }
  }, idleMs);
  activeLensesBySession.set(key, { ...binding, finalizeTimer });
}
